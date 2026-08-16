import { BottomNav } from "./BottomNav";
import { BenefitNotice } from "./BenefitNotice";

interface MobileShellProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}

export function MobileShell({ children, hideBottomNav = false }: MobileShellProps) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#faf8f5] shadow-xl">
      <main className={hideBottomNav ? "min-h-screen" : "min-h-screen pb-20"}>{children}</main>
      <BenefitNotice />
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
