"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clearDraft, getDraft, postApp } from "@/lib/client/api";
import {
  EVENT_CONSULTATION_DRAFT_FLOW,
  eventConsultationAutoBookBody,
  readEventConsultationPreselect,
} from "@/lib/server/eventConsultation";

type AutoBookState =
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "booked"; consultationId: string; label: string }
  | { kind: "failed"; message: string };

const SLOT_TAKEN_MESSAGE = "선택하신 상담 시간이 마감되었습니다. 다른 시간을 선택해 주세요.";

/**
 * OPEN EVENT 상담 포함 주문의 완료 화면.
 *
 * 신청 2단계에서 고른 일정(event-consultation draft)이 있으면 기존 bookEventConsultation을
 * 한 번만 부른다. 결제·주문은 이미 끝났으므로 예약이 실패해도 그대로 두고,
 * 기존 예약 버튼(MY와 같은 화면)으로 다른 시간을 고르게 한다.
 * 이미 예약이 있으면 서버가 bookedId를 넘겨 주므로 다시 부르지 않는다.
 */
export function EventConsultationAutoBook({
  orderId,
  bookHref,
  bookedId,
}: {
  orderId: string;
  bookHref: string;
  bookedId: string;
}) {
  const [state, setState] = useState<AutoBookState>(
    bookedId ? { kind: "booked", consultationId: bookedId, label: "" } : { kind: "checking" },
  );
  const started = useRef(false);

  useEffect(() => {
    if (bookedId || started.current) return;
    started.current = true;
    const preselect = readEventConsultationPreselect(getDraft(EVENT_CONSULTATION_DRAFT_FLOW));
    // 고른 일정이 없으면(다른 기기 결제, 예전 신청) 기존 예약 버튼만 보인다.
    const booking = preselect
      ? postApp(eventConsultationAutoBookBody(orderId, preselect))
      : Promise.resolve(null);
    booking
      .then((data) => {
        if (!preselect || !data) {
          setState({ kind: "none" });
          return;
        }
        clearDraft(EVENT_CONSULTATION_DRAFT_FLOW);
        setState({
          kind: "booked",
          consultationId: String(data.consultation?.id ?? ""),
          label: `${preselect.teacher} · ${preselect.datetime}`,
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "";
        setState({
          kind: "failed",
          message: /시간/.test(message)
            ? SLOT_TAKEN_MESSAGE
            : "상담 예약을 마치지 못했습니다. 아래 버튼으로 예약해 주세요.",
        });
      });
  }, [orderId, bookedId]);

  if (state.kind === "checking") {
    return (
      <p className="mb-4 rounded-2xl bg-[#f5efe6] p-4 text-center text-[15px] text-[#403A49]">
        선택하신 상담 일정을 예약하고 있습니다...
      </p>
    );
  }

  if (state.kind === "booked") {
    return (
      <div className="mb-4 rounded-2xl bg-[#f5efe6] p-4 text-center">
        <p className="text-[16px] font-bold text-[#403A49]">1:1 사주상담 예약이 완료되었습니다</p>
        {state.label ? <p className="mt-1 text-[15px] text-[#403A49]">{state.label}</p> : null}
        <p className="mt-2 text-[13px] text-[#6B6570]">상담 전에 궁금한 내용은 선생님이 확인해드립니다.</p>
        {state.consultationId ? (
          <Link
            href={`/my/consultations/${encodeURIComponent(state.consultationId)}`}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-lg border-2 border-[#403A49] text-[15px] font-semibold text-[#403A49]"
          >
            상담 예약 보기
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {state.kind === "failed" ? (
        <p className="mb-3 rounded-2xl bg-[#f5efe6] p-4 text-center text-[15px] leading-relaxed text-[#403A49]">
          {state.message}
        </p>
      ) : null}
      <Link
        href={bookHref}
        className="mb-3 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white"
      >
        1:1 사주상담 예약하기
      </Link>
      <p className="mb-4 text-center text-[13px] text-[#6B6570]">
        이벤트에 포함된 상담입니다. 추가 결제 없이 날짜와 시간을 예약하세요.
      </p>
    </>
  );
}
