"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getDraft } from "@/lib/client/api";

export const STORY_STEPS = [
  { num: 1, label: "기본정보" },
  { num: 2, label: "이야기 주인공" },
  { num: 3, label: "이야기 작성" },
  { num: 4, label: "노래 스타일" },
  { num: 5, label: "추가 옵션" },
  { num: 6, label: "확인 및 결제" },
];

export const SAJU_STEPS = [
  { num: 1, label: "사주 정보" },
  { num: 2, label: "노래 스타일" },
  { num: 3, label: "추가 옵션" },
  { num: 4, label: "확인 및 결제" },
];

export const CONSULT_STEPS = [
  { num: 1, label: "예약 선택" },
  { num: 2, label: "상담 정보" },
  { num: 3, label: "상담 내용" },
  { num: 4, label: "확인 및 결제" },
];

interface ApplyStepperProps {
  currentStep: number;
  basePath?: string;
  steps?: { num: number; label: string }[];
}

export function ApplyStepper({
  currentStep,
  basePath = "/apply/story-song",
  steps = STORY_STEPS,
}: ApplyStepperProps) {
  return (
    <div className="border-b border-border bg-cream px-2 py-4">
      <div className="flex items-start justify-between">
        {steps.map((step, i) => {
          const isActive = step.num === currentStep;
          const isDone = step.num < currentStep;
          return (
            <div key={step.num} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div className={cn("h-px flex-1", isDone || isActive ? "bg-brown" : "bg-border")} />
                )}
                <Link
                  href={step.num <= currentStep ? `${basePath}/${step.num}` : "#"}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isActive && "bg-brown text-white",
                    isDone && "bg-brown/20 text-brown",
                    !isActive && !isDone && "bg-ivory text-brown-light"
                  )}
                >
                  {step.num}
                </Link>
                {i < steps.length - 1 && (
                  <div className={cn("h-px flex-1", isDone ? "bg-brown" : "bg-border")} />
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-center text-[9px] leading-tight",
                  isActive ? "font-semibold text-brown" : "text-brown-light"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function contactMissingMessage(flow: string) {
  const draft = getDraft(flow);
  if (!draft.name?.trim()) return "이름을 적어 주세요.";
  const phone = (draft.phone ?? "").replace(/\D/g, "");
  if (phone.length < 10) return "연락처를 적어 주세요.";
  return "";
}

export function ApplyNavButtons({
  prevHref,
  nextHref,
  nextLabel = "다음 단계로 >",
  requireContactFlow,
}: {
  prevHref?: string;
  nextHref: string;
  nextLabel?: string;
  requireContactFlow?: string;
}) {
  const router = useRouter();

  const goNext = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!requireContactFlow) return;
    event.preventDefault();
    const message = contactMissingMessage(requireContactFlow);
    if (message) {
      window.alert(message);
      return;
    }
    router.push(nextHref);
  };

  return (
    <div className="flex gap-3 px-4 py-4">
      {prevHref ? (
        <Link
          href={prevHref}
          className="flex flex-1 items-center justify-center rounded-full border-2 border-brown py-3.5 text-sm font-semibold text-brown"
        >
          &lt; 이전 단계
        </Link>
      ) : (
        <div className="flex-1" />
      )}
      <Link
        href={nextHref}
        onClick={goNext}
        className="flex flex-[2] items-center justify-center rounded-full bg-brown py-3.5 text-sm font-semibold text-white"
      >
        {nextLabel}
      </Link>
    </div>
  );
}
