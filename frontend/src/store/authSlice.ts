import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthResult } from '@/types';

interface AuthState {
  userId: string | null;
  userName: string | null;
  email: string | null;
  role: 'Admin' | 'User' | null;
  isAuthenticated: boolean;
}

const storedUser = localStorage.getItem('ufmdb_user');
const initialState: AuthState = storedUser
  ? { ...JSON.parse(storedUser), isAuthenticated: true }
  : { userId: null, userName: null, email: null, role: null, isAuthenticated: false };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthResult>) => {
      const { userId, userName, email, role, accessToken, refreshToken } = action.payload;
      state.userId = userId;
      state.userName = userName;
      state.email = email;
      state.role = role;
      state.isAuthenticated = true;

      localStorage.setItem('ufmdb_access_token', accessToken);
      localStorage.setItem('ufmdb_refresh_token', refreshToken);
      localStorage.setItem('ufmdb_user', JSON.stringify({ userId, userName, email, role }));
    },
    logout: (state) => {
      state.userId = null;
      state.userName = null;
      state.email = null;
      state.role = null;
      state.isAuthenticated = false;

      localStorage.removeItem('ufmdb_access_token');
      localStorage.removeItem('ufmdb_refresh_token');
      localStorage.removeItem('ufmdb_user');
    }
  }
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
