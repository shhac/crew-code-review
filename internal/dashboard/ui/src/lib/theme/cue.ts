// A test's way to start a month's timed behaviour now (a sweep, a swoop, a
// scatter) instead of waiting for its random time: `?theme-cue=<name>`. Read
// once at load, as `?theme=` is: in-app navigation drops the query string.
// Without the parameter nothing is cued, so the page behaves exactly as it
// would for anyone.
const cue = new URLSearchParams(location.search).get('theme-cue');

// Which of a month's own cues the page was loaded with, if any. Each month
// names its cues where it uses them, so the answer is typed to those names:
//
//   const SWEEP = cueOf(['sweep', 'rally'] as const); // 'sweep' | 'rally' | null
export const cueOf = <const N extends string>(names: readonly N[]): N | null => names.find((n) => n === cue) ?? null;
