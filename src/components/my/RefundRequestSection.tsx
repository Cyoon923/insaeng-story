"use client";

/**
 * 주문 상세에서 쓰는 환불 문의 영역 (Refund-Customer-Song-UI-1).
 *
 * 하는 일은 두 가지다. 지금 처리 중인 환불 문의가 있으면 그 상태를 보여주고,
 * 없으면 새로 접수할 수 있게 한다.
 *
 * 하지 않는 일
 * - 환불이 되는지 안 되는지 판단하지 않는다. 서버도 하지 않는 판단이다.
 * - 제작 착수 여부나 상담 취소창(3시간)을 계산해 보여주지 않는다. 그 근거는
 *   애초에 고객 응답에 담기지 않는다.
 * - 관리자용 값(접수 당시 snapshot·처리 기록·PG 정보)은 받지도 보여주지도 않는다.
 *   화면이 읽는 것은 ActiveRefundRequestSummary의 네 값(id·orderId·status·requestedAt)뿐이다.
 *
 * 상태 판단과 입력 확인은 lib/refundRequestSection.ts에 있다. 여기서는 그 결과를 그린다.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchMe, postApp } from "@/lib/client/api";
import {
  REFUND_ACTIVE_MESSAGE,
  REFUND_COMPLETED_MESSAGE,
  REFUND_MESSAGE_MAX,
  REFUND_REASON_OPTIONS,
  REFUND_REJECTED_GUIDE,
  REFUND_REJECTED_MESSAGE,
  REFUND_UNAVAILABLE_MESSAGE,
  checkRefundForm,
  refundSectionState,
} from "@/lib/refundRequestSection";
import type { RefundSectionState } from "@/lib/refundRequestSection";
import type { ActiveRefundRequestsView, LatestRefundRequestsView } from "@/lib/types/app";

/** 접수 시각 표시. 신청 화면들과 같은 방식이다. */
function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}

export function RefundRequestSection({ orderId }: { orderId: string }) {
  /** 처음에는 아직 읽기 전이다. 읽지 못한 것과 구분하려고 null로 둔다. */
  const [state, setState] = useState<RefundSectionState | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /**
   * 서버가 가진 활성 상태를 그대로 가져온다.
   *
   * 읽지 못하면 unavailable로 둔다. 빈 목록으로 바꿔 "문의 없음"처럼 보이게 하지 않는다.
   */
  const readState = useCallback(async (): Promise<RefundSectionState> => {
    try {
      const data = await fetchMe();
      // 처리 중인 문의와 끝난 문의는 서로 다른 필드에 온다. 둘을 함께 봐야
      // "접수한 적 없음"과 "이미 끝남"을 구분할 수 있다.
      return refundSectionState(
        data?.refundRequests as ActiveRefundRequestsView | undefined,
        data?.latestRefundRequests as LatestRefundRequestsView | undefined,
        orderId,
      );
    } catch {
      return { kind: "unavailable" };
    }
  }, [orderId]);

  // 화면에 들어올 때 한 번 읽는다. 기존 MY 화면들과 같은 방식이다.
  useEffect(() => {
    readState().then(setState);
  }, [readState]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    // 보내기 전 확인은 사용자를 돕기 위한 것이고, 통과해도 서버가 다시 본다.
    const checked = checkRefundForm({ reason, message });
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      // 클라이언트가 정하는 값은 이 세 가지뿐이다. userId·상태·접수 시각·접수 당시
      // 기록은 모두 서버가 만든다.
      await postApp({
        action: "createRefundRequest",
        orderId,
        reason,
        message: message.trim(),
      });
      setOpen(false);
      setReason("");
      setMessage("");
      // 접수 결과를 화면이 지어내지 않는다. 서버가 가진 상태를 다시 읽어 보여준다.
      setState(await readState());
    } catch (caught) {
      /*
       * 접수가 거절된 경우(409)에는 오류로 끝내지 않는다. 처리 중인 문의가 있었거나
       * (active-exists) 이미 끝난 문의가 있었을(closed-exists) 수 있으므로, 두 목록을
       * 다시 읽어 서버가 아는 상태를 보여주는 편이 고객에게 맞다.
       *
       * HTTP 상태 코드를 따로 읽지 않는다. 그러려고 client API 구조를 새로 만들기보다,
       * 서버가 가진 상태를 다시 읽어 확인하는 편이 화면과 서버가 어긋나지 않는다.
       * 다시 읽어도 접수할 수 있는 상태(none)로 보이면 서버가 준 문구를 그대로 보여준다.
       */
      const next = await readState();
      setState(next);
      if (next.kind === "none") {
        setError(caught instanceof Error ? caught.message : "환불 문의를 접수하지 못했습니다.");
      } else {
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  // 아직 읽기 전에는 아무것도 단정하지 않는다.
  if (!state) return null;

  return (
    <section className="px-4 pb-8">
      <h3 className="mb-3 text-[17px] font-bold text-[#403A49]">환불 문의</h3>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
        {state.kind === "unavailable" || state.kind === "inconsistent" ? (
          /*
           * 읽지 못한 것을 "신청 없음"이나 "환불 가능"으로 보여주지 않는다.
           * 두 목록이 어긋난 경우도 같은 안내를 쓴다. 내부 사정을 알리지 않고,
           * 고객이 할 일(다시 확인)이 같기 때문이다.
           */
          <p className="text-[15px] leading-relaxed text-[#8a5a3b]">
            {REFUND_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}

        {state.kind === "active" ? (
          <>
            <p className="text-[16px] font-semibold text-[#403A49]">
              {REFUND_ACTIVE_MESSAGE[state.request.status]}
            </p>
            <p className="mt-2 text-[15px] text-[#6B6570]">
              접수일 {formatDate(state.request.requestedAt)}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B6570]">
              접수 후 담당자가 확인하여 안내드립니다.
            </p>
          </>
        ) : null}

        {state.kind === "rejected" ? (
          <>
            {/* "환불 불가"라고 적지 않는다. 거절 사유도 추측해 적지 않는다. */}
            <p className="text-[16px] font-semibold text-[#403A49]">{REFUND_REJECTED_MESSAGE}</p>
            <p className="mt-2 text-[15px] text-[#6B6570]">
              접수일 {formatDate(state.request.requestedAt)}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B6570]">
              {REFUND_REJECTED_GUIDE}
            </p>
          </>
        ) : null}

        {state.kind === "completed" ? (
          <>
            {/* approved의 "처리 중"과 다른 말이다. 실제 환불까지 끝난 상태다. */}
            <p className="text-[16px] font-semibold text-[#403A49]">{REFUND_COMPLETED_MESSAGE}</p>
            <p className="mt-2 text-[15px] text-[#6B6570]">
              접수일 {formatDate(state.request.requestedAt)}
            </p>
          </>
        ) : null}

        {state.kind === "none" && !open ? (
          <>
            <p className="text-[15px] leading-relaxed text-[#6B6570]">
              환불이 필요하시면 문의를 남겨 주세요.
              <br />
              접수 후 담당자가 확인하여 안내드립니다.
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setError("");
              }}
              className="mt-4 h-12 w-full rounded-full bg-[#403A49] text-[16px] font-semibold text-white"
            >
              환불 문의하기
            </button>
          </>
        ) : null}

        {state.kind === "none" && open ? (
          <form onSubmit={handleSubmit}>
            <fieldset className="border-0 p-0">
              <legend className="text-[16px] font-semibold text-[#403A49]">
                환불 문의 사유를 선택해 주세요
              </legend>
              <div className="mt-3 space-y-2">
                {REFUND_REASON_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-[16px] ring-1 ${
                      reason === option.value
                        ? "bg-[#f5efe6] font-semibold text-[#403A49] ring-[#d4c8ba]"
                        : "bg-white text-[#403A49] ring-[#ebe3d8]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="refund-reason"
                      value={option.value}
                      checked={reason === option.value}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setError("");
                      }}
                      className="h-5 w-5 accent-[#403A49]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="refund-message" className="mt-5 block text-[16px] font-semibold text-[#403A49]">
              자세한 내용
              <span className="ml-2 text-[14px] font-normal text-[#6B6570]">
                {reason === "other" ? "필수" : "선택"}
              </span>
            </label>
            <textarea
              id="refund-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setError("");
              }}
              rows={5}
              maxLength={REFUND_MESSAGE_MAX}
              placeholder="환불이 필요한 이유를 적어 주세요."
              className="mt-2 w-full rounded-2xl bg-white p-4 text-[16px] leading-relaxed text-[#3d2b1f] ring-1 ring-[#ebe3d8]"
            />
            <p className="mt-1 text-right text-[14px] text-[#6B6570]">
              {message.length} / {REFUND_MESSAGE_MAX}자
            </p>

            {error ? <p className="mt-3 text-[15px] text-[#8a5a3b]">{error}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                }}
                disabled={busy}
                className="h-12 flex-1 rounded-full bg-white text-[16px] font-semibold text-[#403A49] ring-1 ring-[#ebe3d8] disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-12 flex-1 rounded-full bg-[#403A49] text-[16px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? "접수 중..." : "문의 접수하기"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
