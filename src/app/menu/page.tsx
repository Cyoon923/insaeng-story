"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";

const GROUPS = [
  {
    title: "바로가기",
    items: [
      { label: "홈", href: "/" },
      { label: "인생곡", href: "/products" },
      { label: "사주상담", href: "/consultation" },
      { label: "유튜브", href: "/cases" },
      { label: "MY", href: "/my" },
    ],
  },
  {
    title: "안내",
    items: [
      { label: "이벤트", href: "/events?from=menu" },
      { label: "자주 묻는 질문", href: "/faq?from=menu" },
      { label: "공지사항", href: "/notice?from=menu" },
      { label: "이용 안내", href: "/guide?from=menu" },
      { label: "이용약관", href: "/terms?from=menu" },
      { label: "개인정보 처리방침", href: "/privacy?from=menu" },
    ],
  },
];

/** 계정 그룹은 로그인 상태에 따라 달라진다. */
function accountGroup(loggedIn: boolean) {
  return {
    title: "계정",
    items: loggedIn
      ? [{ label: "로그아웃", href: "/my/logout" }]
      : [{ label: "로그인", href: "/login" }],
  };
}

export default function MenuPage() {
  // 로그인 여부는 MY 화면과 같은 방식(GET /api/app 의 user)을 그대로 쓴다.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setLoggedIn(Boolean(data.user));
      })
      .catch(() => {
        setLoggedIn(false);
      });
  }, []);

  const groups = loggedIn === null ? GROUPS : [...GROUPS, accountGroup(loggedIn)];

  return (
    <MobileShell>
      <AppHeader variant="page" title="메뉴" backHref="/" showActions={false} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">메뉴</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">원하시는 화면으로 이동하세요.</p>
      </section>

      <div className="px-4 pb-8">
        {groups.map((group) => (
          <section key={group.title} className="mb-6">
            <h3 className="mb-2 text-[15px] font-bold text-[#6B6570]">{group.title}</h3>
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#ebe3d8]">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between border-b border-[#ebe3d8] px-4 py-4 last:border-0"
                >
                  <span className="text-[16px] font-medium text-[#3d2b1f]">{item.label}</span>
                  <ChevronRight className="h-5 w-5 text-[#8b6f5c]" />
                </Link>
              ))}
            </div>
          </section>
        ))}
        {loggedIn === false ? (
          <Link
            href="/signup"
            className="mt-2 flex h-14 w-full items-center justify-center rounded-lg bg-[#403A49] text-[16px] font-bold text-white"
          >
            회원가입
          </Link>
        ) : null}
      </div>
    </MobileShell>
  );
}
