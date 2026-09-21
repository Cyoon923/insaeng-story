/**
 * 불만 기록 관리자 API의 입력 읽기와 실패 응답 (Privacy-Complaint-Implementation-3, Step 3).
 *
 * 순수 모듈이다. 저장하지 않고, 권한을 보지 않고, next/server를 부르지 않는다.
 * route는 여기서 좁혀진 값만 저장 계층에 넘긴다.
 *
 * 왜 body를 여기서 좁히는가
 * - 관리자가 정하는 값과 서버가 정하는 값을 한곳에서 갈라 두기 위해서다.
 *   status·createdAt·handledAt·handledBy는 이 파일이 아예 읽지 않는다.
 *   읽지 않으면 클라이언트가 보내도 저장 계층에 닿지 않는다.
 * - 이름·연락처·guest token·원본 문의 id·대화 본문·금액·PG 정보도 같은 이유로 읽지 않는다.
 *
 * 분류(sourceType·category)와 요지(summary)의 값 규칙은 여기서 판단하지 않는다.
 * complaintRecordRules가 정하고 저장 계층이 부른다. 규칙을 두 곳에 적지 않는다.
 *
 * import 경로가 없는 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */

/** 승격 요청에서 읽는 값. 여기 없는 키는 저장 계층에 닿지 않는다. */
export interface CreateComplaintRecordBody {
  sourceType: unknown;
  category: unknown;
  summary: unknown;
  userId: string | null;
  orderId: string | null;
}

/** 빈 문자열과 "없음"을 섞지 않는다. 문자열이 아니면 없는 것으로 본다. */
function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

/**
 * 승격 요청 읽기.
 *
 * sourceType·category·summary는 값 판정을 하지 않고 그대로 넘긴다. 저장 계층이
 * complaintRecordRules로 거른다. 여기서 미리 걸러 두면 같은 규칙이 두 곳에 생긴다.
 */
export function readCreateComplaintRecordBody(
  body: Record<string, unknown>,
): { ok: true; body: CreateComplaintRecordBody } {
  return {
    ok: true,
    body: {
      sourceType: body.sourceType,
      category: body.category,
      summary: body.summary,
      // 회원·주문 연결은 선택이다. 값이 없으면 null로 남는다.
      userId: optionalText(body.userId),
      orderId: optionalText(body.orderId),
    },
  };
}

/** 처리 완료 요청 읽기. 관리자가 정하는 값은 어떤 기록인지 하나뿐이다. */
export function readMarkComplaintHandledBody(
  body: Record<string, unknown>,
): { ok: true; complaintRecordId: string } | { ok: false; error: string; status: number } {
  const complaintRecordId =
    typeof body.complaintRecordId === "string" ? body.complaintRecordId.trim() : "";
  if (!complaintRecordId) {
    return { ok: false, error: "불만 기록을 확인해 주세요.", status: 400 };
  }
  return { ok: true, complaintRecordId };
}

/** 처리 완료 실패 사유. 저장 계층의 결과를 그대로 받는다. */
export type MarkComplaintHandledFailure = "already-handled" | "not-found";

/**
 * 실패 응답.
 *
 * 어떤 회원의 어떤 건인지 드러내지 않는다. 관리자 목록(GET)이 근거를 이미 준다.
 * 이미 처리된 것과 없는 것을 같은 문구로 뭉뚱그리지 않는다. 관리자가 다음에
 * 무엇을 해야 하는지가 달라지기 때문이다.
 */
export function markComplaintHandledFailureResponse(reason: MarkComplaintHandledFailure): {
  error: string;
  status: number;
} {
  switch (reason) {
    case "not-found":
      return { error: "불만 기록을 찾을 수 없습니다.", status: 404 };
    case "already-handled":
      return {
        error: "이미 처리 완료된 기록입니다. 새로고침 후 현재 상태를 확인해 주세요.",
        status: 409,
      };
  }
}
