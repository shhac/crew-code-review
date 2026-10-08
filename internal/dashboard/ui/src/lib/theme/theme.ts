// The seasonal decoration set. The daemon decides which one is active (it owns
// the calendar rule for `auto`); the page only draws it.

export const THEMES = ['none', 'halloween', 'bonfire', 'christmas', 'aurora'] as const;
export type ThemeName = (typeof THEMES)[number];

const known = (name: string | null): ThemeName | undefined => THEMES.find((t) => t === name);

// `?theme=<name>` previews a set whatever the config or the date says. Read
// once at load: in-app navigation drops the query string.
const preview = known(new URLSearchParams(location.search).get('theme'));

// Marks the active set on <html>, where styles/themes.css picks up its
// palette. No set, no mark: the dashboard's own colours apply.
export function markTheme(name: ThemeName, root: HTMLElement = document.documentElement) {
  if (name === 'none') {
    delete root.dataset.theme;
    return;
  }
  root.dataset.theme = name;
}

export function resolveTheme(active: string): ThemeName {
  return preview ?? known(active) ?? 'none';
}
