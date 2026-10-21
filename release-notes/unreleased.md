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
cursor fans, and two or three hedgehogs that share a woodpile, come out one
at a time when the page is still, walk on stepping legs, sniff, blink and
turn to look at a nearby cursor, and curl up when it comes close. Reduced
motion keeps a still scene.

January now has its own theme, the northern lights (`dashboard.theme`
`aurora`, on by default under `auto` from 1 to 31 January). The rail shows a
thermos, bobble hat, mittens and cocoa, with the aurora rippling slowly in the
rail's free space; the page gets a rim of frost along the ledges, tinted by
the aurora, and two or three Arctic foxes asleep on the ledges, well apart,
that twitch an ear at a passing cursor, wake and trot off on stepping legs
when the cursor lingers (the others looking up), and sometimes pounce.
Reduced motion keeps a still scene.

February now has its own theme, Valentine's (`dashboard.theme` `valentine`,
on by default under `auto` throughout February). The rail shows a box of
chocolates, a single rose and a heart-shaped card; the page gets a few rose
petals along the ledges and two or three cupids hovering in its open air,
clear of text, controls, charts and cards, who flit between spots, shoot an
arrow into the ledge nearest a cursor that goes still (it pops into hearts
and stays stuck a while, wobbling), and dodge a cursor whipping past.
Reduced motion keeps a still scene.

March now has Mad March hares (`dashboard.theme` `hares`, on by default
under `auto` from 1 to 31 March). The rail shows a pot of daffodils; the page
gets tufts of grass and daffodil shoots along its ledges, swaying and parting
at a passing cursor, and two or three brown hares that graze and sit up, box
where there is room to rear, then chase ledge to ledge in bounding leaps
(never over text, controls or charts), and freeze with their ears up at a
cursor coming near, then bolt. Reduced motion keeps a still scene.

Hare knees and hocks now follow continuous folds through the bounding stride,
with skeleton-based upper/lower limb proportions and fixed bone lengths.
Sitting keeps the forefeet reachable without stretched shins, while the long
hind feet remain flat at rest and rise onto the toes in running stance.
Thigh artwork is anchored at the hip and knee, with matching placement for
its outline and fur, so the haunch stays attached to the rump.

April now has an Easter egg hunt (`dashboard.theme` `easter`, on by default
under `auto` from 1 to 30 April). The rail shows a basket of painted eggs and
chicks; painted eggs peep from the ends of the page's ledges and pop up when
the cursor passes close, counted found/total beside the brand for the
session only (nothing is stored; a reload starts a new hunt); and two or
three rabbits sit, groom and hop on stepping legs, sit up at a passing
cursor, thump and bolt when it lingers, and now and then leave a new egg.
Reduced motion keeps a still scene.

May now has a bluebell wood (`dashboard.theme` `bluebells`, on by default
under `auto` from 1 to 31 May). The rail shows a clump of native bluebells
growing from a mossy mound; the page gets a rim of moss along its ledges with
small clumps of bluebells and cushions of moss, and two or three buff-tailed
bumblebees that work up a clump bell by bell, warm up and lift off, bumble to
another flower (the shelf's too, through the rail), dart out of a moving
cursor's way, and now and then fly head first into a card's side and bounce
off, dazed. They are never over text, controls or charts. Reduced motion keeps
them perched and still.

June now has a village fete (`dashboard.theme` `fete`, on by default under
`auto` from 1 to 30 June). The rail shows a cake stall: a coconut shy, a
prize Victoria sandwich and three jars of jam. Bunting hangs in the gaps
between the page's ledges, under page headings and across the gutters
between cards, only where nothing is in the way; it flutters in a breeze and
swings when the cursor brushes it. Two wasps circle the cake in the rail's
air, inspect it and land to feed, and are chased off past the window's edge
by a cursor darting at them, coming back a little later; there are none on a
phone. Reduced motion keeps a still scene.

July now has summer tennis (`dashboard.theme` `wimbledon`, on by default
under `auto` from 1 to 31 July). The rail shows strawberries and cream, a jug
of fruit cup and an old racquet and ball on mown lawn; chalk court lines run
along the ledges; two or three pigeons wander the first row of cards, shy
from a cursor coming close and fly off from one swept past fast; every minute
or two a Harris's hawk sweeps along their row and they fly away ahead of it
and come back; and now and then a ball rallies between two cards side by
side, volleyed back by a cursor swept across its path. Nothing is drawn over
the page's content. Reduced motion keeps a still scene.

August now has the seaside (`dashboard.theme` `seaside`, on by default under
`auto` from 1 to 31 August). The rail shows chips, a bucket and spade and a
99 on a drift of sand; the page gets low drifts of sand along its ledges,
with the odd cockle or winkle; and two or three herring gulls strut the
ledges, eye the cursor and follow it, swoop at one left still for five
seconds (through clear air only, never over text, controls or charts), then
land and give the long call. Reduced motion keeps a still scene.

September now has the harvest (`dashboard.theme` `harvest`, on by default
under `auto` from 1 to 30 September). The rail shows a scarecrow beside a
wheat sheaf, marrows and apples; the page gets straw and wheat grain along
its ledges, and two or three carrion crows that walk with a bobbing head and
peck the grain, grow wary of a cursor coming near and sidle away. A cursor
passing close to the scarecrow makes it flap its arms, and every crow flies
off the page by the top or the right edge (never over text, controls, charts
or the rail), coming back one at a time a while later. Reduced motion keeps a
still scene.

Seasonal scenes now measure the page through one shared snapshot, and each
creature decides how much headroom it needs instead of inheriting the
spider's. Halloween and Christmas render exactly as before. The
`?theme-debug=1` overlay labels ledges with their headroom in pixels instead
of marking spider-cramped tops in orange.

Seasonal fixes: summer tennis's hawk and pigeons now pass behind the rail
instead of over its links when they fly in or out by its edge; a fête wasp
keeps feeding until there is room above the cake to take off, rather than
rising out of a shortened shelf's air; the Easter egg counter is as wide as
its count, so a double-digit hunt no longer spills toward the brand; a finger
on a touch screen no longer startles the Halloween spiders; and March's
hares crouch for a stand-off wherever a sit-up would reach a chart above.

Discovery now lists a repo's open PRs with a lean paged search that fits
GitHub's query timeout, so a repo with hundreds of open PRs no longer falls
into backoff and out of discovery; a listing cut short keeps the PRs it has,
and every gh call is bounded at a minute, so a stalled one no longer holds
every later sweep. After each sweep the daemon records each repo's discovery
health (last success, PRs listed, degraded listings, failures, backoff, last
error) in discovery.json in the state dir: `doctor` reports a failing or
stale repo, and the Config page lists every repo under Discovery. A shutdown
mid-sweep is no longer recorded as a repo failure.
