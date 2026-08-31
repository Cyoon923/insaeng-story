"use client";

import { useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

export default function LogoutPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const logout = async () => {
    try {
      await postApp({ action: "logout" });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그아웃에 실패했습니다.");
    }
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="로그아웃" backHref="/my" showActions={false} />

      <div className="px-5 py-10 text-center">
        {done ? (
          <>
            <h2 className="font-serif text-[24px] font-bold text-[#403A49]">로그아웃되었습니다</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B6570]">
              홈에서 서비스를 계속 이용하실 수 있습니다.
            </p>
            <Link
              href="/login"
              className="mt-8 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white"
            >
              로그인하기
            </Link>
            <Link
              href="/"
              className="mt-3 flex h-14 w-full items-center justify-center rounded-full border-2 border-[#403A49] text-[16px] font-semibold text-[#403A49]"
            >
              홈으로
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-serif text-[24px] font-bold text-[#403A49]">로그아웃 하시겠어요?</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6B6570]">
              로그아웃하면 MY의 진행 현황은
              <br />
              다시 로그인해야 확인할 수 있습니다.
            </p>
            {error ? <p className="mt-3 text-[14px] text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={logout}
              className="mt-8 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white"
            >
              로그아웃
            </button>
            <Link
              href="/my"
              className="mt-3 flex h-14 w-full items-center justify-center rounded-full border-2 border-[#403A49] text-[16px] font-semibold text-[#403A49]"
            >
              취소
            </Link>
          </>
        )}
      </div>
    </MobileShell>
  );
}
