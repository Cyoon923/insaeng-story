/**
 * 불만·분쟁 기록의 값 규칙과 상태 전이 (Privacy-Complaint-Implementation-1, Step 1).
 *
 * 순수 규칙만 담는다. 저장하지 않고, 시각을 만들지 않고, 권한을 보지 않는다.
 * DB도 API도 화면도 아직 없다. 여기서 정한 규칙을 나중에 저장 계층이 마지막 관문
 * (조건부 UPDATE)으로 한 번 더 확인한다.
 *
 * 규칙의 뜻
 * - 분류(sourceType·category·status)는 고정 목록이다. 자유 문자열을 받지 않는다.
 *   고정되어야 대조·집계가 되고, 자유 입력은 곧 또 하나의 자유서술 저장소가 된다.
 * - summary는 상담원이 정리한 요지다. 대화 전문을 옮기는 자리가 아니므로 상한을 둔다.
 *   넘치면 잘라 담지 않고 거절한다. 조용히 자르면 뒤가 잘린 기록이 증빙으로 남는다.
 * - 전이는 open → handled 하나뿐이다. 되돌아가는 길도, 같은 상태로 가는 길도 없다.
 * - handled는 끝난 기록이다. 증빙 필드(분류·요지·연결)는 그 뒤로 바뀌지 않는다.
 *   사후 편집이 가능한 기록은 증빙 가치를 잃는다. 정정이 필요하면 새 기록을 만든다.
 *
 * import 경로가 상대경로인 이유는 다른 순수 모듈들과 같다(Node 내장 테스트 러너로 직접 실행).
 */
import type {
  ComplaintCategory,
  ComplaintSourceType,
  ComplaintStatus,
} from "@/lib/types/app";

/** summary 상한. 요지를 적는 자리이므로 대화 전문이 들어갈 수 없는 크기로 둔다. */
export const COMPLAINT_SUMMARY_MAX = 500;

export const COMPLAINT_SOURCE_TYPES = ["chat", "inquiry", "other"] as const satisfies
  readonly ComplaintSourceType[];

export const COMPLAINT_CATEGORIES = [
  "service",
  "payment",
  "consultation",
  "delivery",
  "privacy",
  "other",
] as const satisfies readonly ComplaintCategory[];

export const COMPLAINT_STATUSES = ["open", "handled"] as const satisfies
  readonly ComplaintStatus[];

/** 값이 잘못되었을 때 던진다. 호출부에서 400으로 바꿔 쓴다. */
export class ComplaintRecordError extends Error {}

export function isComplaintSourceType(value: unknown): value is ComplaintSourceType {
  return typeof value === "string" && (COMPLAINT_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isComplaintCategory(value: unknown): value is ComplaintCategory {
  return typeof value === "string" && (COMPLAINT_CATEGORIES as readonly string[]).includes(value);
}

export function isComplaintStatus(value: unknown): value is ComplaintStatus {
  return typeof value === "string" && (COMPLAINT_STATUSES as readonly string[]).includes(value);
}

/** 고정 목록의 값인지 확인한다. 아니면 거절한다. 비슷한 값을 골라 주지 않는다. */
export function requireComplaintSourceType(value: unknown): ComplaintSourceType {
  if (!isComplaintSourceType(value)) {
    throw new ComplaintRecordError("어디에서 접수된 불만인지 선택해 주세요.");
  }
  return value;
}

export function requireComplaintCategory(value: unknown): ComplaintCategory {
  if (!isComplaintCategory(value)) {
    throw new ComplaintRecordError("불만 분류를 선택해 주세요.");
  }
  return value;
}

/**
 * 요지 정규화. 앞뒤 공백을 덜어 내고, 비어 있거나 상한을 넘으면 거절한다.
 *
 * 문자열이 아닌 값을 String()으로 억지로 바꾸지 않는다. 객체가 요지로 들어오는 일을 막는다.
 * 길이는 코드 포인트가 아니라 문자열 길이로 센다. 화면 입력 제한과 같은 기준이어야
 * "500자까지"라는 안내와 서버 판정이 어긋나지 않는다.
 */
export function normalizeComplaintSummary(value: unknown): string {
  if (typeof value !== "string") {
    throw new ComplaintRecordError("불만 요지를 입력해 주세요.");
  }
  const summary = value.trim();
  if (!summary) {
    throw new ComplaintRecordError("불만 요지를 입력해 주세요.");
  }
  if (summary.length > COMPLAINT_SUMMARY_MAX) {
    throw new ComplaintRecordError(
      `불만 요지는 ${COMPLAINT_SUMMARY_MAX}자까지 입력할 수 있습니다.`,
    );
  }
  return summary;
}

/** 허용하는 전이. 여기에 없는 조합은 모두 거부한다. handled에서 나가는 길은 없다. */
export const COMPLAINT_TRANSITIONS = {
  open: ["handled"],
  handled: [],
} as const satisfies Record<ComplaintStatus, readonly ComplaintStatus[]>;

export function canTransitionComplaint(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return (COMPLAINT_TRANSITIONS[from] as readonly ComplaintStatus[]).includes(to);
}

/** 전이를 확인한다. 통과하면 다음 상태를 그대로 돌려준다. */
export function requireComplaintTransition(
  from: unknown,
  to: unknown,
): ComplaintStatus {
  if (!isComplaintStatus(from) || !isComplaintStatus(to)) {
    throw new ComplaintRecordError("처리 상태를 확인할 수 없습니다.");
  }
  if (!canTransitionComplaint(from, to)) {
    throw new ComplaintRecordError("이미 처리된 기록입니다.");
  }
  return to;
}

/** 증빙 필드(분류·요지·연결)를 아직 고칠 수 있는 상태인지. handled면 고칠 수 없다. */
export function canEditComplaintEvidence(status: ComplaintStatus): boolean {
  return status === "open";
}

/** 증빙 수정을 확인한다. handled 기록이면 거절한다. 정정은 새 기록으로 남긴다. */
export function requireComplaintEvidenceEditable(status: unknown): ComplaintStatus {
  if (!isComplaintStatus(status)) {
    throw new ComplaintRecordError("처리 상태를 확인할 수 없습니다.");
  }
  if (!canEditComplaintEvidence(status)) {
    throw new ComplaintRecordError("처리 완료된 기록은 수정할 수 없습니다.");
  }
  return status;
}
