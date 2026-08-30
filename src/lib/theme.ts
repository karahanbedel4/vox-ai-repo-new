import { appStorage } from './storage';

export type ThemeMode = 'dark' | 'light' | 'system';

export function getInitialTheme(): ThemeMode {
  const saved = appStorage.getItemSync('vox_theme') as ThemeMode;
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'dark'; // Default dark luxury for VOX
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else if (mode === 'dark') {
    root.classList.remove('light');
    root.classList.add('dark');
  } else {
    // System
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }
  appStorage.setItem('vox_theme', mode);
}
