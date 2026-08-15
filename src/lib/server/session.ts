import { cookies } from "next/headers";

const COOKIE = "insaeng_uid";

export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setUserId(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearUserId(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
