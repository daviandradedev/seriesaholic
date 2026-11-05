import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const getSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  }),
);

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
