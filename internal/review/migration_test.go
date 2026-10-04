package review

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/shhac/crew-code-review/internal/config"
	harness "github.com/shhac/lib-agent-harness"
)

func migrationEngine(engine harness.Engine) *nativeEngine {
	switch engine {
	case harness.Codex:
		return newCodex(config.CodexSettings{}, "NUDGE")
	case harness.Claude:
		return newClaude(config.ClaudeSettings{}, "NUDGE")
	default:
		return newGrok(config.GrokSettings{}, "NUDGE")
	}
}

// Exercise normalization through Review, including its shared stream on resume.
// Missing reasoning is different from a provider explicitly reporting zero.
func TestNativeReasoningAcrossResumes(t *testing.T) {
	for _, engine := range []harness.Engine{harness.Codex, harness.Claude, harness.Grok} {
		for _, evidence := range []string{"reported", "zero", "absent", "second absent"} {
			t.Run(string(engine)+"/"+evidence, func(t *testing.T) {
				t.Parallel()
				e := migrationEngine(engine)
				wd := t.TempDir()
				session := string(engine) + "-" + strings.ReplaceAll(evidence, " ", "-")
				calls := 0
				e.cfg.RunCommand = func(_ context.Context, args []string, dir string, out, _ io.Writer) error {
					calls++
					if dir != wd {
						t.Fatalf("workspace = %q", dir)
					}
					joined := strings.Join(args, " ")
					if calls == 2 && (!strings.Contains(joined, session) || !strings.Contains(joined, "NUDGE") || strings.Contains(joined, "FULL PROMPT")) {
						t.Fatalf("resume args = %v", args)
					}
					decision := DecisionWorking
					if calls == 2 {
						decision = DecisionApproved
					}
					u := map[string]any{"input_tokens": 10 * calls, "output_tokens": 8 * calls}
					reasoning := 2 * calls
					if evidence == "zero" {
						reasoning = 0
					}
					if evidence != "absent" && !(evidence == "second absent" && calls == 2) {
						switch engine {
						case harness.Codex:
							u["reasoning_output_tokens"] = reasoning
						case harness.Claude:
							u["output_tokens_details"] = map[string]int{"thinking_tokens": reasoning}
						case harness.Grok:
							u["reasoning_tokens"] = reasoning
						}
					}
					report := map[string]any{"decision": decision, "summary": "ok"}
					var frame map[string]any
					switch engine {
					case harness.Codex:
						json.NewEncoder(out).Encode(map[string]string{"type": "thread.started", "thread_id": session})
						frame = map[string]any{"type": "turn.completed", "usage": u}
						path, _ := argValue(args, "--output-last-message")
						if strings.HasPrefix(path, wd+string(os.PathSeparator)) {
							t.Fatal("report inside writable workspace")
						}
						data, _ := json.Marshal(report)
						if err := os.WriteFile(path, data, 0600); err != nil {
							return err
						}
					case harness.Claude:
						json.NewEncoder(out).Encode(map[string]string{"type": "system", "subtype": "init", "session_id": session})
						frame = map[string]any{"type": "result", "subtype": "success", "session_id": session, "usage": u, "structured_output": report, "total_cost_usd": 0.1}
					case harness.Grok:
						frame = map[string]any{"type": "end", "stopReason": "end_turn", "sessionId": session, "usage": u, "structuredOutput": report}
					}
					return json.NewEncoder(out).Encode(frame)
				}
				v, err := e.Review(context.Background(), Request{Prompt: "FULL PROMPT", WorkDir: wd})
				if err != nil || v.Decision != DecisionApproved || calls != 2 {
					t.Fatalf("%+v, calls=%d, err=%v", v, calls, err)
				}
				want := int64(6)
				output := int64(24)
				if engine == harness.Codex {
					want, output = 4, 16
				}
				if evidence == "zero" || evidence == "absent" {
					want = 0
				}
				if evidence == "second absent" {
					want = 2
					if engine == harness.Codex {
						want = 0
					}
				}
				known := evidence == "reported" || evidence == "zero"
				if v.Tokens.Reasoning != want || v.Tokens.ReasoningKnown != known || v.Tokens.Output != output {
					t.Fatalf("usage = %+v, want reasoning %d known %v output %d", v.Tokens, want, known, output)
				}
				if len(v.UsageRaw) == 0 || SessionFromLog(wd) != session {
					t.Fatal("raw usage or recoverable transcript lost")
				}
				if engine == harness.Claude && v.CostUSD != 0.2 {
					t.Fatalf("cost = %v", v.CostUSD)
				}
			})
		}
	}
}

func TestNativeClaudeQuotaFactsSurviveReview(t *testing.T) {
	e := migrationEngine(harness.Claude)
	reset := time.Now().Add(2 * time.Hour).Truncate(time.Second).UTC()
	calls := 0
	e.cfg.RunCommand = func(_ context.Context, _ []string, _ string, out, _ io.Writer) error {
		calls++
		fmt.Fprintf(out, "{\"type\":\"rate_limit_event\",\"rate_limit_info\":{\"status\":\"rejected\",\"resetsAt\":%d,\"rateLimitType\":\"five_hour\"}}\n", reset.Unix())
		fmt.Fprintln(out, `{"type":"assistant","message":{"model":"<synthetic>","content":[{"type":"text","text":"You've hit your session limit"}]},"error":"rate_limit","is_api_error_message":true}`)
		fmt.Fprintln(out, `{"type":"result","subtype":"success","is_error":true,"result":"You've hit your session limit","terminal_reason":"api_error"}`)
		return nil
	}
	v, err := e.Review(context.Background(), Request{Prompt: "p", WorkDir: t.TempDir()})
	facts, ok := harness.ErrorFacts(err)
	if !ok || facts.Cause != harness.CauseQuotaExhausted || facts.ResetsAt == nil || !facts.ResetsAt.Equal(reset) || facts.Retryable {
		t.Fatalf("facts = %+v, err = %v", facts, err)
	}
	if v.Decision != DecisionError || calls != 1 || !strings.Contains(v.Raw, "session limit") || !strings.Contains(err.Error(), "session limit") {
		t.Fatalf("verdict = %+v, calls = %d, err = %v", v, calls, err)
	}
}

func TestNativeCancellationBeforeLaunch(t *testing.T) {
	for _, engine := range []harness.Engine{harness.Codex, harness.Claude, harness.Grok} {
		for _, session := range []string{"", "recovered"} {
			t.Run(string(engine)+"/"+session, func(t *testing.T) {
				e := migrationEngine(engine)
				e.cfg.RunCommand = func(context.Context, []string, string, io.Writer, io.Writer) error {
					t.Fatal("cancelled review launched")
					return nil
				}
				ctx, cancel := context.WithCancel(context.Background())
				cancel()
				v, err := e.Review(ctx, Request{Prompt: "p", WorkDir: t.TempDir(), ResumeSession: session})
				if !errors.Is(err, context.Canceled) || v.Decision != DecisionError || v.Tokens.Known {
					t.Fatalf("%+v, err=%v", v, err)
				}
			})
		}
	}
}

func TestGrokResumeFailureAndExhaustion(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(fmt.Sprint(fail), func(t *testing.T) {
			e := migrationEngine(harness.Grok)
			e.maxResumes = 1
			calls := 0
			failed := errors.New("resume failed")
			e.cfg.RunCommand = func(_ context.Context, args []string, _ string, out, _ io.Writer) error {
				calls++
				if calls == 2 && !strings.Contains(strings.Join(args, " "), "NUDGE") {
					t.Fatal("resume lost nudge")
				}
				if calls == 2 && fail {
					return failed
				}
				_, err := io.WriteString(out, `{"type":"end","stopReason":"end_turn","sessionId":"s1","usage":{"input_tokens":10,"output_tokens":1},"structuredOutput":{"decision":"WORKING","summary":"unfinished"}}`+"\n")
				return err
			}
			v, err := e.Review(context.Background(), Request{Prompt: "p", WorkDir: t.TempDir()})
			if err == nil || v.Decision != DecisionError || calls != 2 || v.Tokens.Input == 0 {
				t.Fatalf("%+v, calls=%d, err=%v", v, calls, err)
			}
			if fail && !errors.Is(err, failed) {
				t.Fatalf("resume failure lost: %v", err)
			}
		})
	}
}
