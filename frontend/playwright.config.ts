import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

const database = process.env.UFMDB_E2E_POSTGRES;
if (!database) throw new Error("Set UFMDB_E2E_POSTGRES to a disposable test database.");

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "dotnet run --no-build -c Release --no-launch-profile --project ../backend/src/UFMDb.API",
      url: "http://127.0.0.1:5180/api/genres",
      env: {
        ASPNETCORE_URLS: "http://127.0.0.1:5180",
        ConnectionStrings__DefaultConnection: database,
        JwtSettings__Secret: randomBytes(32).toString("hex"),
        JwtSettings__Issuer: "ufmdb-e2e",
        JwtSettings__Audience: "ufmdb-e2e-client",
      },
      timeout: 90000,
    },
    {
      command: "vite build --mode test --outDir dist-e2e && vite preview --outDir dist-e2e --config e2e/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort",
      env: { VITE_API_URL: "" },
      url: "http://127.0.0.1:4173",
    },
  ],
});
