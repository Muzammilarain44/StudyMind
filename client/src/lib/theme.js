// Apply a theme ('light' | 'dark') to the document and remember it locally.
// Plain function (no components) so it can be used from any page.
export function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('studymind-theme', dark ? 'dark' : 'light');
  } catch {
    // Private mode / storage unavailable — the class toggle still applies.
  }
}

export function readStoredTheme() {
  try {
    return localStorage.getItem('studymind-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
