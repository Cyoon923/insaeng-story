export type ProductId = "story" | "premium" | "saju-song";
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
  userId: string;
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
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationSettings {
  order: boolean;
  consult: boolean;
  notice: boolean;
}

export interface AppData {
  users: User[];
  orders: Order[];
  consultations: Consultation[];
  inquiries: Inquiry[];
  wishlists: Record<string, string[]>;
  coupons: Record<string, Coupon[]>;
  notifications: Record<string, AppNotification[]>;
  notificationSettings: Record<string, NotificationSettings>;
  codes: Record<string, { code: string; expiresAt: number }>;
  blockedSlots: BlockedSlot[];
  adminPromo: AdminPromo | null;
}
