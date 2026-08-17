import Image from "next/image";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { ApplyStepper, ApplyNavButtons, STORY_STEPS } from "@/components/apply/ApplyStepper";

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
}: ApplyLayoutProps) {
  const isConsultation = basePath.startsWith("/apply/consultation");
  const heroSrc =
    heroImage ??
    (basePath.startsWith("/apply/consultation")
      ? "/images/life-graph-radar.png"
      : "/images/photo-hero.jpg");

  return (
    <MobileShell>
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
      <ApplyStepper currentStep={step} basePath={basePath} steps={steps} />
      <div className="px-4 py-5">{children}</div>
      {!hideNav && nextHref && (
        <ApplyNavButtons
          prevHref={prevHref}
          nextHref={nextHref}
          nextLabel={nextLabel}
          requireContactFlow={requireContactFlow}
        />
      )}
    </MobileShell>
  );
}
