"""Temporarily mutate shelf contracts, run targeted tests, restore in finally."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / 'internal/dashboard/ui'
ART = UI / 'src/lib/theme/christmas/ChristmasShelf.svelte'
SHELL = UI / 'src/styles/shell.css'
original = ART.read_text()
shell = SHELL.read_text()
holly = '''<script lang="ts">import holly from './holly.webp';</script>
<div class="theme-shelf christmas-shelf" aria-hidden="true"><img src={holly} alt="" width="48" height="32" /></div>
<style>.christmas-shelf { display:flex; justify-content:center; padding-top:22px; pointer-events:none; user-select:none; } img { display:block; }</style>
'''
mutations = [
    ('holly-only', ART, holly),
    ('missing-light', ART, original.replace('    [79.79, 127.36, 3.6, -3],\n', '')),
    ('reduced-motion-animation', ART, original.replace('animation: none;', 'animation: twinkle 3s infinite;')),
    ('intercepts-clicks', ART, original.replace('pointer-events: none;', 'pointer-events: auto;')),
    ('width-boundary', SHELL, shell.replace('max-width: 760px', 'max-width: 759px')),
    ('height-boundary', SHELL, shell.replace('max-height: 640px', 'max-height: 639px')),
]
results = []
for name, path, mutation in mutations:
    try:
        path.write_text(mutation)
        result = subprocess.run(['npm', 'run', 'test', '--', 'src/lib/theme/christmas/artwork.test.ts'], cwd=UI, capture_output=True, text=True)
        results.append({'mutation': name, 'exit_code': result.returncode, 'output': result.stdout + result.stderr})
        if result.returncode != 1 or 'AssertionError' not in result.stdout + result.stderr:
            raise RuntimeError(f'{name}: did not fail an assertion')
    finally:
        ART.write_text(original)
        SHELL.write_text(shell)
(ROOT / 'design-docs/christmas/2026-10-03-shelf-regressions.json').write_text(json.dumps({
    'results': results, 'restored_shelf_sha256': hashlib.sha256(ART.read_bytes()).hexdigest(),
    'restored_shell_sha256': hashlib.sha256(SHELL.read_bytes()).hexdigest(),
}, indent=2) + '\n')
print('All six mutations failed assertions; production files restored.')
