export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Shared with the inline script in ThemeScript.astro, which applies the choice before first paint. */
export const themeStorageKey = 'kiln-theme';
export const themeChangeEvent = 'kiln:theme';

const media = matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be unavailable; the system setting still applies.
  }
  return 'system';
}

function applyChoice(choice: ThemeChoice) {
  const theme: Theme = choice === 'dark' || (choice === 'system' && media.matches) ? 'dark' : 'light';
  root.dataset.themePref = choice;
  const changed = root.dataset.theme !== theme;
  root.dataset.theme = theme;
  document.querySelectorAll<HTMLInputElement>('input[name="kiln-theme"]').forEach((input) => {
    input.checked = input.value === choice;
  });
  if (changed) document.dispatchEvent(new CustomEvent<Theme>(themeChangeEvent, { detail: theme }));
}

export function currentTheme(): Theme {
  return root.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function startThemeSwitch() {
  applyChoice(readChoice());
  document.querySelectorAll<HTMLInputElement>('input[name="kiln-theme"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const choice = input.value as ThemeChoice;
      try {
        if (choice === 'system') localStorage.removeItem(themeStorageKey);
        else localStorage.setItem(themeStorageKey, choice);
      } catch {
        // The choice still applies to this page.
      }
      applyChoice(choice);
    });
  });
  media.addEventListener('change', () => {
    if (root.dataset.themePref === 'system') applyChoice('system');
  });
  // Other Kiln pages, including gallery previews, follow a choice made elsewhere.
  window.addEventListener('storage', (event) => {
    if (event.key === themeStorageKey || event.key === null) applyChoice(readChoice());
  });
}
