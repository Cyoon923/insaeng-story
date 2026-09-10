/** 실제 요청 1건. 응답 처리 방식은 기존과 같다. */
async function requestMe() {
  const res = await fetch("/api/app", { cache: "no-store" });
  return res.json();
}

/**
 * 진행 중인 요청. 같은 화면에서 여러 컴포넌트가 동시에 부를 때 요청을 합치기 위한 것이고,
 * 끝난 응답을 보관하지는 않는다.
 */
let inFlightMe: ReturnType<typeof requestMe> | null = null;

export async function fetchMe() {
  if (!inFlightMe) {
    // 성공이든 실패든(JSON 파싱 실패 포함) 끝나면 참조를 비워
    // 다음 호출이 항상 새 요청을 보내게 한다.
    inFlightMe = requestMe().finally(() => {
      inFlightMe = null;
    });
  }
  return inFlightMe;
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

/** 신청이 서버에서 정상 접수된 뒤에만 해당 플로우 draft를 지운다. 다른 플로우는 그대로 둔다. */
export function clearDraft(flow: string) {
  if (typeof window === "undefined") return;
  const all = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<
    string,
    Record<string, string>
  >;
  if (!(flow in all)) return;
  delete all[flow];
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
