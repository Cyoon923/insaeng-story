export type ProductId = "story" | "premium" | "saju-song";
export type CouponProduct = ProductId | "consultation";
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
  /** scrypt 해시(`salt:hash`). 가입 시에만 설정되며 기존 회원에는 없다. */
  passwordHash?: string;
  /** 마케팅 정보 수신 동의(선택 항목). */
  marketingAgreed?: boolean;
  /** 카카오 로그인으로 연결된 계정의 카카오 사용자 ID. 소셜 가입자에게만 있다. */
  kakaoId?: string;
  /** 네이버 로그인으로 연결된 계정의 네이버 사용자 ID. 소셜 가입자에게만 있다. */
  naverId?: string;
}

export interface Order {
  id: string;
  userId: string;
  product: ProductId;
  title: string;
  status: OrderStatus;
  amount: number;
  payment: string;
  details: Record<string, string>;
  createdAt: string;
}

export interface Consultation {
  id: string;
  userId: string;
  teacher: string;
  datetime: string;
  purpose: string;
  method: string;
  option: string;
  status: ConsultStatus;
  amount: number;
  details: Record<string, string>;
  createdAt: string;
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
  userId: string;
  name: string;
  title: string;
  rating: number;
  text: string;
  createdAt: string;
  visible: boolean;
  kind?: "story" | "premium" | "saju-song" | "consultation";
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
  codes: Record<string, { code: string; expiresAt: number }>;
  blockedSlots: BlockedSlot[];
  adminPromo: AdminPromo | null;
  testResetAt?: string;
}
