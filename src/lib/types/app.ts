export type ProductId = "story" | "premium" | "saju-song";
export type CouponProduct = ProductId | "consultation";
/** 주문에 기록되는 상품. 1:1 사주상담도 결제 귀속을 위해 주문으로 남긴다. */
export type OrderProduct = ProductId | "consultation";
export type OrderStatus = "신청접수" | "상담진행" | "제작중" | "완성/전달" | "완료";
export type ConsultStatus = "상담 신청" | "사주정보 입력" | "선생님과 1:1 상담" | "상담 완료";

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
  /** 마케팅 정보 수신 동의(선택 항목). */
  marketingAgreed?: boolean;
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
   * 서비스 결과물을 처음 전달한 시각(UTC ISO).
   *
   * status가 처음 "완성/전달"이 될 때 서버가 남긴다. 개인정보 보관 기간의
   * 기산점으로 쓰기 위한 값이라, 한 번 기록되면 절대 덮어쓰지 않는다.
   *
   * 이 구조가 생기기 전의 주문에는 없다. 없으면 "기록 없음"이며, createdAt이나
   * updatedAt으로 대신 채우지 않는다(다른 뜻의 값이다).
   */
  deliveredAt?: string;
  /**
   * 보관 기간이 끝나 콘텐츠성 개인정보를 지운 시각(UTC ISO).
   *
   * 뜻은 하나다. "이 주문에 대해 보관 만료 scrub이 **전부** 성공했다."
   * 한 번 기록되면 덮어쓰지 않는다. 값이 없는 것은 "아직 하지 않음"이며,
   * 완료 증빙이나 updatedAt으로 대신 판단하지 않는다.
   */
  retentionScrubbedAt?: string;
}

export interface Consultation {
  id: string;
  userId: string;
  teacher: string;
  datetime: string;
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
   */
  completedAt?: string;
  /**
   * 보관 기간이 끝나 이 상담의 콘텐츠성 개인정보를 지운 시각(UTC ISO).
   *
   * **짝이 되는 주문이 없는 상담에만** 쓴다. 주문이 있는 상담은 그 주문의
   * Order.retentionScrubbedAt이 완료 증빙이며, 같은 뜻의 시각을 두 벌 두지 않는다.
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
  /** PG 응답 원문. */
  raw: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

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
