export async function fetchMe() {
  const res = await fetch("/api/app", { cache: "no-store" });
  return res.json();
}

export async function postApp(body: Record<string, unknown>) {
  const res = await fetch("/api/app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "요청에 실패했습니다.");
  }
  return data;
}

const DRAFT_KEY = "insaeng-draft";

export function saveDraft(flow: string, values: Record<string, string>) {
  if (typeof window === "undefined") return;
  const all = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<
    string,
    Record<string, string>
  >;
  all[flow] = { ...(all[flow] ?? {}), ...values };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
}

export function getDraft(flow: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const all = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<
    string,
    Record<string, string>
  >;
  return all[flow] ?? {};
}
