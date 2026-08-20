import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthResult } from "@/types";
import { setAccessToken } from "@/services/tokenStore";

interface AuthState {
  userId: string | null;
  userName: string | null;
  email: string | null;
  role: "Admin" | "User" | null;
  isAuthenticated: boolean;
  isSessionChecked: boolean; // SessionManager ilk sessiz-refresh'i tamamladı mı
}

const storedUser = localStorage.getItem("ufmdb_user");
const initialState: AuthState = {
  ...(storedUser
    ? JSON.parse(storedUser)
    : { userId: null, userName: null, email: null, role: null }),
  isAuthenticated: false,
  isSessionChecked: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthResult>) => {
      const { userId, userName, email, role, accessToken } = action.payload;
      state.userId = userId;
      state.userName = userName;
      state.email = email;
      state.role = role;
      state.isAuthenticated = true;
      state.isSessionChecked = true;

      setAccessToken(accessToken);
      localStorage.setItem(
        "ufmdb_user",
        JSON.stringify({ userId, userName, email, role }),
      );
    },
    logout: (state) => {
      state.userId = null;
      state.userName = null;
      state.email = null;
      state.role = null;
      state.isAuthenticated = false;
      state.isSessionChecked = true;

      setAccessToken(null);
      localStorage.removeItem("ufmdb_user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
