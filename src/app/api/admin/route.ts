import { NextResponse } from "next/server";
import {
  clearAdminSession,
  CURRENT_ADMIN_ACTOR,
  getAdminPassword,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "@/lib/server/adminSession";
import {
  isAppStoreConflict,
  nowId,
  readData,
  writeData,
  writeDataWithOrderStatus,
  listAllOrders,
  listPaymentsNeedingReview,
  getOrderById,
} from "@/lib/server/store";
import {
  DEFAULT_TEACHER,
  CONSULT_TEACHERS,
  CONSULT_TIMES,
  toggleBlockedSlot,
  upcomingConsultDates,
  listSlotStatuses,
} from "@/lib/server/consultationSlots";
import {
  hasCompletedRefundRequestForOrder,
  listRefundRequestsForAdmin,
  transitionRefundRequestByAdmin,
} from "@/lib/server/refundRequests";
import {
  loadedAdminRefundRequests,
  unavailableAdminRefundRequests,
} from "@/lib/server/refundRequestAdminView";
import {
  progressLockedByRefundResponse,
  readTransitionRefundRequestBody,
  toTransitionRefundRequestResponse,
  transitionFailureResponse,
} from "@/lib/server/refundRequestAdminApi";
import {
  defaultExecuteApprovedRefundDeps,
  executeApprovedRefund,
  readExecuteApprovedRefundBody,
} from "@/lib/server/refundExecuteAdminApi";
import {
  defaultRecoverApprovedRefundDeps,
  readRecoverApprovedRefundBody,
  recoverApprovedRefund,
} from "@/lib/server/refundRecoveryAdminApi";
import {
  applyConsultationCompletion,
  deliveredAtForStatus,
} from "@/lib/server/serviceCompletion";
import {
  defaultRestoreOrderPointsDeps,
  readRestoreOrderPointsBody,
  restoreOrderPointsByAdmin,
} from "@/lib/server/pointsRestoreRecoveryAdminApi";
import {
  markComplaintHandledFailureResponse,
  readCreateComplaintRecordBody,
  readMarkComplaintHandledBody,
} from "@/lib/server/complaintAdminApi";
import {
  createComplaintRecord,
  listComplaintRecordsForAdmin,
  markComplaintHandled,
} from "@/lib/server/complaintRecords";
import { ComplaintRecordError } from "@/lib/server/complaintRecordRules";
import type {
  AdminRefundRequestsView,
  ComplaintRecord,
  ConsultStatus,
  OrderStatus,
} from "@/lib/types/app";

const ORDER_STATUSES: OrderStatus[] = ["신청접수", "상담진행", "제작중", "완성/전달", "완료"];
const CONSULT_STATUSES: ConsultStatus[] = ["상담 신청", "사주정보 입력", "선생님과 1:1 상담", "상담 완료"];

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const data = await readData();
  // 결제 기록은 DATABASE_URL이 있어야 읽을 수 있다. 없으면 관리자 화면 전체가
  // 깨지지 않도록 빈 목록으로 둔다. 조회 전용이라 실패해도 부작용이 없다.
  let paymentsNeedingReview: Awaited<ReturnType<typeof listPaymentsNeedingReview>> = {
    stale: [],
    unlinked: [],
  };
  try {
    paymentsNeedingReview = await listPaymentsNeedingReview();
  } catch {
    paymentsNeedingReview = { stale: [], unlinked: [] };
  }

  /*
   * 상담은 위에서 읽은 data를 그대로 넘긴다. 저장소를 두 번 읽지 않기 위해서다.
   *
   * 실패해도 이 필드에만 가둔다. 환불 문의를 읽지 못했다고 회원·주문·상담까지
   * 못 보게 하는 편이 더 나쁘다. 다만 실패를 빈 목록으로 숨기지는 않는다.
   * 읽지 못한 것과 문의가 없는 것은 화면에서 다르게 다뤄야 하므로 loaded로 구분한다.
   * 오류 내용은 서버 기록에만 남기고 응답에는 담지 않는다.
   */
  let refundRequests: AdminRefundRequestsView;
  try {
    refundRequests = loadedAdminRefundRequests(
      await listRefundRequestsForAdmin(data.consultations),
    );
  } catch (error) {
    console.error("[admin] refund requests failed", error);
    refundRequests = unavailableAdminRefundRequests();
  }

  /*
   * 불만·분쟁 기록. 환불 문의와 같은 이유로 이 필드에만 실패를 가둔다.
   * 읽지 못한 것과 기록이 없는 것을 구분해야 하므로 loaded를 함께 준다.
   * 오류 내용은 서버 기록에만 남기고 응답에는 담지 않는다.
   */
  let complaintRecords: { items: ComplaintRecord[]; loaded: boolean };
  try {
    complaintRecords = { items: await listComplaintRecordsForAdmin(), loaded: true };
  } catch (error) {
    console.error("[admin] complaint records failed", error);
    complaintRecords = { items: [], loaded: false };
  }

  return NextResponse.json({
    users: data.users,
    paymentsNeedingReview,
    orders: await listAllOrders(),
    /**
     * 접수된 환불 문의 전체 이력. 접수 당시 값과 지금 값을 나란히 담는다.
     * 결제 기록과 같은 이유로, 읽지 못해도 관리자 화면 전체가 깨지지 않게 감싼다.
     * { items, loaded } 모양이며, loaded가 false면 "문의 없음"이 아니라 "읽지 못함"이다.
     */
    refundRequests,
    /** 불만·분쟁 기록. { items, loaded } 모양이며 loaded가 false면 "읽지 못함"이다. */
    complaintRecords,
    consultations: data.consultations,
    inquiries: data.inquiries ?? [],
    reviews: data.reviews ?? [],
    blockedSlots: data.blockedSlots ?? [],
    dates: upcomingConsultDates(),
    times: CONSULT_TIMES,
    teacher: DEFAULT_TEACHER,
    // 일정 화면에서 선생님을 고를 수 있도록 목록도 함께 내려준다.
    // 기존 teacher 필드는 그대로 두어 지금 화면이 그대로 동작한다.
    teachers: CONSULT_TEACHERS,
    adminPromo: data.adminPromo ?? null,
    coupons: data.coupons ?? {},
  });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    // 다른 요청과 겹쳐 저장되지 않은 경우. 관리자가 적용 여부를 오해하지 않도록 분명히 알린다.
    if (isAppStoreConflict(error)) {
      console.warn("[admin] store conflict");
      return NextResponse.json(
        { error: "다른 요청과 겹쳐 변경사항이 적용되지 않았습니다. 다시 시도해 주세요." },
        { status: 409 },
      );
    }
    throw error;
  }
}

async function handlePost(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "login") {
    // ADMIN_PASSWORD가 설정되어 있지 않으면 기본 비밀번호로 대체하지 않고 거부한다.
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      return NextResponse.json({ error: "관리자 로그인을 사용할 수 없습니다." }, { status: 503 });
    }
    const password = String(body.password ?? "");
    if (password !== adminPassword) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    if (!(await setAdminAuthenticated())) {
      return NextResponse.json({ error: "관리자 로그인을 사용할 수 없습니다." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "logout") {
    await clearAdminSession();
    return NextResponse.json({ ok: true });
  }

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  if (action === "transitionRefundRequest") {
    /**
     * 환불 문의 상태 전이.
     *
     * 관리자가 정하는 값은 어떤 문의인지(refundRequestId)와 지금 보고 있는 상태,
     * 바꿀 상태뿐이다. 실행자는 서버 상수(CURRENT_ADMIN_ACTOR)를 쓰고 body의
     * handledBy는 읽지 않는다. 결론 시각도 전이 함수가 서버에서 만든다.
     *
     * 어떤 전이가 허용되는지는 transitionRefundRequestByAdmin이 판단한다.
     * 규칙을 여기에 옮겨 적지 않는다. 그래서 클라이언트가 completed 같은 값을
     * 보내도 상태 머신을 건너뛸 수 없다.
     */
    const parsed = readTransitionRefundRequestBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    let result;
    try {
      result = await transitionRefundRequestByAdmin({
        refundRequestId: parsed.body.refundRequestId,
        expectedCurrentStatus: parsed.body.expectedCurrentStatus,
        targetStatus: parsed.body.targetStatus,
        handledBy: CURRENT_ADMIN_ACTOR,
      });
    } catch (error) {
      // 실패한 이유는 서버 기록에만 남긴다. SQL·스택은 응답에 담지 않는다.
      console.error("[admin] refund request transition failed", error);
      return NextResponse.json(
        { error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }
    if (!result.ok) {
      const failure = transitionFailureResponse(result.reason);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    // 바뀐 결과만 돌려준다. 근거는 목록(GET)이 이미 준다.
    return NextResponse.json(toTransitionRefundRequestResponse(result.request));
  }

  if (action === "createComplaintRecord") {
    /**
     * 일반 문의·채팅을 불만·분쟁 기록으로 승격한다.
     *
     * 관리자가 정하는 값은 어디에서 온 건인지(sourceType), 어떤 분류인지(category),
     * 요지(summary)와 선택적 연결(userId·orderId)뿐이다. id·접수 시각·상태는 서버가
     * 만들고, body의 status·createdAt·handledAt·handledBy는 읽지 않는다.
     *
     * 이름·연락처·guest token·원본 문의 id·대화 본문·금액·PG 정보를 읽는 자리가 없다.
     * 읽지 않으므로 함께 보내도 저장 계층에 닿지 않는다.
     *
     * 같은 주문에 환불 문의가 있다는 이유만으로 거절하지 않는다. 환불의 정본은
     * 그대로 refund_requests이며, 여기서 중복 판정을 새로 만들지 않는다.
     */
    const parsed = readCreateComplaintRecordBody(body);
    try {
      // 분류·요지 규칙은 저장 계층이 complaintRecordRules로 거른다.
      const record = await createComplaintRecord(parsed.body);
      return NextResponse.json({ ok: true, complaintRecord: record });
    } catch (error) {
      if (error instanceof ComplaintRecordError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // 실패한 이유는 서버 기록에만 남긴다. SQL·스택은 응답에 담지 않는다.
      console.error("[admin] complaint record create failed", error);
      return NextResponse.json(
        { error: "기록하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }
  }

  if (action === "markComplaintHandled") {
    /**
     * 불만 기록을 처리 완료로 표시한다.
     *
     * 관리자가 정하는 값은 어떤 기록인지(complaintRecordId) 하나뿐이다.
     * 실행자는 서버 상수(CURRENT_ADMIN_ACTOR)를 쓰고 body의 handledBy는 읽지 않는다.
     * 처리 시각도 저장 계층이 서버에서 만든다.
     *
     * open일 때만 바뀐다. 이미 처리된 기록과 없는 기록을 성공으로 돌려주지 않는다.
     */
    const parsed = readMarkComplaintHandledBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    let result;
    try {
      result = await markComplaintHandled({
        complaintRecordId: parsed.complaintRecordId,
        handledBy: CURRENT_ADMIN_ACTOR,
      });
    } catch (error) {
      console.error("[admin] complaint record handle failed", error);
      return NextResponse.json(
        { error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 },
      );
    }
    if (!result.ok) {
      const failure = markComplaintHandledFailureResponse(result.reason);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    // 바뀐 결과만 돌려준다. 근거는 목록(GET)이 이미 준다.
    return NextResponse.json({ ok: true, complaintRecord: result.record });
  }

  if (action === "executeApprovedRefund") {
    /**
     * 승인된 환불 문의의 실제 전액환불 실행.
     *
     * 관리자가 정하는 값은 어떤 문의인지(refundRequestId) 하나뿐이다. 주문·결제·거래
     * 번호·금액·회원은 body에서 읽지 않는다. 실행 대상 주문은 권한 확인이 DB에서 읽어
     * 준 값만 쓰므로, 그런 이름을 함께 보내도 실행 대상에 닿지 않는다.
     *
     * 권한 확인과 실행은 이 요청 안에서 이어서 일어난다. 확인 결과를 응답으로 돌려주고
     * 나중에 실행하는 구조를 만들지 않는다.
     */
    const parsed = readExecuteApprovedRefundBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    // 어떤 결과에서도 이 자리에서 취소나 복구를 다시 부르지 않는다.
    const response = await executeApprovedRefund(
      parsed.refundRequestId,
      await defaultExecuteApprovedRefundDeps(),
    );
    return NextResponse.json(response.body, { status: response.status });
  }

  if (action === "recoverApprovedRefund") {
    /**
     * 환불 실행 뒤 불확실·미반영 상태의 확인과 복구.
     *
     * 돈을 새로 취소하는 요청이 아니다. 결제사 거래조회로 지금 사실을 확인해
     * 내부 기록을 맞추기만 한다.
     *
     * 관리자가 정하는 값은 어떤 문의인지(refundRequestId) 하나뿐이다. 주문·결제·
     * 실행 단계·복구 경로는 body에서 읽지 않고 서버가 DB를 보고 정한다.
     */
    const parsed = readRecoverApprovedRefundBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    // 복구 경로는 helper가 하나만 고른다. 이 자리에서 취소나 다른 복구를 부르지 않는다.
    const response = await recoverApprovedRefund(
      parsed.refundRequestId,
      await defaultRecoverApprovedRefundDeps(),
    );
    return NextResponse.json(response.body, { status: response.status });
  }

  if (action === "restoreOrderPoints") {
    /**
     * 환불이 끝난 주문의 적립금 복원 재시도.
     *
     * PG 환불을 다시 실행하는 요청이 아니다. 결제사를 부르지 않고 결제·환불 문의
     * 상태도 바꾸지 않는다. 환불 완료 뒤 적립금 복원만 빠진 건을 다시 시도한다
     * (정상·복구 경로는 복원 실패를 삼키고 기록만 남기므로 그런 건이 남을 수 있다).
     *
     * 관리자가 정하는 값은 어떤 문의인지(refundRequestId) 하나뿐이다. 주문·회원·
     * 금액·적립금은 body에서 읽지 않는다. 복원 대상 주문은 권한 확인이 DB에서 읽어
     * 준 값만 쓰고, 금액과 회원은 복원 흐름이 주문·결제 기록에서 다시 읽는다.
     */
    const parsed = readRestoreOrderPointsBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    // 이 자리에서 취소나 환불 복구를 부르지 않는다. 부를 수 있는 것은 복원 흐름뿐이다.
    const response = await restoreOrderPointsByAdmin(
      parsed.refundRequestId,
      await defaultRestoreOrderPointsDeps(),
    );
    return NextResponse.json(response.body, { status: response.status });
  }

  if (action === "toggleBlockSlot") {
    const data = await readData();
    const teacher = String(body.teacher ?? DEFAULT_TEACHER);
    const date = String(body.date ?? "");
    const time = String(body.time ?? "");
    if (!date || !CONSULT_TIMES.includes(time)) {
      return NextResponse.json({ error: "날짜와 시간을 확인해 주세요." }, { status: 400 });
    }
    data.blockedSlots = toggleBlockedSlot(data, teacher, date, time);
    await writeData(data);
    return NextResponse.json({
      ok: true,
      slots: listSlotStatuses(data, teacher, date),
    });
  }

  if (action === "generateAdminPromo") {
    const percent = Math.floor(Number(body.percent));
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
      return NextResponse.json({ error: "할인율은 1%부터 90%까지 선택할 수 있습니다." }, { status: 400 });
    }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let tail = "";
    for (let i = 0; i < 6; i += 1) {
      tail += chars[Math.floor(Math.random() * chars.length)];
    }
    const data = await readData();
    data.adminPromo = {
      code: `AD${tail}`,
      percent,
      createdAt: new Date().toISOString(),
    };
    await writeData(data);
    return NextResponse.json({ ok: true, adminPromo: data.adminPromo });
  }

  if (action === "adjustPoints") {
    const userId = String(body.userId ?? "");
    const amount = Math.floor(Number(body.amount));
    const direction = String(body.direction ?? "");
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 10000000) {
      return NextResponse.json({ error: "적립금 금액을 확인해 주세요." }, { status: 400 });
    }
    if (direction !== "add" && direction !== "subtract") {
      return NextResponse.json({ error: "지급 또는 차감을 선택해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const current = user.points ?? 0;
    user.points = direction === "add" ? current + amount : Math.max(0, current - amount);
    await writeData(data);
    return NextResponse.json({ ok: true, user });
  }

  if (action === "giveCoupon") {
    const userId = String(body.userId ?? "");
    const product = String(body.product ?? "") as
      | "story"
      | "premium"
      | "saju-song"
      | "consultation";
    const titles: Record<typeof product, string> = {
      story: "이야기로 만드는 인생곡",
      premium: "프리미엄 인생곡",
      "saju-song": "사주 인생곡",
      consultation: "1:1 사주상담",
    };
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    if (!titles[product]) {
      return NextResponse.json({ error: "무료로 줄 상품을 선택해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const productTitle = titles[product];
    const next = [
      {
        id: nowId(),
        title: `${productTitle} 무료 쿠폰`,
        desc: `이 쿠폰으로 ${productTitle}을 무료로 신청할 수 있습니다.`,
        product,
        createdAt: new Date().toISOString(),
      },
      ...(data.coupons[userId] ?? []),
    ];
    data.coupons[userId] = next;
    data.notifications[userId] = [
      {
        id: nowId(),
        title: "무료 쿠폰이 도착했습니다",
        body: `이 쿠폰으로 ${productTitle}을 무료로 신청할 수 있습니다. MY 쿠폰함에서 확인해 주세요.`,
        createdAt: new Date().toISOString(),
        read: false,
        kind: "coupon",
      },
      ...(data.notifications[userId] ?? []),
    ];
    await writeData(data);
    return NextResponse.json({ ok: true, userId, coupons: next });
  }

  if (action === "notifyPromoCode") {
    const userId = String(body.userId ?? "");
    if (!userId) {
      return NextResponse.json({ error: "회원을 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const user = data.users.find((item) => item.id === userId);
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!data.adminPromo?.code) {
      return NextResponse.json({ error: "먼저 코드를 만들어 주세요." }, { status: 400 });
    }
    data.notifications[userId] = [
      {
        id: nowId(),
        title: "할인 코드가 도착했습니다",
        body: `결제할 때 ${data.adminPromo.code}를 넣으면 ${data.adminPromo.percent}% 할인됩니다.`,
        createdAt: new Date().toISOString(),
        read: false,
        kind: "promo",
      },
      ...(data.notifications[userId] ?? []),
    ];
    await writeData(data);
    return NextResponse.json({ ok: true });
  }

  if (action === "updateOrderStatus") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "") as OrderStatus;
    if (!id) {
      return NextResponse.json({ error: "주문을 확인해 주세요." }, { status: 400 });
    }
    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "진행 상태를 확인해 주세요." }, { status: 400 });
    }
    // 조회 기준은 목록(listAllOrders)과 같은 orders 테이블로 통일한다.
    // JSONB에만 남아 있던 주문 때문에 목록에는 보이는데 404가 나던 문제를 막는다.
    const found = await getOrderById(id);
    if (!found) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    /*
     * 환불이 끝난 주문은 진행 상태를 바꾸지 않는다.
     * 결제 환불 완료와 제작 완료는 다른 사실이므로, 환불 때문에 진행 상태를
     * 대신 바꿔 주지도 않는다. 여기서는 막기만 한다.
     *
     * 알림을 만들기 **전에** 본다. 막힌 요청에서 고객 알림이 남으면
     * 환불받은 분에게 "후기를 남기실 수 있습니다" 같은 안내가 가게 된다.
     */
    if (await hasCompletedRefundRequestForOrder(id)) {
      const locked = progressLockedByRefundResponse("order");
      return NextResponse.json({ error: locked.error }, { status: locked.status });
    }

    const order = { ...found, status };

    const data = await readData();
    // 이중 기록(dual-write)을 유지한다. JSONB에도 같은 주문이 있으면 함께 맞춰 둔다.
    const mirrored = data.orders.find((item) => item.id === id);
    if (mirrored) {
      mirrored.status = status;
      /*
       * 결과물을 처음 전달한 시각을 남긴다 (Privacy-Retention-Completion-Evidence-1).
       *
       * 개인정보 보관 기간의 기산점이라 한 번만 기록하고 절대 덮어쓰지 않는다.
       * 상태가 "완료"로 더 간다고 해서 기산점이 뒤로 밀리면 안 된다.
       * 어느 상태에서 남기는지는 serviceCompletion 한 곳이 정한다.
       *
       * JSONB에만 남긴다. orders 테이블에 같은 뜻의 열을 만들지 않는다.
       * 만들면 일반 주문 조회 경로가 그 열을 읽게 되고, 관리자가 정리를 부르기도
       * 전에 스키마 변경이 일반 요청에서 일어난다.
       */
      const deliveredAt = deliveredAtForStatus(status, new Date().toISOString());
      if (deliveredAt && !mirrored.deliveredAt) mirrored.deliveredAt = deliveredAt;
    }
    if (data.notificationSettings[order.userId]?.order !== false) {
      data.notifications[order.userId] = [
        {
          id: nowId(),
          title: `주문 상태가 ${status}로 바뀌었습니다`,
          body:
            status === "완성/전달" || status === "완료"
              ? `${order.title} 진행이 ${status}입니다. MY에서 후기를 남기실 수 있습니다.`
              : `${order.title} 진행이 ${status}입니다.`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[order.userId] ?? []),
      ];
    }
    /*
     * 마지막 관문. 위 확인과 저장 사이에 환불이 끝났을 수 있어, 저장 문장 안에서
     * 같은 조건을 한 번 더 본다. 막히면 주문도 app_store도 바뀌지 않는다
     * (알림도 같은 app_store에 담겨 있으므로 함께 저장되지 않는다).
     */
    const written = await writeDataWithOrderStatus(data, order.id, status);
    if (!written.applied) {
      const locked = progressLockedByRefundResponse("order");
      return NextResponse.json({ error: locked.error }, { status: locked.status });
    }
    return NextResponse.json({ ok: true, order });
  }

  if (action === "updateConsultationStatus") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "") as ConsultStatus;
    if (!id) {
      return NextResponse.json({ error: "사주상담을 확인해 주세요." }, { status: 400 });
    }
    if (!CONSULT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "진행 상태를 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const item = data.consultations.find((consult) => consult.id === id);
    if (!item) {
      return NextResponse.json({ error: "사주상담을 찾을 수 없습니다." }, { status: 404 });
    }
    /*
     * 상담도 같은 규칙이다. 상담과 결제 귀속 주문은 같은 id를 쓰므로(applyOrder.ts)
     * 이 id로 환불 문의를 찾는다.
     *
     * 짝이 되는 주문이 없는 옛 상담에는 환불 문의도 있을 수 없어 false가 나오고,
     * 기존 동작이 그대로 유지된다.
     *
     * 주문과 달리 상담은 app_store JSONB 안에 있어 저장 문장 안에서 같은 조건을
     * 걸 수 없다. 그래서 이 확인이 유일한 관문이며, 남는 경합은 문서로 남긴다.
     */
    if (await hasCompletedRefundRequestForOrder(id)) {
      const locked = progressLockedByRefundResponse("consultation");
      return NextResponse.json({ error: locked.error }, { status: locked.status });
    }
    item.status = status;
    /*
     * 처음 "상담 완료"가 될 때만 완료 시각을 남긴다(개인정보 보관 기간의 기산점).
     * 이미 값이 있으면 규칙 함수가 아무것도 바꾸지 않으므로, 상태가 되돌아갔다가
     * 다시 완료가 되어도 처음 시각이 그대로 남는다. 시각은 서버가 만든다.
     */
    applyConsultationCompletion(item, status, new Date().toISOString());
    if (data.notificationSettings[item.userId]?.consult !== false) {
      data.notifications[item.userId] = [
        {
          id: nowId(),
          title: `사주상담 상태가 ${status}로 바뀌었습니다`,
          body:
            status === "상담 완료"
              ? `${item.teacher} · ${item.datetime}. MY에서 후기를 남기실 수 있습니다.`
              : `${item.teacher} · ${item.datetime}`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...(data.notifications[item.userId] ?? []),
      ];
    }
    await writeData(data);
    return NextResponse.json({ ok: true, consultation: item });
  }

  if (action === "toggleReviewVisible") {
    const id = String(body.id ?? "");
    const visible = Boolean(body.visible);
    if (!id) {
      return NextResponse.json({ error: "후기를 확인해 주세요." }, { status: 400 });
    }
    const data = await readData();
    const review = (data.reviews ?? []).find((item) => item.id === id);
    if (!review) {
      return NextResponse.json({ error: "후기를 찾을 수 없습니다." }, { status: 404 });
    }
    review.visible = visible;
    await writeData(data);
    return NextResponse.json({ ok: true, review });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
