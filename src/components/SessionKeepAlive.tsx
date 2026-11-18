"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export const SESSION_REFRESH_KEY = "session-refreshed-at";
const DAY_MS = 24 * 60 * 60 * 1000;

export function SessionKeepAlive() {
  useEffect(() => {
    const last = Number(localStorage.getItem(SESSION_REFRESH_KEY) ?? 0);
    if (Date.now() - last < DAY_MS) return;
    void authClient.getSession().then(({ data }) => {
      if (data) localStorage.setItem(SESSION_REFRESH_KEY, String(Date.now()));
    });
  }, []);

  return null;
}
