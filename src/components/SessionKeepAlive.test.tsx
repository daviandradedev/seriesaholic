import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession: () => getSession() },
}));

const { SESSION_REFRESH_KEY, SessionKeepAlive } = await import("@/components/SessionKeepAlive");

describe("SessionKeepAlive", () => {
  beforeEach(() => {
    localStorage.clear();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: {}, user: {} } });
  });

  afterEach(() => {
    cleanup();
  });

  it("renews the session once and remembers when it did", async () => {
    render(<SessionKeepAlive />);
    await vi.waitFor(() => expect(localStorage.getItem(SESSION_REFRESH_KEY)).not.toBeNull());
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("skips the request when the session was renewed in the last day", () => {
    localStorage.setItem(SESSION_REFRESH_KEY, String(Date.now() - 60 * 60 * 1000));
    render(<SessionKeepAlive />);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("does not record a renewal when there is no session", async () => {
    getSession.mockResolvedValue({ data: null });
    render(<SessionKeepAlive />);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(SESSION_REFRESH_KEY)).toBeNull();
  });
});
