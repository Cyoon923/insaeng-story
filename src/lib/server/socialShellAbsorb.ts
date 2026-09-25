/**
 * "이력 없는 미인증 소셜 shell"을 기존 회원으로 흡수하는 판정과 준비 (소셜 간편가입 STEP 3).
 *
 * ── 이 파일이 하는 일 ──
 *
 * 1) 흡수해도 되는 shell인지 판정한다(findAbsorbBlockers).
 * 2) 통과하면 provider id 하나만 target으로 옮기고 shell을 비활성화한다(absorbSocialShell).
 *
 * 옮기는 회원 데이터는 kakaoId 또는 naverId **하나뿐**이다. 범용 User merge는 만들지 않는다.
 * shell의 프로필·포인트·쿠폰·찜은 옮기지 않고 폐기한다. 옮길 가치가 없다는 것을
 * 판정이 먼저 보장하기 때문이다(points===0, 쓸 수 있는 쿠폰 없음, 이력 없음).
 *
 * ── 이 파일이 하지 않는 일 ──
 *
 * - 저장하지 않는다. data를 제자리에서 고치고 돌려주기만 한다. 저장은 호출부가
 *   한 번의 CAS write로 확정한다(STEP 4에서 verification token 소비와 함께 묶는다).
 *   그래서 이 파일 안에는 write가 한 번도 없다.
 * - Postgres를 고치지 않는다. 판정에 필요한 개수만 deps로 받아 읽는다.
 *   orders / chat_inquiries 행을 옮기거나 지우지 않는다.
 * - 세션을 건드리지 않는다. setUserId는 호출부(STEP 4)가 저장 뒤에 부른다.
 * - guest 채팅방을 target으로 옮기지 않는다. 비회원 쿠키로 남는다.
 *
 * ── deps로 받는 이유 ──
 *
 * 기존 환불 흐름들(refundPointsRestore.ts 등)과 같다. DB 없이 이 순서 자체를
 * 확인할 수 있어야 하고, anonymizeWithdrawnUser는 저장소를 아는 파일에 있어
 * 여기서 직접 import하면 이 파일을 순수 모듈로 둘 수 없다.
 */
import { phoneDigits } from "../phoneVerification.ts";
import type { AppData, User } from "@/lib/types/app";

/** 지원하는 소셜 제공자. User의 어느 필드를 쓰는지까지 이 타입이 정한다. */
export type AbsorbProvider = "kakao" | "naver";

/** provider별 User 필드명. 클라이언트가 고를 수 없도록 여기서만 정한다. */
const PROVIDER_KEY: Record<AbsorbProvider, "kakaoId" | "naverId"> = {
  kakao: "kakaoId",
  naver: "naverId",
};

/**
 * 흡수를 막는 사유.
 *
 * 앞의 다섯은 "shell에 옮겨야 할 이력이 있다"는 뜻이고, 뒤의 다섯은
 * "이 회원은 애초에 흡수 대상이 아니다"는 뜻이다. 사유를 합치지 않는 이유는
 * 호출부가 사람에게 무엇을 안내할지 구분할 수 있어야 해서다.
 */
export type AbsorbBlocker =
  /** 주문이 있다. payments·point_transactions·refund_requests가 여기에 매달린다. */
  | "orders"
  /** 상담원 채팅방이 있다. app_store 밖의 행이라 옮기는 값이 가장 비싸다. */
  | "chat-inquiries"
  | "consultations"
  | "inquiries"
  | "reviews"
  /** 적립금이 남아 있다. 추천인 보상이나 관리자 지급으로 생길 수 있다. */
  | "points"
  /** 상품에 쓸 수 있거나 이미 쓴 쿠폰이 있다. 가입 안내 쿠폰은 여기 들지 않는다. */
  | "coupons"
  /** 비밀번호가 있다. 일반 가입 회원은 흡수 대상이 아니다. */
  | "password"
  /** 이미 본인확인을 마친 회원이다. 흡수가 아니라 그대로 쓰면 된다. */
  | "phone"
  /** 없는 회원이거나 이미 탈퇴·흡수된 회원이다. */
  | "inactive";

/** 판정에 필요한 Postgres 개수. 읽기만 한 값을 넘긴다. */
export interface ShellHistoryCounts {
  /** listOrdersByUser(shell.id).length */
  orders: number;
  /** listChatInquiriesByUserId(shell.id).length */
  chatInquiries: number;
}

/**
 * 쓸 수 있는(=옮겨야 할) 쿠폰인지.
 *
 * 가입 때 자동으로 생기는 안내 쿠폰(store.ts welcomeCoupon)은 product가 없어
 * applyFreeCoupon이 언제나 거부한다. 금전 가치가 0이므로 폐기해도 손실이 없다.
 * product가 붙었거나 이미 쓴 흔적(usedAt)이 있으면 사람이 관여한 값이라 막는다.
 */
function isTransferableCoupon(coupon: { product?: string; usedAt?: string }): boolean {
  return Boolean(coupon.product) || Boolean(coupon.usedAt);
}

/**
 * 흡수를 막는 사유를 모두 모은다. 빈 배열이면 흡수할 수 있다.
 *
 * 기존 findWithdrawBlockers를 쓰지 않는다. 그쪽은 "진행 중인 것이 없는가"라서
 * 완료된 주문을 허용한다. 여기서 필요한 것은 "아무것도 없는가"이고 더 엄격하다.
 *
 * 사유를 하나 찾고 멈추지 않는다. 호출부가 기록이나 안내에 전부 쓸 수 있어야 하고,
 * 어차피 저장 전에 판정만 하는 자리라 전부 보는 비용이 없다.
 *
 * 찜(wishlist)과 알림(notifications/notificationSettings)은 막지 않는다.
 * 셋 다 회원 id를 키로 한 app_store 값이지만, 찜은 문자열 목록이고 알림 설정은
 * 기본값이며 알림은 STEP 2에서 미인증 회원에게 쌓이지 않게 막았다. 폐기해도
 * 되돌릴 수 없는 것이 없으므로, 막아서 흡수를 못 하게 만드는 편이 더 나쁘다.
 */
export function findAbsorbBlockers(
  data: AppData,
  shellId: string,
  counts: ShellHistoryCounts,
): AbsorbBlocker[] {
  const blockers: AbsorbBlocker[] = [];
  const shell = data.users.find((item) => item.id === shellId) ?? null;

  // 회원 자체가 없거나 이미 탈퇴·흡수된 경우. 뒤 조건을 볼 의미가 없어 여기서 끝낸다.
  if (!shell || shell.withdrawnAt) return ["inactive"];

  // ── shell에 옮겨야 할 이력이 있는가 (Postgres) ──
  if (counts.orders > 0) blockers.push("orders");
  if (counts.chatInquiries > 0) blockers.push("chat-inquiries");

  // ── shell에 옮겨야 할 이력이 있는가 (app_store) ──
  if (data.consultations.some((item) => item.userId === shellId)) blockers.push("consultations");
  if ((data.inquiries ?? []).some((item) => item.userId === shellId)) blockers.push("inquiries");
  if ((data.reviews ?? []).some((item) => item.userId === shellId)) blockers.push("reviews");
  if ((shell.points ?? 0) !== 0) blockers.push("points");
  if ((data.coupons[shellId] ?? []).some(isTransferableCoupon)) blockers.push("coupons");

  // ── 애초에 흡수 대상인가 ──
  if (shell.passwordHash) blockers.push("password");
  if (phoneDigits(shell.phone) !== "") blockers.push("phone");

  return blockers;
}

/** 흡수가 멈춘 이유. 어느 쪽이든 data는 하나도 바뀌지 않는다. */
export type AbsorbRefusal =
  /** shell이 깨끗하지 않다. blockers에 사유가 담긴다. */
  | { reason: "shell-not-empty"; blockers: AbsorbBlocker[] }
  /** 흡수 대상 기존 회원이 없거나 탈퇴했다. */
  | { reason: "target-inactive" }
  /** shell과 target이 같다. 흡수할 것이 없다. */
  | { reason: "same-user" }
  /** shell에 그 provider id가 없다. 읽을 값이 없으므로 옮길 것도 없다. */
  | { reason: "shell-missing-provider" }
  /** target에 같은 종류의 **다른** provider id가 이미 붙어 있다. 덮어쓰지 않는다. */
  | { reason: "target-has-other-provider" }
  /** 같은 provider id가 제3의 활성 회원에게 붙어 있다. */
  | { reason: "provider-owned-by-other" };

/**
 * 결과.
 *
 * - absorbed      : 이번 호출이 data를 고쳤다. 호출부가 저장하면 확정된다.
 * - already-absorbed: target에 이미 같은 provider id가 있고 shell도 정리되어 있다.
 *                   아무것도 고치지 않았다. 오류가 아니다(같은 요청이 두 번 온 경우).
 * - refused       : 위 사유로 멈췄다. data는 그대로다.
 */
export type AbsorbResult =
  | { kind: "absorbed"; providerUserId: string; targetId: string; shellId: string }
  | { kind: "already-absorbed"; providerUserId: string; targetId: string }
  | { kind: "refused"; refusal: AbsorbRefusal };

/** 이 흐름이 쓰는 바깥 기능. 테스트에서 바꿔 끼울 수 있도록 인자로 받는다. */
export interface AbsorbDeps {
  /**
   * 회원의 개인정보를 비우고 withdrawnAt을 남긴다.
   * withdrawAccount.ts의 anonymizeWithdrawnUser를 그대로 넘긴다.
   *
   * 전체 탈퇴 API를 쓰지 않는 이유: 그쪽은 OAuth 연결 끊기와 주문·결제 스크럽까지
   * 하는데, provider는 target에서 계속 써야 하고 shell에는 주문이 없다(판정이 보장한다).
   */
  anonymize: (data: AppData, user: User) => User;
}

/**
 * shell을 target으로 흡수한다. **저장하지 않는다.**
 *
 * 순서가 중요하다.
 *   1) shell에서 providerUserId를 **읽는다**
 *   2) target에 붙인다
 *   3) shell을 비식별화한다 (anonymize가 shell의 provider id를 지운다)
 * 2를 1보다, 3을 2보다 먼저 하면 값을 잃는다. 3이 provider id를 지우기 때문이다.
 *
 * providerUserId는 shell의 실제 필드에서만 읽는다. 인자로 받지 않는다.
 * 호출부가(따라서 클라이언트가) 어떤 id를 붙일지 정할 수 없게 하기 위해서다.
 */
export function absorbSocialShell(
  data: AppData,
  input: { shellId: string; targetId: string; provider: AbsorbProvider; counts: ShellHistoryCounts },
  deps: AbsorbDeps,
): AbsorbResult {
  const { shellId, targetId, provider, counts } = input;
  const key = PROVIDER_KEY[provider];

  if (shellId === targetId) {
    return { kind: "refused", refusal: { reason: "same-user" } };
  }

  const target = data.users.find((item) => item.id === targetId) ?? null;
  if (!target || target.withdrawnAt) {
    return { kind: "refused", refusal: { reason: "target-inactive" } };
  }

  const shell = data.users.find((item) => item.id === shellId) ?? null;

  /**
   * 멱등 처리. 앞선 시도가 저장까지 마쳤고 같은 요청이 다시 온 경우다.
   * shell이 이미 정리되어 있고 target이 id를 들고 있으면 성공으로 끝낸다.
   * 판정을 다시 돌리지 않는다. 지금 shell은 withdrawnAt이 있어 "inactive"로 막힐 것이고,
   * 그러면 이미 끝난 일을 실패로 되돌려 보내게 된다.
   */
  const targetHas = target[key];
  if (targetHas && (!shell || shell.withdrawnAt) && !shell?.[key]) {
    return { kind: "already-absorbed", providerUserId: targetHas, targetId };
  }

  // ── 1) shell 판정. 통과하지 못하면 아무것도 고치지 않는다. ──
  const blockers = findAbsorbBlockers(data, shellId, counts);
  if (blockers.length > 0) {
    return { kind: "refused", refusal: { reason: "shell-not-empty", blockers } };
  }
  // 판정을 통과했으므로 shell은 반드시 있다. 타입을 좁히기 위해 다시 확인한다.
  if (!shell) {
    return { kind: "refused", refusal: { reason: "shell-not-empty", blockers: ["inactive"] } };
  }

  // ── 2) 옮길 값 읽기 ──
  const providerUserId = shell[key];
  if (!providerUserId) {
    return { kind: "refused", refusal: { reason: "shell-missing-provider" } };
  }

  // ── 3) 충돌 판정 ──
  // target에 같은 종류의 다른 id가 이미 붙어 있으면 덮어쓰지 않는다.
  if (targetHas && targetHas !== providerUserId) {
    return { kind: "refused", refusal: { reason: "target-has-other-provider" } };
  }
  // 같은 id를 든 제3의 활성 회원이 있으면 멈춘다. shell과 target은 제외한다.
  const ownedByOther = data.users.find(
    (item) =>
      !item.withdrawnAt && item.id !== shellId && item.id !== targetId && item[key] === providerUserId,
  );
  if (ownedByOther) {
    return { kind: "refused", refusal: { reason: "provider-owned-by-other" } };
  }

  // ── 4) 이전 → 비식별화. 이 순서를 뒤집으면 providerUserId를 잃는다. ──
  target[key] = providerUserId;
  deps.anonymize(data, shell);

  return { kind: "absorbed", providerUserId, targetId, shellId };
}
