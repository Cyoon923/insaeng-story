/** 내부 보존 판단. 업무 상태나 삭제 허가를 대신하지 않는다. */
export type InquiryClassification = "unclassified" | "general" | "complaint" | "transaction" | "mixed";

export interface InquiryRetentionDecision {
  classification: InquiryClassification;
  resolvedAt: string | null;
  grounds: {
    code: "complaint-record" | "transaction-record";
    policyVersion: string;
    startsAt: string | null;
    endsAt: string | null;
  }[];
  hold: {
    reason: "classification-review" | "ongoing-handling" | "ongoing-dispute" | "legal-proceeding";
    reviewAt: string;
  } | null;
  complaintRecordIds: string[];
}

export interface InquiryRetention {
  version: 1;
  revision: number;
  decision: InquiryRetentionDecision;
  /** 이번 단계에서는 정리하지 않는다. 완료 시각을 관리자 입력으로 만들지 않는다. */
  scrubbedAt: null;
  history: {
    revision: number;
    actorId: string;
    at: string;
    decision: InquiryRetentionDecision;
  }[];
}

export type InquiryRetentionRead =
  | { kind: "unclassified" }
  | { kind: "invalid" }
  | { kind: "stored"; value: InquiryRetention };
