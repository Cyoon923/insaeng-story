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

/**
 * 미완료 신청 draft를 브라우저에 두는 한도. 7일.
 *
 * 접수를 끝내지 않고 이탈하면 이름·연락처·사주정보·사연이 localStorage에 남는다.
 * 그 개인정보가 브라우저에 오래 잔존하지 않게 하려고 둔 값이다.
 */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * flow 1개의 저장 형태. 입력값과 마지막 저장 시각을 분리해 담는다.
 *
 * savedAt을 values 안에 넣지 않는 이유는, values가 신청 details로 그대로
 * 서버에 올라가기 때문이다(components/apply/PaySubmit.tsx). 섞으면 API payload가 바뀐다.
 */
interface DraftEntry {
  values: Record<string, string>;
  /** 마지막 저장 시각(브라우저 기준 ISO). 서버 시간을 쓰지 않는다. */
  savedAt: string;
}

/** localStorage 한 칸을 읽는다. 값이 없거나 깨져 있으면 빈 저장소로 본다. */
function readDraftStore(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeDraftStore(store: Record<string, unknown>) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
  } catch {
    // 저장에 실패해도 신청 진행 자체는 막지 않는다.
  }
}

/**
 * 살아 있는 draft만 돌려준다. 만료·형식 불량·savedAt 없음은 모두 null이다.
 *
 * savedAt이 없는 예전 draft도 null로 본다. 언제 저장됐는지 알 수 없어
 * 7일을 판정할 수 없고, 알 수 없는 개인정보를 계속 들고 있지 않는 쪽을 택한다.
 */
function liveEntry(value: unknown, now: number): DraftEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  const values = entry.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  if (typeof entry.savedAt !== "string") return null;
  const savedAt = Date.parse(entry.savedAt);
  if (!Number.isFinite(savedAt)) return null;
  // 시계가 뒤로 간 경우(savedAt이 미래)는 7일이 지난 것으로 보지 않는다.
  if (now - savedAt > DRAFT_TTL_MS) return null;
  return { values: values as Record<string, string>, savedAt: entry.savedAt };
}

export function saveDraft(flow: string, values: Record<string, string>) {
  if (typeof window === "undefined") return;
  const store = readDraftStore();
  // 살아 있는 값에만 이어 붙인다. 만료·형식 불량 draft는 되살리지 않고 새로 시작한다.
  const live = liveEntry(store[flow], Date.now());
  const entry: DraftEntry = {
    values: { ...(live?.values ?? {}), ...values },
    savedAt: new Date().toISOString(),
  };
  store[flow] = entry;
  writeDraftStore(store);
}

/** 신청이 서버에서 정상 접수된 뒤에만 해당 플로우 draft를 지운다. 다른 플로우는 그대로 둔다. */
export function clearDraft(flow: string) {
  if (typeof window === "undefined") return;
  const store = readDraftStore();
  if (!(flow in store)) return;
  delete store[flow];
  writeDraftStore(store);
}

/**
 * 저장된 입력값. 7일이 지났거나 판정할 수 없는 draft는 돌려주지 않고 그 자리에서 지운다.
 * 지우는 것은 해당 flow 하나뿐이고 다른 flow는 건드리지 않는다.
 */
export function getDraft(flow: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  const store = readDraftStore();
  if (!(flow in store)) return {};
  const live = liveEntry(store[flow], Date.now());
  if (!live) {
    delete store[flow];
    writeDraftStore(store);
    return {};
  }
  return live.values;
}

/** 테스트용 내부 값. 런타임 동작에는 영향을 주지 않는다. */
export const __draftInternals = { DRAFT_KEY, DRAFT_TTL_MS };
