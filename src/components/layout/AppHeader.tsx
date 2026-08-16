"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

function isLocalPreview() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
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
  const [mounted, setMounted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const pageUrl = () => window.location.href;
  const pageTitle = () => document.title;

  const showCopied = (message: string) => {
    setShareOpen(false);
    setShareMessage(message);
    window.setTimeout(() => setShareMessage(""), 2500);
  };

  const shareKakao = async () => {
    const url = pageUrl();
    if (isLocalPreview()) {
      const copied = await copyLink(url);
      showCopied(copied ? "미리보기에서는 링크를 복사합니다." : "링크를 복사하지 못했습니다.");
      return;
    }
    window.open(
      `https://story.kakao.com/share?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setShareOpen(false);
  };

  const shareTelegram = async () => {
    const url = pageUrl();
    const text = pageTitle();
    if (isLocalPreview()) {
      const copied = await copyLink(url);
      showCopied(copied ? "미리보기에서는 링크를 복사합니다." : "링크를 복사하지 못했습니다.");
      return;
    }
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setShareOpen(false);
  };

  const shareCopy = async () => {
    const copied = await copyLink(pageUrl());
    showCopied(copied ? "링크를 복사했습니다." : "링크를 복사하지 못했습니다.");
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
              onClick={() => setShareOpen(true)}
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

      {mounted && shareOpen
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-end justify-center">
              <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col justify-end bg-black/40">
                <button
                  type="button"
                  className="absolute inset-0"
                  aria-label="닫기"
                  onClick={() => setShareOpen(false)}
                />
                <div className="relative w-full rounded-t-2xl bg-[#fffdf9] px-4 pb-24 pt-5">
                  <p className="text-center text-[18px] font-bold text-[#3d2b1f]">공유하기</p>
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={shareKakao}
                      className="flex h-14 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[17px] font-semibold text-white"
                    >
                      카카오톡
                    </button>
                    <button
                      type="button"
                      onClick={shareCopy}
                      className="flex h-14 w-full items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[17px] font-semibold text-[#5c3d2e]"
                    >
                      주소 복사
                    </button>
                    <button
                      type="button"
                      onClick={shareTelegram}
                      className="flex h-14 w-full items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[17px] font-semibold text-[#5c3d2e]"
                    >
                      텔레그램
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    className="mt-4 flex h-12 w-full items-center justify-center text-[16px] font-medium text-[#8b6f5c]"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
