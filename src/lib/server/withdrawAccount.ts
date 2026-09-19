/**
 * 회원 탈퇴 서버 로직. 이 파일은 판정과 비식별화만 담당하고,
 * 실제 실행 API와 화면은 아직 만들지 않았다.
 *
 * 방침
 * - 진행 중인 서비스가 있으면 탈퇴를 막는다.
 * - 회원 행은 지우지 않는다. 거래 기록(주문·상담·결제)이 회원 id로 묶여 있기 때문이다.
 *   대신 개인정보만 비우고 withdrawnAt을 남긴다.
 * - 후기는 내용·공개 상태를 그대로 두고, 작성자 표시만 비식별화한다.
 */
import { getUserId } from "@/lib/server/session";
import { countPendingPaymentsByUser, listOrdersByUser, readData } from "@/lib/server/store";
import type { AppData, Consultation, Order, User } from "@/lib/types/app";

/** 더 진행할 일이 남지 않은 주문 상태. */
const ORDER_FINISHED = "완료";

/** 더 진행할 일이 남지 않은 상담 상태. */
const CONSULT_FINISHED = "상담 완료";

/** 탈퇴한 회원의 이름 자리에 남기는 값. 화면에 그대로 쓰라고 만든 값은 아니다. */
export const WITHDRAWN_NAME = "탈퇴회원";

/** 탈퇴를 막는 사유 하나. reason은 사용자에게 그대로 보여줄 수 있는 문구다. */
export interface WithdrawBlocker {
  kind: "order" | "consultation" | "payment";
  reason: string;
  count: number;
}

/**
 * 상담 결제를 귀속시키기 위한 주문은 진행 상태를 관리하지 않고 늘 "신청접수"로 남는다.
 * (src/lib/server/applyOrder.ts의 상담 주문 생성 부분 참고)
 * 이 주문까지 세면 상담을 마친 회원도 영영 탈퇴할 수 없으므로 판정에서 제외한다.
 */
function isServiceOrder(order: Order): boolean {
  return order.product !== "consultation";
}

function isOrderInProgress(order: Order): boolean {
  return isServiceOrder(order) && order.status !== ORDER_FINISHED;
}

function isConsultationInProgress(item: Consultation): boolean {
  return item.status !== CONSULT_FINISHED;
}

/**
 * 탈퇴를 막아야 하는 사유를 모두 모은다. 빈 배열이면 탈퇴할 수 있다.
 * 결제는 회원별 조회가 필요해 저장소를 직접 읽으므로 async다.
 */
export async function findWithdrawBlockers(
  data: AppData,
  userId: string,
): Promise<WithdrawBlocker[]> {
  const blockers: WithdrawBlocker[] = [];

  const orders = await listOrdersByUser(userId);
  const runningOrders = orders.filter(isOrderInProgress);
  if (runningOrders.length > 0) {
    blockers.push({
      kind: "order",
      count: runningOrders.length,
      reason: "진행 중인 인생곡 신청이 있습니다.",
    });
  }

  const runningConsults = data.consultations.filter(
    (item) => item.userId === userId && isConsultationInProgress(item),
  );
  if (runningConsults.length > 0) {
    blockers.push({
      kind: "consultation",
      count: runningConsults.length,
      reason: "진행 중인 사주상담이 있습니다.",
    });
  }

  const pendingPayments = await countPendingPaymentsByUser(userId);
  if (pendingPayments > 0) {
    blockers.push({
      kind: "payment",
      count: pendingPayments,
      reason: "진행 중인 결제가 있습니다.",
    });
  }

  return blockers;
}

/**
 * 회원의 개인정보를 지우고 탈퇴 상태로 만든다. 회원 행 자체는 남는다.
 * 재식별과 로그인에 쓰이는 값(아이디·연락처·이메일·비밀번호·소셜 id)을 모두 비우므로
 * 같은 아이디나 같은 번호, 같은 소셜 계정으로 다시 가입할 수 있다.
 *
 * 후기(reviews)와 주문·상담·결제 기록은 이 함수가 건드리지 않는다(후기는 scrubUserRecords가 맡는다).
 * 저장은 호출한 쪽에서 writeData로 마무리한다.
 */
export function anonymizeWithdrawnUser(data: AppData, user: User): User {
  // 로그인·재식별에 쓰이는 값부터 비운다.
  user.phone = "";
  user.email = "";
  user.name = WITHDRAWN_NAME;
  delete user.loginId;
  delete user.passwordHash;
  delete user.kakaoId;
  delete user.naverId;

  // 프로필과 사주 정보.
  user.gender = "";
  user.birth = "";
  user.birthTime = "";
  user.unknownTime = false;
  user.calendar = "solar";
  user.bloodType = "";
  user.marketingAgreed = false;

  // 회원 전용 데이터는 보존할 이유가 없어 즉시 정리한다.
  user.points = 0;
  delete data.wishlists[user.id];
  delete data.coupons[user.id];
  delete data.notifications[user.id];
  delete data.notificationSettings[user.id];

  user.withdrawnAt = new Date().toISOString();
  return user;
}

/**
 * 탈퇴 후에도 details에 남겨 두는 키. 여기 없는 키는 전부 지운다.
 *
 * allowlist인 이유는 details가 Record<string, string>이고
 * 신청 화면의 draft가 통째로 들어오기 때문이다(src/components/apply/PaySubmit.tsx).
 * 지울 키를 나열하는 방식이면 입력칸이 하나 늘 때마다 개인정보가 새어 남는다.
 *
 * 남기는 값은 금액 재계산·할인 근거·상담 구성처럼 거래 기록에 필요한 것뿐이고,
 * 이름·연락처·사주정보·사연·상대방 정보는 모두 여기에 없다.
 */
export const KEPT_DETAIL_KEYS = [
  // 상품가·옵션가 재계산 근거
  "optionIds",
  "options",
  "videoStyle",
  "report",
  "extraPerson",
  // 할인 근거
  "couponId",
  "couponTitle",
  "couponFree",
  "referralCode",
  "referralDiscount",
  "referralType",
  "referralPercent",
  "usePoints",
  "pointsUsed",
  // 상담 일정·구성. 개인 식별값이 아니다.
  "teacher",
  "datetime",
  "purpose",
  "method",
  "option",
  // 어떤 상품을 팔았는지 보는 통계값. self/parents 같은 코드값이라 식별력이 없다.
  "protagonistId",
] as const;

/**
 * SQL orders 테이블의 details도 같은 목록으로 정리해야 한다.
 * store.ts는 이 파일을 import할 수 없어(순환 의존) 값을 인자로 받는다.
 * 호출부: src/app/api/app/route.ts의 withdrawAccount 액션.
 */
const KEPT_DETAIL_KEY_SET = new Set<string>(KEPT_DETAIL_KEYS);

/**
 * details에서 보존 키만 남긴 새 객체를 돌려준다. 인자는 바꾸지 않는다.
 * 값이 없는 키는 애초에 담기지 않으므로 빈 객체가 될 수 있다.
 */
export function pickKeptDetails(details: Record<string, string>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (KEPT_DETAIL_KEY_SET.has(key)) kept[key] = value;
  }
  return kept;
}

/**
 * 탈퇴하는 회원의 주문·상담 details에서 개인정보 사본을 지운다. data를 직접 바꾼다.
 *
 * 건드리는 것은 userId가 일치하는 행의 details와 후기의 작성자 표시뿐이다.
 * 금액·상태·상품명 같은 컬럼과 다른 회원의 행은 그대로 둔다.
 * 저장은 호출한 쪽에서 writeData로 마무리한다.
 */
export function scrubUserRecords(data: AppData, userId: string): void {
  for (const order of data.orders) {
    if (order.userId === userId) order.details = pickKeptDetails(order.details);
  }
  for (const item of data.consultations) {
    if (item.userId === userId) item.details = pickKeptDetails(item.details);
  }
  // 무료상담·이벤트 접수 문의. 이름·연락처만 지우고 문의 내용과 userId는 그대로 둔다.
  // userId가 없는 비회원 접수는 대상이 아니다.
  for (const inquiry of data.inquiries) {
    if (inquiry.userId !== userId) continue;
    inquiry.name = WITHDRAWN_NAME;
    inquiry.phone = "";
  }
  // 후기. 내용(text·별점·상품명·작성일)과 공개 상태, 대상(targetKey)은 그대로 두고
  // 작성자를 가리키는 값만 지운다. userId는 값을 비우지 않고 키째 없앤다.
  // 키가 사라지면 어떤 회원과도 비교에서 걸리지 않아 다시 이어 붙일 수 없다.
  // 이미 비식별화된 후기는 userId가 없어 이 조건에 걸리지 않으므로 여러 번 실행해도 결과가 같다.
  for (const review of data.reviews ?? []) {
    if (review.userId !== userId) continue;
    review.name = WITHDRAWN_NAME;
    delete review.userId;
  }
}

/** 탈퇴하지 않은 회원인지. 세션이 남아 있어도 탈퇴 회원은 로그인으로 인정하지 않는다. */
export function isActiveUser(user: User | null | undefined): user is User {
  return !!user && !user.withdrawnAt;
}

/**
 * 세션이 가리키는 회원이 지금도 정상 회원일 때만 userId를 돌려준다.
 * 탈퇴한 회원은 쿠키가 남아 있어도 비로그인으로 취급하기 위한 공통 진입점이다.
 * (session.ts는 저장소를 모르는 상태로 두려고 판정을 이쪽에 둔다.)
 */
export async function getActiveUserId(): Promise<string | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const data = await readData();
  const user = data.users.find((item) => item.id === userId);
  return isActiveUser(user) ? userId : null;
}
