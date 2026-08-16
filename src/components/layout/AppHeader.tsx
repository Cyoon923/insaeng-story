"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Bell, ChevronLeft, Share2 } from "lucide-react";

async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      return ok;
    } catch {
      return false;
    }
  }
}

interface AppHeaderProps {
  variant?: "home" | "page" | "apply";
  title?: string;
  subtitle?: string;
  backHref?: string;
  showMenu?: boolean;
  showBell?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export function AppHeader({
  variant = "home",
  title,
  subtitle = "당신의 이야기를 노래로",
  backHref,
  showMenu = variant === "home",
  showBell = variant === "home",
  showActions = variant === "page" || variant === "apply",
  compact = false,
}: AppHeaderProps) {
  const [shareMessage, setShareMessage] = useState("");

  const shareCurrentPage = async () => {
    const url = window.location.href;
    const titleText = document.title;

    if (navigator.share) {
      try {
        await navigator.share({ title: titleText, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const copied = await copyLink(url);
    setShareMessage(copied ? "링크를 복사했습니다." : "링크를 복사하지 못했습니다.");
    window.setTimeout(() => setShareMessage(""), 2500);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#ebe3d8] bg-[#fffdf9]/95 backdrop-blur-sm">
      <div className={`flex items-center justify-between px-4 ${compact ? "h-12" : "h-[52px]"}`}>
        <div className="flex w-10 items-center justify-start">
          {backHref ? (
            <Link href={backHref} className="rounded-lg p-2 text-brown hover:bg-ivory" aria-label="뒤로">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          ) : showMenu ? (
            <Link href="/menu" className="rounded-lg p-2 text-brown hover:bg-ivory" aria-label="메뉴">
              <Menu className="h-5 w-5" />
            </Link>
          ) : (
            <span className="w-5" />
          )}
        </div>

        <div className="flex flex-1 flex-col items-center text-center">
          <h1 className={`font-bold text-[#3d2b1f] ${compact ? "text-sm" : "text-[15px]"}`}>
            {variant === "home" ? "인생스토리" : title}
          </h1>
          <p className={`text-[#8b6f5c] ${compact ? "text-[10px]" : "text-[10px]"}`}>{subtitle}</p>
        </div>

        <div className="flex w-10 items-center justify-end gap-1">
          {showBell && (
            <Link href="/my/notifications" className="rounded-lg p-2 text-brown hover:bg-ivory" aria-label="알림">
              <Bell className="h-5 w-5" />
            </Link>
          )}
          {showActions && (
            <button
              type="button"
              onClick={shareCurrentPage}
              className="rounded-lg p-2 text-brown hover:bg-ivory"
              aria-label="공유"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {!showBell && !showActions && <span className="w-5" />}
        </div>
      </div>
      {shareMessage ? (
        <p className="border-t border-[#ebe3d8] bg-[#f5efe6] px-4 py-2 text-center text-[14px] font-medium text-[#5c3d2e]">
          {shareMessage}
        </p>
      ) : null}
    </header>
  );
}
