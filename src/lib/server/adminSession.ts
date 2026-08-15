import { cookies } from "next/headers";

const COOKIE = "insaeng_admin";

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE)?.value === "1";
}

export async function setAdminAuthenticated(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "insaeng-admin";
}
