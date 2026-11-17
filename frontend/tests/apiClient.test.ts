import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, expect, it, vi } from "vitest";
import api from "@/services/apiClient";
import { getAccessToken, setAccessToken } from "@/services/tokenStore";

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  setAccessToken(null);
  vi.unstubAllGlobals();
});

function response(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return { config, status, statusText: String(status), data, headers: new AxiosHeaders() };
}

function rejectStatus(config: InternalAxiosRequestConfig, status: number): never {
  throw new AxiosError(String(status), undefined, config, undefined, response(config, status, null));
}

it("refreshes once when two requests expire and retries both with the new bearer", async () => {
  setAccessToken("old");
  let finishRefresh!: () => void;
  const gate = new Promise<void>(resolve => { finishRefresh = resolve; });
  const expired: string[] = [];
  let refreshes = 0;

  api.defaults.adapter = async config => {
    if (config.url === "/auth/refresh") {
      refreshes++;
      await gate;
      return response(config, 200, { accessToken: "renewed" });
    }
    if (config.headers.Authorization === "Bearer old") {
      expired.push(config.url!);
      rejectStatus(config, 401);
    }
    expect(config.headers.Authorization).toBe("Bearer renewed");
    return response(config, 200, config.url);
  };

  const requests = Promise.all([api.get("/profile"), api.get("/notifications")]);
  try {
    await vi.waitFor(() => {
      expect(expired).toHaveLength(2);
      expect(refreshes).toBe(1);
    });
  } finally { finishRefresh(); }
  expect((await requests).map(r => r.data)).toEqual(["/profile", "/notifications"]);
  expect(refreshes).toBe(1);
  expect(getAccessToken()).toBe("renewed");
});

it("clears the token and returns to login when refresh is denied", async () => {
  vi.stubGlobal("window", { location: { href: "/" } });
  setAccessToken("expired");
  const calls: string[] = [];
  api.defaults.adapter = async config => {
    calls.push(config.url!);
    rejectStatus(config, 401);
  };
  await expect(api.get("/profile")).rejects.toMatchObject({ response: { status: 401 } });
  expect(calls).toEqual(["/profile", "/auth/refresh"]);
  expect(getAccessToken()).toBeNull();
  expect(window.location.href).toBe("/login");
});

it("preserves the session on an ordinary server failure", async () => {
  setAccessToken("current");
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => rejectStatus(config, 503));
  api.defaults.adapter = adapter;
  await expect(api.get("/movies")).rejects.toMatchObject({ response: { status: 503 } });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(getAccessToken()).toBe("current");
});
