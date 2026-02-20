import { ref, watch } from 'vue';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'pws-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light'; // Default to light mode
}

const theme = ref<Theme>(getInitialTheme());

function applyTheme(value: Theme) {
  document.documentElement.classList.toggle('dark', value === 'dark');
}

// Apply on load
applyTheme(theme.value);

watch(theme, (value) => {
  localStorage.setItem(STORAGE_KEY, value);
  applyTheme(value);
});

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  }

  return {
    theme,
    toggleTheme,
  };
}
