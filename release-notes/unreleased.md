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
