"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Music, MessageCircle, Play, User } from "lucide-react";
import { BOTTOM_NAV, getActiveTab } from "@/lib/constants/navigation";

const ICONS = {
  home: Home,
  music: Music,
  message: MessageCircle,
  play: Play,
  user: User,
} as const;

export function BottomNav() {
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-[#ebe3d8] bg-[#fffdf9]">
      <ul className="flex h-[60px] items-stretch">
        {BOTTOM_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = activeTab === item.id;
          return (
            <li key={item.id} className="flex flex-1">
              <Link
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
                  isActive ? "font-bold text-[#5c3d2e]" : "font-medium text-[#6B6570]"
                }`}
              >
                <Icon
                  className={`h-[22px] w-[22px] ${isActive ? "text-[#5c3d2e]" : "text-[#6B6570]"}`}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
