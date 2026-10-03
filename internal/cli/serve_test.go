package cli

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	"github.com/shhac/crew-code-review/internal/logbuf"
	"github.com/shhac/crew-code-review/internal/review"
	"github.com/shhac/crew-code-review/internal/usage"
)

type testLogs struct {
	mu    sync.Mutex
	lines []string
}

func (l *testLogs) logf(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.lines = append(l.lines, fmt.Sprintf(format, args...))
}

func (l *testLogs) contains(substr string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return strings.Contains(strings.Join(l.lines, "\n"), substr)
}

func waitDone(t *testing.T, ctx context.Context, name string) {
	t.Helper()
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatalf("%s was not canceled", name)
	}
}

func assertNotDone(t *testing.T, ctx context.Context, name string) {
	t.Helper()
	select {
	case <-ctx.Done():
		t.Fatalf("%s canceled too early", name)
	case <-time.After(25 * time.Millisecond):
	}
}

func TestRunningLoopsPinsFlagsOverConfig(t *testing.T) {
	cfg := config.Config{}
	if got := runningLoops(serveOpts{}, cfg); !got.Discovery || !got.Review {
		t.Errorf("default loops = %+v, want both running", got)
	}
	if got := runningLoops(serveOpts{noReviews: true}, cfg); !got.Discovery || got.Review {
		t.Errorf("--no-reviews loops = %+v", got)
	}
	if got := runningLoops(serveOpts{noSchedule: true}, cfg); got.Discovery || got.Review {
		t.Errorf("--no-schedule loops = %+v", got)
	}
	cfg.Discovery.Enabled = config.Bool(false)
	cfg.Schedule.Enabled = config.Bool(false)
	if got := runningLoops(serveOpts{}, cfg); got.Discovery || got.Review {
		t.Errorf("disabled config loops = %+v", got)
	}
}

// The steering auth rule rests on this: funnel is public traffic with no
// identity attached, so a header arriving over it must never identify anyone.
func TestTrustsProxyIdentityOnlyOffFunnel(t *testing.T) {
	for mode, want := range map[string]bool{"serve": true, "": true, "funnel": false} {
		if got := trustsProxyIdentity(mode); got != want {
			t.Errorf("trustsProxyIdentity(%q) = %v, want %v", mode, got, want)
		}
	}
}

// Both severities reach the dashboard's ring, not just info: a warning that
// only went to stderr would be missing from the Logs page it matters most on.
func TestTeeSinksFillTheRingAtBothSeverities(t *testing.T) {
	captureLog(t)
	ring := logbuf.New(10)
	sinks := teeSinks(ring)
	sinks.infof("info %d", 1)
	sinks.warnf("warn %d", 2)
	tail := ring.Tail(10)
	if len(tail) != 2 || tail[0].Line != "info 1" || tail[1].Line != "warn 2" {
		t.Errorf("ring = %+v, want both lines in order", tail)
	}
}

// TestStartDashboardBindConflict pins the "one daemon per address" guard:
// with the port already held, startDashboard must fail (naming the likely
// cause) BEFORE the scheduler could start — a second instance dies here,
// not after claiming a PR and spending an engine invocation.
func TestStartDashboardBindConflict(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		dashboardListenFailure(t, err)
		return
	}
	defer func() { _ = ln.Close() }()

	stopped := false
	_, err = startDashboard(ln.Addr().String(), nil, func(string, ...any) {}, func() { stopped = true })
	if err == nil {
		t.Fatal("binding an occupied address must fail")
	}
	if !strings.Contains(err.Error(), "another serve instance") {
		t.Errorf("error should hint at the double-daemon cause, got: %v", err)
	}
	if stopped {
		t.Error("the stop callback must not fire on a bind failure")
	}
}

// The daemon meters every wired engine that reports quota, so this list must
// be derived from the engine roster and the harness rather than restated. A
// hand-written list would silently skip a new engine; polling one with no
// quota (grok) would show a permanent error instead of headroom.
func TestUsageSourcesCoversEveryWiredEngine(t *testing.T) {
	cfg := config.Config{Review: config.ReviewSettings{
		Codex:  config.CodexSettings{EngineCommon: config.EngineCommon{Bin: "codex-dev"}},
		Claude: config.ClaudeSettings{EngineCommon: config.EngineCommon{Bin: "claude-dev"}},
	}}
	got := usageSources(cfg)
	metered := usage.Metered(review.Engines)
	if len(got) != len(metered) || len(metered) != 2 {
		t.Fatalf("got %d sources, want one per metered engine (%v)", len(got), metered)
	}
	bins := map[string]string{}
	for _, src := range got {
		bins[src.Engine] = src.Bin
	}
	for _, engine := range metered {
		if _, ok := bins[engine]; !ok {
			t.Errorf("engine %q is wired but never metered", engine)
		}
	}
	if bins["codex"] != "codex-dev" || bins["claude"] != "claude-dev" {
		t.Errorf("bins = %v, want each engine's configured binary", bins)
	}
}

// Only socket permission restrictions may excuse the real bind guard locally.
func dashboardListenFailure(t *testing.T, err error) {
	t.Helper()
	if errors.Is(err, os.ErrPermission) || errors.Is(err, syscall.EPERM) || errors.Is(err, syscall.EACCES) {
		if os.Getenv("CREW_CODE_REVIEW_TEST_NO_SKIP") != "1" {
			t.Skipf("environment refused a socket: %v", err)
		}
	}
	t.Fatalf("reserving dashboard socket: %v", err)
}

// Child invocations exercise testing.T's actual skip/fail behavior without sockets.
func TestDashboardListenFailure(t *testing.T) {
	const childKey = "CREW_CODE_REVIEW_TEST_LISTEN_ERROR"
	failures := map[string]error{
		"eperm":      syscall.EPERM,
		"eacces":     syscall.EACCES,
		"permission": os.ErrPermission,
		"occupied":   syscall.EADDRINUSE,
	}
	if name := os.Getenv(childKey); name != "" {
		err := failures[strings.TrimPrefix(name, "wrapped-")]
		if err == nil {
			t.Fatalf("unknown injected error %q", name)
		}
		if strings.HasPrefix(name, "wrapped-") {
			err = &net.OpError{Op: "listen", Net: "tcp", Err: &os.SyscallError{Syscall: "bind", Err: err}}
		}
		dashboardListenFailure(t, err)
		t.Fatal("listen failure returned without skipping or failing")
	}
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	for name, injected := range failures {
		for _, wrapped := range []bool{false, true} {
			for _, strict := range []string{"", "0", "true", "1"} {
				name := name
				if wrapped {
					name = "wrapped-" + name
				}
				t.Run(name+"/strict="+strict, func(t *testing.T) {
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					cmd := exec.CommandContext(ctx, binary, "-test.run=^TestDashboardListenFailure$", "-test.v")
					// Remove inherited values so the empty case really is unset.
					for _, entry := range os.Environ() {
						if !strings.HasPrefix(entry, childKey+"=") && !strings.HasPrefix(entry, "CREW_CODE_REVIEW_TEST_NO_SKIP=") {
							cmd.Env = append(cmd.Env, entry)
						}
					}
					cmd.Env = append(cmd.Env, childKey+"="+name)
					if strict != "" {
						cmd.Env = append(cmd.Env, "CREW_CODE_REVIEW_TEST_NO_SKIP="+strict)
					}
					output, err := cmd.CombinedOutput()
					if ctx.Err() != nil {
						t.Fatalf("child timed out: %s", output)
					}
					wantSkip := !errors.Is(injected, syscall.EADDRINUSE) && strict != "1"
					skipped := strings.Contains(string(output), "--- SKIP: TestDashboardListenFailure")
					if skipped != wantSkip || (err == nil) != wantSkip {
						t.Fatalf("want skip=%v, exit=%v: %s", wantSkip, err, output)
					}
					if !wantSkip {
						var exitErr *exec.ExitError
						if !errors.As(err, &exitErr) || exitErr.ExitCode() != 1 {
							t.Fatalf("unexpected child failure: %v", err)
						}
					}
					if !strings.Contains(string(output), injected.Error()) {
						t.Errorf("original error missing: %s", output)
					}
					if wantSkip && !strings.Contains(string(output), "environment refused a socket") {
						t.Errorf("skip reason missing: %s", output)
					}
				})
			}
		}
	}
}
