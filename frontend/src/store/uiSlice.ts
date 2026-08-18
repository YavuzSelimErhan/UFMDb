import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ThemeMode } from '@/types';

interface UiState {
  theme: ThemeMode;
}

const storedTheme = (localStorage.getItem('ufmdb_theme') as ThemeMode | null) ?? 'dark';

const initialState: UiState = { theme: storedTheme };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.theme = action.payload;
      localStorage.setItem('ufmdb_theme', action.payload);
      document.documentElement.setAttribute('data-theme', action.payload);
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ufmdb_theme', state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }
});

export const { setTheme, toggleTheme } = uiSlice.actions;
export default uiSlice.reducer;
