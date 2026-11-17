// @vitest-environment jsdom
import { configureStore } from "@reduxjs/toolkit";
import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import auth, { logout, setCredentials } from "@/store/authSlice";
import { getAccessToken, setAccessToken } from "@/services/tokenStore";

afterEach(() => {
  cleanup();
  localStorage.clear();
  setAccessToken(null);
});

const account = { userId: "u1", userName: "viewer", email: "u@example.test", accessToken: "test-token" };

it.each([
  ["pending", true, ""],
  ["guest", false, "Login"],
  ["User", false, "Account"],
  ["User", true, "Home"],
  ["Admin", true, "Account"],
] as const)("routes %s with requireAdmin=%s", (role, requireAdmin, expected) => {
  const store = configureStore({ reducer: { auth } });
  if (role === "guest") store.dispatch(logout());
  if (role === "Admin" || role === "User") store.dispatch(setCredentials({ ...account, role }));

  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/login" element={<div>Login</div>} />
          <Route element={<ProtectedRoute requireAdmin={requireAdmin} />}>
            <Route path="/account" element={<div>Account</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  if (expected) expect(screen.getByText(expected)).toBeDefined();
  else expect(view.container.textContent).toBe("");
});

it("keeps only account metadata in storage and clears the session on logout", () => {
  const store = configureStore({ reducer: { auth } });
  store.dispatch(setCredentials({ ...account, role: "User" }));
  expect(getAccessToken()).toBe(account.accessToken);
  expect(JSON.parse(localStorage.getItem("ufmdb_user")!)).toEqual({
    userId: account.userId, userName: account.userName, email: account.email, role: "User",
  });
  store.dispatch(logout());
  expect(getAccessToken()).toBeNull();
  expect(localStorage.getItem("ufmdb_user")).toBeNull();
  expect(store.getState().auth).toMatchObject({ userId: null, isAuthenticated: false, isSessionChecked: true });
});
