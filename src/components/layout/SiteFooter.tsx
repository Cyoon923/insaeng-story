"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 공통 하단 Footer. 기본은 링크만 간결하게 두고,
 * 법적 표기용 사업자 정보는 눌렀을 때만 펼친다.
 * 통신판매업 신고번호와 고객센터 전화번호는 확정 후 추가한다.
 */
const BUSINESS_INFO = [
  "비앤비어드바이저리",
  "대표 정문경",
  "사업자등록번호 158-25-00095",
  "경기도 안산시 단원구 시화호수로 623, 2825호 (성곡동, 아티스큐브2차)",
] as const;

const linkClass = "text-[12px] text-[#6B6570]";

export function SiteFooter() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 관리자 화면에는 노출하지 않는다.
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="border-t border-[#ebe3d8] bg-[#fffdf9] px-5 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/terms" className={linkClass}>
          이용약관
        </Link>
        <Link href="/privacy" className={linkClass}>
          개인정보처리방침
        </Link>
        <Link href="/refund" className={linkClass}>
          취소·환불정책
        </Link>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={`${linkClass} underline underline-offset-2`}
        >
          사업자정보
        </button>
        <span className="ml-auto text-[12px] text-[#6B6570]">© 사주로그</span>
      </div>

      {open ? (
        <div className="mt-3 border-t border-[#ebe3d8] pt-3">
          {BUSINESS_INFO.map((line) => (
            <p key={line} className="text-[12px] leading-relaxed text-[#6B6570]">
              {line}
            </p>
          ))}
          <p className="text-[12px] leading-relaxed text-[#6B6570]">
            고객센터{" "}
            <a href="mailto:code8jmk@gmail.com" className="underline underline-offset-2">
              code8jmk@gmail.com
            </a>
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-[12px] text-[#6B6570] underline underline-offset-2"
          >
            닫기
          </button>
        </div>
      ) : null}
    </footer>
  );
}
