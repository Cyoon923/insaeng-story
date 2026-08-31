import { BottomNav } from "./BottomNav";
import { BenefitNotice } from "./BenefitNotice";

interface MobileShellProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
  /** 셸 배경. 기본값은 기존 아이보리이며, 넘기지 않은 화면은 그대로 유지된다. */
  bgClass?: string;
}

export function MobileShell({
  children,
  hideBottomNav = false,
  bgClass = "bg-[#faf8f5]",
}: MobileShellProps) {
  return (
    <div className={`mx-auto min-h-screen w-full max-w-[430px] ${bgClass} shadow-xl`}>
      <main className={hideBottomNav ? "min-h-screen" : "min-h-screen pb-20"}>{children}</main>
      <BenefitNotice />
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
