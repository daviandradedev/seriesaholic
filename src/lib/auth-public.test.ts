import { afterEach, describe, expect, it, vi } from "vitest";
import { appBaseUrlForHost, authHubUrlForHost } from "@/lib/auth-public";

describe("public urls", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps localhost targets on a local host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_AUTH_URL", "http://localhost:3100");

    expect(appBaseUrlForHost("localhost")).toBe("http://localhost:3000");
    expect(authHubUrlForHost("localhost")).toBe("http://localhost:3100");
  });

  it("ignores a localhost app url when the site is the production host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_AUTH_URL", "http://localhost:3100");

    expect(appBaseUrlForHost("seriesaholic.daviandrade.dev")).toBe("https://seriesaholic.daviandrade.dev");
    expect(authHubUrlForHost("seriesaholic.daviandrade.dev")).toBe("https://auth.daviandrade.dev");
  });

  it("uses the production app url on Vercel when the public url is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_AUTH_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(appBaseUrlForHost(null)).toBe("https://seriesaholic.daviandrade.dev");
    expect(authHubUrlForHost(null)).toBe("https://auth.daviandrade.dev");
  });
});
