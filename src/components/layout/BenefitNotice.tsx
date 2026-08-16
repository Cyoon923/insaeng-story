"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, postApp } from "@/lib/client/api";
import type { AppNotification } from "@/lib/types/app";

export function BenefitNotice() {
  const pathname = usePathname();
  const router = useRouter();
  const [note, setNote] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    fetchMe().then((data) => {
      if (!data.user) return;
      const next = ((data.notifications ?? []) as AppNotification[]).find(
        (item) => !item.read && (item.kind === "coupon" || item.kind === "promo"),
      );
      setNote(next ?? null);
    });
  }, [pathname]);

  if (pathname.startsWith("/admin") || !note) return null;

  const close = async () => {
    const id = note.id;
    setNote(null);
    await postApp({ action: "readNotifications", ids: [id] });
  };

  const goCoupons = async () => {
    await close();
    router.push("/my/coupons");
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[380px] rounded-2xl bg-white p-5 ring-1 ring-[#ebe3d8]">
        <p className="text-[20px] font-bold leading-snug text-[#3d2b1f]">{note.title}</p>
        <p className="mt-3 text-[16px] leading-relaxed text-[#5c3d2e]">{note.body}</p>
        <button
          type="button"
          onClick={close}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[16px] font-semibold text-white"
        >
          확인
        </button>
        {note.kind === "coupon" ? (
          <button
            type="button"
            onClick={goCoupons}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[16px] font-semibold text-[#5c3d2e]"
          >
            쿠폰함 보기
          </button>
        ) : null}
      </div>
    </div>
  );
}
