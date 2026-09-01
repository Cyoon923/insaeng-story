import Link from "next/link";
import { Gift, HelpCircle, Megaphone } from "lucide-react";

const LINKS = [
  { href: "/events", icon: Gift, label: "이벤트", desc: "진행 중인 이벤트와\n혜택 확인하기" },
  { href: "/faq", icon: HelpCircle, label: "자주 묻는 질문", desc: "궁금한 내용을\n확인해보세요" },
  { href: "/notice", icon: Megaphone, label: "공지사항", desc: "사주로그의\n소식을 확인하세요" },
];

export function QuickLinks() {
  return (
    <section className="border-t border-[#ebe3d8] bg-[#FFFFFF] px-4 py-4">
      <div className="flex divide-x divide-[#e0d5c8] rounded-2xl bg-[#F7F6F8] py-4 ring-1 ring-[#ebe3d8]">
        {LINKS.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href} className="flex flex-1 flex-col items-center px-2 text-center">
            <Icon className="mb-2 h-7 w-7 text-[#5c3d2e]" strokeWidth={1.4} />
            <span className="text-[13px] font-bold text-[#3d2b1f]">{label}</span>
            <span className="mt-1 whitespace-pre-line text-[9px] leading-snug text-[#6B6570]">{desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
