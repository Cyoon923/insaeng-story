import Image from "next/image";
import { ApplyPhoneGate } from "@/components/apply/ApplyPhoneGate";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  ApplyStepper,
  ApplyNavButtons,
  STORY_STEPS,
  type ApplyStepperTheme,
} from "@/components/apply/ApplyStepper";

interface ApplyLayoutProps {
  step: number;
  children: React.ReactNode;
  prevHref?: string;
  nextHref?: string;
  nextLabel?: string;
  hideNav?: boolean;
  title?: string;
  backHref?: string;
  basePath?: string;
  steps?: { num: number; label: string }[];
  heroText?: string;
  heroImage?: string;
  requireContactFlow?: string;
  /** 이 단계의 필수 입력 검사. 문구를 돌려주면 다음 단계로 가지 않는다. */
  validateNext?: () => string;
  /** 스텝퍼 강조 배색. 넘기지 않으면 기존 브라운 그대로다. */
  stepperTheme?: ApplyStepperTheme;
  /** 셸 배경. 넘기지 않으면 기존 아이보리 그대로다. */
  shellBg?: string;
}

export function ApplyLayout({
  step,
  children,
  prevHref,
  nextHref,
  nextLabel,
  hideNav = false,
  title = "인생곡 신청하기",
  backHref,
  basePath = "/apply/story-song",
  steps = STORY_STEPS,
  heroText = "당신의 이야기가\n세상에 단 하나뿐인 노래가 됩니다",
  heroImage,
  requireContactFlow,
  validateNext,
  stepperTheme,
  shellBg,
}: ApplyLayoutProps) {
  const isConsultation = basePath.startsWith("/apply/consultation");
  const heroSrc =
    heroImage ??
    (basePath.startsWith("/apply/consultation")
      ? "/images/life-graph-radar.png"
      : "/images/photo-hero.jpg");

  return (
    <MobileShell bgClass={shellBg}>
      {/*
        휴대폰 본인확인 관문. 신청 화면 전체가 이 레이아웃을 쓰므로 여기 한 곳에 둔다.
        서버 관문(api/app의 verifiedPhoneGate)을 대신하는 것이 아니라, 막힐 것을 알면서
        신청서를 다 쓰게 두지 않으려는 안내다.
      */}
      <ApplyPhoneGate />
      <AppHeader
        variant="apply"
        title={title}
        backHref={backHref ?? prevHref ?? "/products/story"}
        showActions
      />
      <div className="relative h-36 w-full">
        <Image
          src={heroSrc}
          alt=""
          fill
          className={`object-cover ${isConsultation ? "object-center" : "object-[70%_center]"}`}
        />
        <div className="absolute inset-0 bg-[#3d2b1f]/45" />
        <div className="absolute bottom-0 p-4 text-white">
          <p className="text-[15px] font-bold leading-snug whitespace-pre-line">{heroText}</p>
        </div>
      </div>
      <ApplyStepper currentStep={step} basePath={basePath} steps={steps} theme={stepperTheme} />
      <div className="px-4 py-5">{children}</div>
      {!hideNav && nextHref && (
        <ApplyNavButtons
          prevHref={prevHref}
          nextHref={nextHref}
          nextLabel={nextLabel}
          requireContactFlow={requireContactFlow}
          validateNext={validateNext}
        />
      )}
    </MobileShell>
  );
}
