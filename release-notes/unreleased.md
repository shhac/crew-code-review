# Unreleased

Upgrade the published lib-agent-harness dependency from v0.12.0 to v0.24.0.
Native Codex, Claude and Grok review invocation and resumption retain the same
configuration and transcript contract. Usage now distinguishes reported zero
reasoning from absent evidence, reads Claude thinking within output, and carries
typed Claude quota/reset details through review errors.

Linux/macOS API workbench read_file, search_files and edit_file are disabled
pending verified admission; listing, opt-in writes, caller/skill tools and
proved commands survive. This daemon uses native.Run, so that breaking
workbench change and the new command-sandbox PATH/read policy do not remove its
native review tools. Separate sandbox commands must explicitly grant Read to
external toolchains and runtimes. No API review engine is added.

Migration sources, release dispositions, fake-engine coverage and offline
verification: [harness migration](../design-docs/2026-10-harness-migration.md).

The Christmas theme now uses the accepted layered robin: independent breathing,
head gestures and blinks, occasional pecks, articulated hopping legs, and
eight calibrated flight profiles per wing. Takeoff and landing blend into the
standing pose at a consistent dashboard size. The rotating shoulder and
feathered tail attachment stay connected to the body. Superseded robin atlas
playback and runtime artwork have been removed; the parts lab remains available
for development. Reduced motion keeps a still perched robin.

Two robins now share the Christmas scene with independent, staggered behavior,
separate perches and reserved flight paths. Flights prefer another ledge and
can travel around card walls to reach a different height. Idle periods allow
pecks to finish, and flights last long enough to use every wing profile.
Crowded layouts still hide birds that have no clear perch; reduced motion keeps
both still.

Robins now face their direction of travel along smooth, connected flight
curves, with body tilt limited to 20 degrees and a raised head on landing.
Continuing to chase one with the cursor triggers flight after two evasive
hops when a clear route is available. Stationary snow paths are cached;
wiped snow recovers at 10 Hz to reduce animation allocations. The lab's
manual-clock wrapper no longer retains subscriptions across theme changes.
Headless memory checks cover sustained animation, navigation and repeated
theme mounts; see [memory investigation](../design-docs/2026-10-robin-memory.md)
for measurements and limits.

November now has its own theme, Bonfire Night (`dashboard.theme` `bonfire`,
on by default under `auto` from 1 to 30 November). The rail shows a bonfire
with its guy and toffee apples, with one quiet firework every 7 to 15 seconds
in the rail's free space; the page gets embers along card tops that a passing
cursor fans, and a hedgehog that leaves its woodpile when the page is still
and curls up when the cursor comes close. Reduced motion keeps a still scene.

January now has its own theme, the northern lights (`dashboard.theme`
`aurora`, on by default under `auto` from 1 to 31 January). The rail shows a
thermos, bobble hat, mittens and cocoa, with the aurora rippling slowly in the
rail's free space; the page gets a rim of frost along the ledges, tinted by
the aurora, and an Arctic fox asleep on a ledge that twitches an ear at a
passing cursor, wakes and moves on when the cursor lingers, and sometimes
pounces. Reduced motion keeps a still scene.

Seasonal scenes now measure the page through one shared snapshot, and each
creature decides how much headroom it needs instead of inheriting the
spider's. Halloween and Christmas render exactly as before. The
`?theme-debug=1` overlay labels ledges with their headroom in pixels instead
of marking spider-cramped tops in orange.
