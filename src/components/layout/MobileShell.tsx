import { BottomNav } from "./BottomNav";
import { BenefitNotice } from "./BenefitNotice";
import { SiteFooter } from "./SiteFooter";

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
      {/* 하단 여백은 기존 pb-20(5rem)에 홈 인디케이터 높이를 더한다. safe-area가 0이면 pb-20과 같다. */}
      <main
        className={
          hideBottomNav
            ? "min-h-screen"
            : "min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))]"
        }
      >
        {children}
        <SiteFooter />
      </main>
      <BenefitNotice />
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
