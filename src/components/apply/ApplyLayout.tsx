import Image from "next/image";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { ApplyStepper, ApplyNavButtons } from "@/components/apply/ApplyStepper";

interface ApplyLayoutProps {
  step: number;
  children: React.ReactNode;
  prevHref?: string;
  nextHref?: string;
  nextLabel?: string;
  hideNav?: boolean;
}

export function ApplyLayout({
  step,
  children,
  prevHref,
  nextHref,
  nextLabel,
  hideNav = false,
}: ApplyLayoutProps) {
  return (
    <MobileShell>
      <AppHeader variant="apply" title="인생곡 신청하기" backHref={prevHref ?? "/products/story"} showActions />
      <div className="relative h-36 w-full">
        <Image
          src="https://images.unsplash.com/photo-1455396577869-51adff057779?w=800&h=300&fit=crop"
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-0 p-4 text-white">
          <p className="text-sm font-bold leading-snug">
            당신의 이야기가
            <br />
            세상에 단 하나뿐인 노래가 됩니다
          </p>
        </div>
      </div>
      <ApplyStepper currentStep={step} />
      <div className="px-4 py-5">{children}</div>
      {!hideNav && nextHref && (
        <ApplyNavButtons prevHref={prevHref} nextHref={nextHref} nextLabel={nextLabel} />
      )}
    </MobileShell>
  );
}
