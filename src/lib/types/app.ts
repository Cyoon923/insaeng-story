export type ProductId = "story" | "premium" | "saju-song";
export type CouponProduct = ProductId | "consultation";
/** 주문에 기록되는 상품. 1:1 사주상담도 결제 귀속을 위해 주문으로 남긴다. */
export type OrderProduct = ProductId | "consultation";
export type OrderStatus = "신청접수" | "상담진행" | "제작중" | "완성/전달" | "완료";
export type ConsultStatus = "상담 신청" | "사주정보 입력" | "선생님과 1:1 상담" | "상담 완료";

/**
 * 동의 1건의 증빙.
 * IP·User-Agent처럼 그 자체가 개인정보인 값은 담지 않는다(최소수집).
 */
export interface ConsentRecord {
  agreed: boolean;
  /** 동의로 전환된 시각(ISO). 철회한 뒤에도 마지막 동의 시각으로 남긴다. */
  agreedAt?: string;
  /** 동의 당시 적용된 약관/정책 버전. 서버가 상수(lib/constants/legal.ts)에서 채운다. */
  version: string;
  /** 동의에서 미동의로 전환된 시각(ISO). 마케팅 항목에만 쓴다. */
  revokedAt?: string;
}

/** history에 남기는 필수 동의의 종류. 마케팅은 아직 이 축에 넣지 않는다. */
export type ConsentEventType = "terms" | "privacy";

/**
 * 동의 행위 1건. 뒤에만 붙이고 고치지 않는다(append-only).
 *
 * ConsentRecord가 "지금 어떤 상태인가"라면 이쪽은 "언제 무엇에 답했는가"다.
 * 약관이 개정되어 다시 동의를 받으면 현재 상태는 덮어써지지만 이 기록은 남는다.
 *
 * 회원 식별자를 담지 않는다. User.consents 안에 있어 소속이 이미 정해져 있고,
 * 같은 식별자를 한 벌 더 두면 지울 곳만 늘어난다.
 * 이름·연락처·IP·User-Agent도 담지 않는다(ConsentRecord와 같은 최소수집 원칙).
 */
export interface ConsentEvent {
  type: ConsentEventType;
  agreed: boolean;
  /** 그 답을 한 시각(ISO). 서버가 만든다. 클라이언트 값은 쓰지 않는다. */
  occurredAt: string;
  /** 그때 적용된 문서 버전. 서버가 상수(lib/constants/legal.ts)에서 채운다. */
  version: string;
}

/**
 * 회원 동의 묶음.
 *
 * 키가 없으면 "묻지 않았음(기록 없음)", agreed: false는 "물었고 동의하지 않음"이다.
 * 이 둘을 구분해야 기존 회원에게 동의를 소급 생성하지 않을 수 있다.
 */
export interface UserConsents {
  /** [필수] 이용약관. */
  terms?: ConsentRecord;
  /** [필수] 개인정보 수집 및 이용. */
  privacy?: ConsentRecord;
  /** [선택] 광고성 SMS 수신. */
  marketingSms?: ConsentRecord;
  /** [선택] 광고성 이메일 수신. */
  marketingEmail?: ConsentRecord;
  /** [선택] 카카오톡 등 광고성 메시지 수신. */
  marketingKakao?: ConsentRecord;

  /**
   * 필수 동의(terms·privacy)의 행위 기록. 뒤에만 붙인다.
   *
   * 위의 terms·privacy는 "지금 상태"이고 이쪽이 "그렇게 된 내력"이다. 둘은 같은
   * 순간·같은 버전으로 함께 만들어지며, 다시 동의를 받으면 위는 덮어써지고
   * 여기에는 한 줄이 더 붙는다.
   *
   * 값이 없는 것은 "동의한 적 없음"이 아니라 **이 구조가 생기기 전**이라는 뜻이다.
   * 그런 회원에게는 terms·privacy 레코드 자체가 최초 동의 증빙이며,
   * 그 값을 여기로 옮겨 만들지 않는다(소급 생성 없음).
   */
  history?: ConsentEvent[];
}

export interface User {
  id: string;
  phone: string;
  email: string;
  name: string;
  gender: "male" | "female" | "";
  birth: string;
  birthTime: string;
  unknownTime: boolean;
  calendar: "solar" | "lunar";
  bloodType: string;
  points: number;
  createdAt: string;
  /**
   * 일반 로그인에 쓰는 아이디. 내부 식별자인 id와는 완전히 별개의 값이다.
   * 소문자로 정규화해 저장한다(store.ts의 normalizeLoginId).
   * 카카오·네이버 회원은 없이도 존재할 수 있어 선택 항목이다.
   */
  loginId?: string;
  /** scrypt 해시(`salt:hash`). 가입 시에만 설정되며 기존 회원에는 없다. */
  passwordHash?: string;
  /**
   * 마케팅 정보 수신 동의(선택 항목).
   *
   * @deprecated 채널별 동의(consents.marketingSms / marketingEmail / marketingKakao)로
   * 대체할 예정이다. 이미 저장된 회원 데이터와의 호환을 위해 필드와 동작은 그대로 둔다.
   * 지우면 저장된 JSON에는 값이 남아 있는데 타입에서만 사라진다.
   */
  marketingAgreed?: boolean;
  /**
   * 약관·마케팅 동의 증빙. 이 구조가 생기기 전에 가입한 회원은 undefined이며,
   * 자동으로 채우지 않는다(동의한 적 없는 기록을 만들지 않기 위해서다).
   * 읽는 쪽은 항상 선택적 접근으로 다룬다.
   */
  consents?: UserConsents;
  /** 카카오 로그인으로 연결된 계정의 카카오 사용자 ID. 소셜 가입자에게만 있다. */
  kakaoId?: string;
  /** 네이버 로그인으로 연결된 계정의 네이버 사용자 ID. 소셜 가입자에게만 있다. */
  naverId?: string;
  /**
   * 탈퇴 시각(ISO). 값이 있으면 탈퇴한 회원이며 로그인 회원으로 인정하지 않는다.
   * 거래 기록을 남겨야 해서 행 자체는 지우지 않고 개인정보만 비운다.
   */
  withdrawnAt?: string;
}

export interface Order {
  id: string;
  userId: string;
  product: OrderProduct;
  title: string;
  status: OrderStatus;
  /** 쿠폰·추천인·적립금을 적용한 뒤의 최종 결제 예정 금액. */
  amount: number;
  /**
   * 할인 전 금액. 상품 기본가 + 서버가 인정한 유료 옵션가로,
   * 서버가 계산한 값만 들어간다. 이전에 만들어진 주문에는 없다.
   */
  baseAmount?: number;
  payment: string;
  details: Record<string, string>;
  createdAt: string;
  /**
   * 맞춤 제작에 실제로 착수한 시각(UTC ISO). 서버가 진행 상태를 처음
   * "제작중"으로 바꿀 때 한 번만 기록하고, 이후에는 절대 덮어쓰지 않는다.
   *
   * 값이 없는 것은 "제작 전"이 아니라 "기록 없음(판정 불가)"이다.
   * 이 구조가 생기기 전 주문에는 값이 없으며 소급해 만들지 않는다.
   * 환불 판단에 쓰는 증거이므로 클라이언트 값은 받지 않는다.
   */
  productionStartedAt?: string;

  /**
   * 서비스 결과물을 처음 전달한 시각(UTC ISO).
   *
   * status가 처음 "완성/전달"이 될 때 서버가 남긴다. 개인정보 보관 기간의
   * 기산점으로 쓰기 위한 값이라, 한 번 기록되면 절대 덮어쓰지 않는다.
   * 상태가 다른 값으로 갔다가 다시 "완성/전달"이 되어도 처음 시각이 그대로 남는다.
   *
   * 이 구조가 생기기 전의 주문에는 없다. 없으면 "기록 없음"이며, createdAt이나
   * updatedAt으로 대신 채우지 않는다(다른 뜻의 값이다).
   */
  deliveredAt?: string;
  /**
   * 신청 단계에서 받은 [필수] 동의(취소·환불 안내 포함)의 증빙.
   *
   * 회원가입 동의(User.consents)와는 완전히 별개다. 주문 1건마다 그때의
   * 시각과 문구 버전(ORDER_CONSENT_VERSION)을 서버가 채운다.
   *
   * 상담 신청도 같은 id의 주문이 함께 만들어지므로 이 한 곳에만 남긴다
   * (Consultation에는 따로 두지 않는다).
   * 이 구조가 생기기 전 주문에는 없으며 소급해 만들지 않는다.
   */
  refundConsent?: ConsentRecord;
  /**
   * 신청 단계에서 받은 [필수] 저작권·창작물 이용 동의의 증빙.
   *
   * refundConsent와 축이 다르다. 화면에서 체크박스가 따로 있고 따로 눌리므로
   * 동의 여부도 따로 본다. 다만 한 요청에서 함께 확인되었다면 시각은 같다
   * (서버가 그 요청에서 만든 값 하나를 두 레코드가 나눠 쓴다).
   *
   * 인생곡(story·premium·saju-song)에만 있다. 1:1 사주상담에는 저작권 동의
   * 화면 자체가 없어 이 키를 만들지 않는다("기록 없음").
   * 이 구조가 생기기 전 주문에도 없으며 소급해 만들지 않는다.
   */
  copyrightConsent?: ConsentRecord;

  /**
   * 보관 기간이 끝나 콘텐츠성 개인정보를 지운 시각(UTC ISO).
   *
   * 뜻은 하나다. "이 주문에 대해 보관 만료 scrub이 **전부** 성공했다."
   * 실제 scrub과 같은 성공 경계 안에서만 기록되며, 일부만 반영되었거나 저장이
   * 겹쳐 밀린 경우에는 남지 않는다(lib/server/store.ts scrubOrderForRetentionOnce).
   *
   * 한 번 기록되면 덮어쓰지 않는다(COALESCE). 다시 실행해도 최초 시각이 남는다.
   * 상담 주문이면 같은 id의 상담까지 함께 끝났다는 뜻이다. 상담 쪽에 같은 시각을
   * 따로 두지 않는다(두 벌이 되면 어긋날 수 있다).
   *
   * 값이 없는 것은 "아직 하지 않음"이며, 완료 증빙(deliveredAt·completedAt)이나
   * updatedAt으로 대신 판단하지 않는다.
   */
  retentionScrubbedAt?: string;
}

export interface Consultation {
  id: string;
  userId: string;
  teacher: string;
  /** 화면·안내에 쓰는 한국어 표시 문구. 예) "8월 12일(화) 오전 10:00" */
  datetime: string;
  /**
   * 예약 시각(UTC ISO). 한국 기준 날짜·시각을 +09:00으로 변환해 서버가 채운다.
   * 이 구조가 생기기 전 예약에는 없다. 없으면 "기록 없음"이며 표시 문구에서
   * 연도를 추론해 만들어 넣지 않는다. 읽는 쪽은 항상 선택적 접근으로 다룬다.
   */
  scheduledAt?: string;
  /**
   * 상담 목적. 신청 화면의 고정 선택지를 " / "로 이은 값이다.
   *
   * 선택 항목인 이유는 보관 기간이 끝난 건에서 빠지기 때문이다
   * (lib/server/retentionScrub.ts scrubConsultationForRetention).
   * 값이 없는 것은 "적지 않았거나 보관 기간이 끝나 지워졌음"이며, 읽는 쪽은
   * 언제나 선택적 접근으로 다룬다. 빈 문자열을 대신 넣지 않는다.
   */
  purpose?: string;
  method: string;
  option: string;
  status: ConsultStatus;
  amount: number;
  details: Record<string, string>;
  createdAt: string;
  /**
   * 상담이 끝난 시각(UTC ISO).
   *
   * status가 처음 "상담 완료"가 될 때 서버가 남긴다. 개인정보 보관 기간의
   * 기산점으로 쓰기 위한 값이라, 한 번 기록되면 절대 덮어쓰지 않는다.
   * 상태가 되돌아갔다가 다시 "상담 완료"가 되어도 처음 시각이 그대로 남는다.
   *
   * 이 구조가 생기기 전의 상담에는 없다. 없으면 "기록 없음"이며, createdAt이나
   * scheduledAt으로 대신 채우지 않는다(예약 시각은 실제 완료와 다른 값이다).
   */
  completedAt?: string;

  /**
   * 보관 기간이 끝나 이 상담의 콘텐츠성 개인정보를 지운 시각(UTC ISO).
   *
   * **짝이 되는 주문이 없는 상담에만** 쓴다. 주문이 있는 상담은 그 주문의
   * Order.retentionScrubbedAt이 완료 증빙이며, 같은 뜻의 시각을 두 벌 두지 않는다
   * (두 벌이 되면 어긋날 수 있다).
   *
   * 한 번 기록되면 덮어쓰지 않는다. 다시 실행해도 최초 시각이 남는다.
   * 값이 없는 것은 "아직 하지 않음"이며, completedAt이나 createdAt으로 대신
   * 판단하지 않는다(lib/server/store.ts scrubOrphanConsultationForRetentionOnce).
   */
  retentionScrubbedAt?: string;
}

export interface Inquiry {
  id: string;
  /** 비회원 문의도 접수할 수 있어 회원 문의에만 채워진다. */
  userId?: string;
  name: string;
  phone: string;
  method: string;
  product: string;
  message: string;
  createdAt: string;
}

export interface BlockedSlot {
  teacher: string;
  date: string;
  time: string;
}

export interface AdminPromo {
  code: string;
  percent: number;
  createdAt: string;
}

export interface Coupon {
  id: string;
  title: string;
  desc: string;
  createdAt: string;
  product?: CouponProduct;
  usedAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind?: "coupon" | "promo";
}

export interface NotificationSettings {
  order: boolean;
  consult: boolean;
  notice: boolean;
}

export interface Review {
  id: string;
  /** 작성 회원 id. 탈퇴 비식별화 때 키 자체가 제거되므로 없으면 탈퇴 회원의 후기다. */
  userId?: string;
  name: string;
  title: string;
  rating: number;
  text: string;
  createdAt: string;
  visible: boolean;
  kind?: "story" | "premium" | "saju-song" | "consultation";
  /** 후기를 남긴 대상. "order:<주문id>" 또는 "consult:<상담id>". 한 대상에 하나만 남길 수 있다. */
  targetKey: string;
}

/**
 * 인증번호 저장 형태. attempts/sentAt은 무제한 인증 시도와
 * 재발송 남용을 막기 위한 값이라 발급 코드에만 채운다.
 */
export interface VerificationCode {
  code: string;
  expiresAt: number;
  attempts?: number;
  sentAt?: number;
}

/**
 * 결제 상태. NICEPAY가 돌려주는 status 값을 그대로 담는다.
 * 서비스 진행 상태(OrderStatus)와는 완전히 별개이며 섞어 쓰지 않는다.
 */
export type PaymentStatus =
  | "ready"
  // 승인 API를 부르기 직전에 한 요청만 선점하는 중간 상태.
  // 같은 결제로 콜백이 두 번 들어와도 두 번째는 여기서 막힌다.
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "partialCancelled";

/**
 * 결제 1건. 주문이 만들어지기 전(결제 준비 단계)에도 행이 생기므로 orderId는 비어 있을 수 있다.
 * orderSnapshot은 승인 성공 뒤 주문·상담을 만들기 위한 신청 정보 사본이고,
 * raw는 PG 응답 원문이다. 두 값의 용도를 섞지 않는다.
 */
export interface Payment {
  id: string;
  /** 승인 성공 후 주문을 만들고 나서 채운다. 준비 단계에서는 null. */
  orderId: string | null;
  provider: string;
  /** 결제창에 넘기는 주문번호. 결제 준비 1건당 하나이며 중복될 수 없다. */
  merchantOrderId: string;
  /** PG 거래 키. 승인 전에는 null. */
  pgTid: string | null;
  requestedAmount: number;
  approvedAmount: number | null;
  cancelledAmount: number;
  status: PaymentStatus;
  method: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  /** 결제 성공 후 Order/Consultation을 만들기 위한 신청 정보 스냅샷. */
  orderSnapshot: Record<string, unknown> | null;
  /** 승인 API 응답 원문. 취소 응답으로 덮지 않는다(아래 cancelResponseRaw 참고). */
  raw: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;

  /**
   * ── 취소 시도 감사 기록 ──
   *
   * 실제 취소가 되었는지와는 별개로, "언제 무엇을 시도했고 무엇을 돌려받았는지"를
   * 남기는 자리다. 승인 증거(raw·approvedAmount·approvedAt)는 그대로 두고
   * 여기에만 쓴다. 값이 없으면 아직 취소를 시도한 적이 없다는 뜻이다.
   */
  cancelAttemptedAt?: string | null;
  cancelResultKind?: PaymentCancelResultKind | null;
  /** PG가 돌려준 결과 코드. 사람이 확인할 때 쓰는 값이라 그대로 담는다. */
  cancelResultCode?: string | null;
  cancelResultMessage?: string | null;
  /** 취소 응답 원문. 승인 응답(raw)과 섞지 않는다. */
  cancelResponseRaw?: Record<string, unknown> | null;

  /**
   * 취소 실행 단계. 결제 상태(status)와는 다른 축이다.
   *
   * status는 PG가 말하는 결제 사실이고, 이 값은 "우리가 취소 실행을 어디까지
   * 진행했는가"다. 둘을 한 칸에 담으면 취소를 시도하는 순간 승인 사실이 흐려진다.
   * 값이 없으면 취소 실행을 시작한 적이 없다는 뜻이다.
   */
  cancelExecutionStatus?: PaymentCancelExecutionStatus | null;
  /** 취소 실행권을 선점한 시각. 서버(DB now())가 만든다. */
  cancelClaimedAt?: string | null;
}

/**
 * 취소 실행 단계.
 *
 * - processing : 이 결제의 취소 실행권을 선점했다. PG 요청 성공을 뜻하지 않는다.
 * - succeeded  : PG 취소 성공을 확정했다.
 * - declined   : PG가 분명히 거절했다.
 * - unknown    : 실제 취소 여부를 확정할 수 없다.
 *
 * 세 결과(succeeded·declined·unknown)는 모두 끝난 값이다. 다시 선점할 수 없다.
 * 특히 unknown은 "다시 해도 되는 상태"가 아니다. 실제로는 취소되었을 수 있어
 * 자동으로 다시 취소하면 이중 환불이 된다. 사람이 확인한 뒤 별도의 복구 절차를
 * 만들기 전까지, 선점은 값이 없는(NULL) 결제에서만 가능하다.
 */
export type PaymentCancelExecutionStatus =
  | "processing"
  | "succeeded"
  | "declined"
  | "unknown";

/**
 * 취소 시도의 결과 종류. 승인 경로(NicepayApproveKind)와 같은 사고방식이다.
 *
 * - succeeded : PG가 취소되었다고 분명히 답했다.
 * - declined  : PG가 정상 응답했고 그 내용이 분명한 취소 실패다.
 * - unknown   : 통신 오류·5xx·본문 파싱 실패 등으로 결과를 확정할 수 없다.
 *
 * unknown은 실패가 아니다. 실제로는 취소되었을 수 있으므로 자동으로 다시 취소하지
 * 않는다. 거래조회나 사람 확인으로 결론을 낸다(이중 환불을 막기 위해서다).
 */
export type PaymentCancelResultKind = "succeeded" | "declined" | "unknown";

/**
 * 환불 문의 1건의 처리 상태.
 *
 * requested / reviewing은 아직 결론이 나지 않은 "활성" 상태다.
 * 한 주문에 활성 요청은 최대 1건만 존재할 수 있으며, 그 방어선은
 * refund_requests의 부분 UNIQUE 인덱스다(lib/server/refundRequests.ts).
 *
 * 서비스 진행 상태(OrderStatus)·결제 상태(PaymentStatus)와는 완전히 별개의
 * 축이며 섞어 쓰지 않는다.
 */
export type RefundRequestStatus =
  | "requested"
  | "reviewing"
  | "approved"
  | "rejected"
  | "completed";

/**
 * 환불 문의 1건. 주문 1건(Order.id)에 귀속된다.
 *
 * 1:1 사주상담도 같은 id의 주문이 함께 만들어지므로(applyOrder.ts commitConsultation)
 * 이 한 가지 구조로 인생곡과 상담을 모두 가리킨다.
 *
 * userId·requestedAt·최초 status는 클라이언트가 정하지 않는다. 서버가 주문 행에서
 * 읽거나 직접 만든다.
 */
/**
 * 고객이 고르는 환불 문의 사유.
 *
 * 법률문구와 세부 UX가 아직 확정되지 않았으므로 일부러 잘게 나누지 않았다.
 * 관리자가 취소·환불 정책과 대조할 수 있을 만큼의 범용 분류만 둔다.
 * 자유 문자열을 쓰지 않는 이유는 분류가 고정되어야 통계·대조가 가능해서다.
 */
export type RefundRequestReason =
  /** 단순 변심. */
  | "change-of-mind"
  /** 일정 변경·취소. */
  | "schedule"
  /** 제공된 서비스에 문제가 있음. */
  | "service-issue"
  /** 중복 결제·오결제. */
  | "duplicate-payment"
  /** 위 분류에 들어가지 않음. 이때만 message가 필수다. */
  | "other";

/**
 * 환불 문의 1건. 주문 1건(Order.id)에 귀속된다.
 *
 * 1:1 사주상담도 같은 id의 주문이 함께 만들어지므로(applyOrder.ts commitConsultation)
 * 이 한 가지 구조로 인생곡과 상담을 모두 가리킨다.
 *
 * userId·requestedAt·최초 status·snapshot 값들은 클라이언트가 정하지 않는다.
 * 서버가 주문 행에서 읽거나 직접 만든다.
 */
export interface RefundRequest {
  id: string;
  /** 귀속 주문. orders(id)를 참조한다. */
  orderId: string;
  /** 주문 행의 소유자. 요청자가 보낸 값이 아니라 주문에서 읽은 값이다. */
  userId: string;
  status: RefundRequestStatus;
  /** 접수 시각(UTC ISO). 서버가 만든다. */
  requestedAt: string;
  /** 고객이 고른 사유. */
  reason: RefundRequestReason;
  /** 고객이 적은 상세 내용. 적지 않았으면 없다. reason이 "other"면 반드시 있다. */
  message?: string;

  /**
   * 접수 시점의 Order.productionStartedAt 사본.
   *
   * 원본은 관리자가 진행 상태를 "제작중"으로 바꾸는 순간 처음 기록되므로,
   * 접수 뒤에 값이 새로 생길 수 있다. 그때 원본만 보면 "제작 전에 접수했다"는
   * 사실이 나중에 뒤집히기 때문에 접수 당시 값을 따로 고정한다.
   *
   * null은 "제작 전"이 아니라 "기록 없음(판정 불가)"이다. 원본과 같은 규칙이며
   * 이 값만으로 제작 착수 여부를 단정하지 않는다.
   */
  productionStartedAtSnapshot?: string | null;
  /**
   * 상담 주문일 때 접수 시점의 Consultation.scheduledAt 사본.
   * null은 "예약 절대시각 기록 없음"이다. 표시 문구에서 추론해 만들지 않는다.
   */
  scheduledAtSnapshot?: string | null;
  /**
   * 상담 주문일 때, 접수 그 순간을 기준으로 내린 취소창 판정 결과.
   * 판정에 쓴 시각은 requestedAt과 같은 순간이다.
   *
   * 구조는 lib/server/consultationCancelWindow.ts의 ConsultationCancelWindow와 같다.
   * 타입 파일이 서버 모듈을 참조하지 않도록 같은 모양을 여기에 적어 둔다.
   */
  cancelWindowSnapshot?: RefundRequestCancelWindowSnapshot | null;
  /**
   * 위 판정에 쓴 규칙의 버전(CONSULTATION_CANCEL_WINDOW_POLICY_VERSION).
   *
   * 동의 문구 버전(ConsentRecord.version / ORDER_CONSENT_VERSION)과는 다른 축이다.
   * 두 값을 같은 칸에 담거나 비교하지 않는다.
   */
  cancelWindowPolicyVersion?: string | null;

  /**
   * 관리자가 결론을 내린 시각(UTC ISO). 서버가 만든다.
   *
   * 승인(approved)·거절(rejected)에서만 남는다. 검토 시작(reviewing)은 결론이
   * 아니라서 null로 둔다. 한 번 남긴 값은 이후 전이에서 지우지 않는다.
   * 이 구조가 생기기 전 행에는 없으며 소급해 만들지 않는다.
   */
  decidedAt?: string | null;
  /** 마지막 전이를 실행한 관리자. 감사 기록이며 고객에게 내보내지 않는다. */
  handledBy?: string | null;

  /**
   * 환불 문의를 completed로 종결한 **서버 시각**(UTC ISO).
   *
   * 뜻은 하나다. "확인된 환불 성공을 반영해 이 문의를 이 순간 종결했다."
   * 승인 시각(decidedAt)도, PG가 준 취소 시각(Payment.cancelledAt)도 아니다.
   * 셋은 서로 다른 사실이며 합치거나 대신 쓰지 않는다.
   * - decidedAt          : 사람이 승인·거절을 결정한 순간
   * - Payment.cancelledAt: PG가 실제로 환급을 처리한 순간(외부 사실, 없을 수 있음)
   * - completedAt        : 우리 서버가 그 성공을 반영해 종결한 순간(내부 사실)
   *
   * approved → completed 최종화가 실제로 성공한 경우에만 남는다. 다른 상태
   * (requested·reviewing·approved·rejected)에서는 만들지 않는다.
   * 한 번 기록되면 덮어쓰지 않으며, 이 구조가 생기기 전 행에는 없고 소급해
   * 만들지 않는다(null은 "기록 없음"이다).
   */
  completedAt?: string | null;
}

/**
 * 관리자 화면이 보는 환불 문의 1건.
 *
 * 고객용 ActiveRefundRequestSummary와 일부러 다른 타입이다. 고객에게는 "처리 중인
 * 문의가 있다"는 사실만 주고, 관리자에게는 판단에 쓸 근거를 함께 준다. 한 타입을
 * 나눠 쓰면 고객 쪽에 근거가 새어 나가기 쉬워 재사용하지 않는다.
 *
 * 접수 당시 값(...Snapshot)과 지금 값(order·consultation)은 칸을 나눠 담는다.
 * 둘을 하나로 합치거나 한쪽으로 덮어쓰지 않는다. 다르다는 사실 자체가 판단 근거다.
 *
 * 서버는 여기서 "환불 가능/불가"를 계산하지 않는다. 근거만 모아 준다.
 */
export interface AdminRefundRequestItem {
  id: string;
  orderId: string;
  userId: string;
  status: RefundRequestStatus;
  requestedAt: string;
  reason: RefundRequestReason;
  /** 고객이 적지 않았으면 null. */
  message: string | null;

  /** ── 접수 당시 고정된 값 ── */
  productionStartedAtSnapshot: string | null;
  scheduledAtSnapshot: string | null;
  cancelWindowSnapshot: RefundRequestCancelWindowSnapshot | null;
  cancelWindowPolicyVersion: string | null;

  /** ── 관리자 처리 기록 ── */
  /** 승인·거절 시각. 검토 중이거나 아직 결론이 없으면 null. */
  decidedAt: string | null;
  /** 마지막 전이를 실행한 관리자. 아직 아무도 손대지 않았으면 null. */
  handledBy: string | null;
  /**
   * 종결(completed) 시각. 서버가 최종화 순간에 남긴다.
   * 종결되지 않았으면 null이다. 승인 시각(decidedAt)이나 PG 취소 시각과 다른 값이다.
   */
  completedAt: string | null;

  /**
   * 관리자 화면에서 어떤 버튼을 보일지 정하기 위한 표시용 값.
   *
   * 실행 권한이나 허가가 아니다. 목록을 읽은 순간의 결제 사실을 네 갈래로 줄인 것뿐이며,
   * 실제 실행 허가는 언제나 서버의 gate와 결제 선점(claim), 최종화 조건이 정한다.
   * 이 값이 executable이어도 실행이 거절될 수 있고, 그 판단은 서버가 다시 한다.
   */
  refundExecution: RefundExecutionProjection;

  /**
   * 이 주문에 적립금 환불 복원 원장(point_transactions, type='refund-restore')이
   * 있는지. 표시용이다.
   *
   * ★ false는 "복원이 필요하다"는 뜻이 **아니다**. 오직 "기록이 없다"는 사실뿐이다.
   * 적립금을 쓰지 않은 주문도, 이 구조가 생기기 전의 주문도 똑같이 false다.
   * 실제 복원 대상인지는 관리자가 복원을 눌렀을 때 서버가 정한다
   * (decidePointsRestore → runRefundPointsRestore). 화면이 미리 판단하지 않는다.
   *
   * 원장을 읽지 못한 경우에도 false다. 목록 전체가 비지 않도록 한 선택이며,
   * false에서 할 수 있는 일이 "눌러서 서버에 물어보기"뿐이라 위험하지 않다.
   */
  hasPointsRestoreRecord: boolean;

  /** ── 지금 값 ── */
  order: AdminRefundRequestOrderView;
  /**
   * 상담 주문일 때 같은 id의 상담. 상담이 아니거나 찾지 못하면 null이다.
   * 찾지 못한 경우에 값을 지어내지 않는다.
   */
  consultation: AdminRefundRequestConsultationView | null;
}

/**
 * 관리자 응답에 담는 환불 문의 묶음.
 *
 * 목록만 주면 "문의가 없다"와 "읽지 못했다"가 똑같이 빈 배열로 보인다. 고객 쪽
 * ActiveRefundRequestsView와 같은 이유로 loaded를 함께 준다.
 *
 * - loaded: true  → 조회에 성공했다. items가 비어 있으면 정말로 문의가 없는 것이다.
 * - loaded: false → 조회하지 못했다. items는 언제나 비어 있고, "문의 없음"을 뜻하지 않는다.
 *
 * 실패 사유는 담지 않는다. 내부 오류 내용은 서버 기록에만 남긴다.
 */
export interface AdminRefundRequestsView {
  items: AdminRefundRequestItem[];
  loaded: boolean;
}

/**
 * 관리자 버튼 노출용 결제 실행 상태 요약.
 *
 * - executable    : 승인 결제가 정확히 하나이고 아직 취소 실행을 시작한 적이 없다.
 * - recoverable   : 취소 실행이 시작·기록되었으나 아직 내부 반영이 끝나지 않았다
 *                   (processing·unknown·succeeded). 거래조회로 확인할 수 있는 상태다.
 * - manual-review : 자동으로 다룰 수 없다. PG가 거절했거나 승인 결제가 여럿이다.
 * - unknown       : 승인 상태의 결제를 찾지 못했다. 환불이 끝났는지, 애초에 결제가
 *                   없던 주문인지 이 값만으로는 구분할 수 없다. 완료로 읽지 않는다.
 *
 * 완료 여부는 이 값이 아니라 환불 문의 상태(RefundRequestStatus의 completed)로 본다.
 */
export type RefundExecutionProjection =
  | "executable"
  | "recoverable"
  | "manual-review"
  | "unknown";

/** 판단에 필요한 현재 주문 정보. 환불 문의는 주문 없이 존재할 수 없어 언제나 있다. */
export interface AdminRefundRequestOrderView {
  product: OrderProduct;
  title: string;
  amount: number;
  status: OrderStatus;
  /** 지금 기록된 제작 착수 시각. null은 "기록 없음"이다. */
  productionStartedAt: string | null;
}

/** 판단에 필요한 현재 상담 정보. */
export interface AdminRefundRequestConsultationView {
  /** null은 "예약 절대시각 기록 없음"이다. */
  scheduledAt: string | null;
  status: ConsultStatus;
}

/**
 * 고객에게 보여 주는 환불 문의 요약.
 *
 * "지금 처리 중인 문의가 있다"는 사실만 전한다. 접수 당시 Evidence
 * (productionStartedAtSnapshot·scheduledAtSnapshot·cancelWindowSnapshot·
 *  cancelWindowPolicyVersion)와 userId, 고객이 적은 reason·message는 담지 않는다.
 *
 * RefundRequest에서 필드를 골라내는 Pick이 아니라 따로 적어 둔 타입이다.
 * 저장 구조에 값이 더해져도 이 타입은 저절로 넓어지지 않는다.
 */
export interface ActiveRefundRequestSummary {
  id: string;
  orderId: string;
  status: RefundRequestStatus;
  requestedAt: string;
}

/**
 * 고객 응답에 담는 활성 환불 문의 묶음.
 *
 * 목록만 주면 "문의가 없다"와 "읽지 못했다"가 똑같이 빈 배열로 보인다. 둘은 화면에서
 * 다르게 다뤄야 하는 상태라 loaded로 구분한다.
 *
 * - loaded: true  → 조회에 성공했다. items가 비어 있으면 정말로 문의가 없는 것이다.
 * - loaded: false → 조회하지 못했다. items는 언제나 비어 있고, "문의 없음"을 뜻하지 않는다.
 *
 * 실패 사유는 담지 않는다. 내부 오류 내용은 서버 기록에만 남긴다.
 */
export interface ActiveRefundRequestsView {
  items: ActiveRefundRequestSummary[];
  loaded: boolean;
}

/**
 * 고객 응답에 담는 주문별 **가장 최근** 환불 문의 요약.
 *
 * ActiveRefundRequestSummary와 값의 모양은 같지만 뜻이 다르다. 저쪽은 "지금 처리 중인
 * 문의"만 담고, 이쪽은 끝난 문의(rejected·completed)까지 담는다. 그래서 한 타입을
 * 나눠 쓰지 않는다. 담는 범위가 다른 값을 같은 이름으로 부르면 화면이 잘못 읽는다.
 *
 * 관리자 판단 근거(접수 당시 snapshot·정책 버전·처리 기록)와 결제·PG 정보는 담지 않는다.
 * 필드를 하나씩 적어 두므로 저장 구조에 값이 더해져도 저절로 새어 나가지 않는다.
 */
export interface LatestRefundRequestSummary {
  id: string;
  orderId: string;
  status: RefundRequestStatus;
  requestedAt: string;
}

/**
 * 고객 응답에 담는 주문별 최신 환불 문의 묶음.
 *
 * ActiveRefundRequestsView와 같은 이유로 loaded를 함께 준다.
 * - loaded: true  → 조회에 성공했다. items에 없는 주문은 정말로 접수한 적이 없는 것이다.
 * - loaded: false → 조회하지 못했다. items는 언제나 비어 있고, "이력 없음"을 뜻하지 않는다.
 *
 * 실패 사유는 담지 않는다. 내부 오류 내용은 서버 기록에만 남긴다.
 */
export interface LatestRefundRequestsView {
  items: LatestRefundRequestSummary[];
  loaded: boolean;
}

/** 저장된 취소창 판정 결과. ConsultationCancelWindow와 같은 모양이다. */
export type RefundRequestCancelWindowSnapshot =
  | { kind: "normal-request"; remainingMinutes: number }
  | {
      kind: "manual-review";
      reason: "within-window" | "after-start" | "missing-scheduled-at" | "invalid-scheduled-at";
      remainingMinutes?: number;
    };

export interface AppData {
  users: User[];
  orders: Order[];
  consultations: Consultation[];
  inquiries: Inquiry[];
  reviews: Review[];
  wishlists: Record<string, string[]>;
  coupons: Record<string, Coupon[]>;
  notifications: Record<string, AppNotification[]>;
  notificationSettings: Record<string, NotificationSettings>;
  codes: Record<string, VerificationCode>;
  blockedSlots: BlockedSlot[];
  adminPromo: AdminPromo | null;
  testResetAt?: string;
}

/**
 * 불만·분쟁 처리 기록 (Privacy-Complaint-Implementation-1).
 *
 * 일반 문의·채팅과 완전히 별개다. 일반 문의·채팅은 운영 보존정책에 따라 만료되지만,
 * 관리자가 실제 불만·분쟁으로 판단해 승격한 건만 이 기록으로 남는다.
 *
 * 담지 않는 것: 이름·연락처·guest token·대화 본문·금액·PG 정보·원본 문의 id.
 * 거래 사실은 orders·payments가, 환불 처리는 refund_requests가 따로 보유한다.
 * 여기에는 "어떤 성격의 불만이 언제 접수되어 어떻게 끝났는가"만 남는다.
 */
export type ComplaintSourceType = "chat" | "inquiry" | "other";

export type ComplaintCategory =
  | "service"
  | "payment"
  | "consultation"
  | "delivery"
  | "privacy"
  | "other";

/** open(접수·처리 중) → handled(처리 완료). 되돌아가는 전이는 없다. */
export type ComplaintStatus = "open" | "handled";

export interface ComplaintRecord {
  id: string;
  /** 어느 경로에서 제기됐는지. 원본 id는 남기지 않는다(원본은 먼저 만료된다). */
  sourceType: ComplaintSourceType;
  category: ComplaintCategory;
  /** 상담원이 정리한 요지. 대화 전문을 옮기지 않는다. */
  summary: string;
  /** 승격(접수 기록) 시각(UTC ISO). 서버가 만든다. */
  createdAt: string;
  status: ComplaintStatus;
  /** 처리 완료 시각(UTC ISO). 한 번 기록하면 덮어쓰지 않는다. */
  handledAt: string | null;
  /** 회원이 제기한 건일 때만. 이름·연락처 대신 쓰는 최소 식별자다. */
  userId: string | null;
  /** 특정 주문에 관한 건일 때만. 거래 증빙으로 가는 참조이며 FK는 두지 않는다. */
  orderId: string | null;
  /** 처리한 관리자 표식. 고객 개인정보가 아니다. */
  handledBy: string | null;
}
