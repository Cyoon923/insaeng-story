"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Menu, Bell, ChevronLeft, Share2, User } from "lucide-react";
import { fetchMe } from "@/lib/client/api";

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
  /** 단계별 화면에서 한 단계만 뒤로 갈 때 사용한다. backHref 대신 버튼으로 그린다. */
  onBack?: () => void;
  showMenu?: boolean;
  showBell?: boolean;
  /** 사람 아이콘. 홈에서만 기본으로 보여준다. */
  showUser?: boolean;
  showActions?: boolean;
  compact?: boolean;
  /** 헤더 배경. 기본값은 기존 아이보리이며, 넘기지 않은 화면은 그대로 유지된다. */
  bgClass?: string;
}

export function AppHeader({
  variant = "home",
  title,
  subtitle = "인생의 서사를 연주하고 기록한다",
  backHref,
  onBack,
  showMenu = variant === "home",
  showBell = variant === "home",
  showUser = variant === "home",
  showActions = variant === "page" || variant === "apply",
  compact = false,
  bgClass = "bg-[#fffdf9]/95",
}: AppHeaderProps) {
  const [mounted, setMounted] = useState(false);
  // 로그인 여부는 기존 세션 판별(GET /api/app 의 user)을 그대로 사용한다.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showUser) return;
    let alive = true;
    fetchMe()
      .then((data) => {
        if (alive) setLoggedIn(Boolean(data.user));
      })
      .catch(() => {
        if (alive) setLoggedIn(false);
      });
    return () => {
      alive = false;
    };
  }, [showUser]);

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
    <header className={`sticky top-0 z-40 border-b border-[#ebe3d8] ${bgClass} backdrop-blur-sm`}>
      <div
        className={`flex items-center justify-between px-4 ${
          compact ? "h-12" : variant === "home" ? "h-[62px]" : "h-[52px]"
        }`}
      >
        <div className={`flex ${showUser ? "w-[76px]" : "w-10"} shrink-0 items-center justify-start`}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory"
              aria-label="뒤로"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : backHref ? (
            <Link href={backHref} className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory" aria-label="뒤로">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          ) : showMenu ? (
            <Link href="/menu" className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory" aria-label="메뉴">
              <Menu className="h-5 w-5" />
            </Link>
          ) : (
            <span className="w-5" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
          {variant === "home" ? (
            <span className="flex items-center justify-center gap-0.5">
              <Image
                src="/images/symbol-sajulog-compass.png"
                alt=""
                width={72}
                height={48}
                priority
                className="h-[22px] w-auto object-contain"
              />
              <h1 className="text-[18px] font-bold leading-none text-[#403A49]">사주로그</h1>
            </span>
          ) : (
            <h1 className={`font-bold text-[#403A49] ${compact ? "text-sm" : "text-[15px]"}`}>
              {title}
            </h1>
          )}
          <p
            className={`text-[#6B6570] ${
              compact ? "text-[10px]" : variant === "home" ? "mt-1 text-[11px]" : "text-[10px]"
            }`}
          >
            {subtitle}
          </p>
        </div>

        <div className={`flex ${showUser ? "w-[76px]" : "w-10"} shrink-0 items-center justify-end gap-1`}>
          {showBell && (
            <Link href="/my/notifications" className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory" aria-label="알림">
              <Bell className="h-5 w-5" />
            </Link>
          )}
          {showUser &&
            (loggedIn === null ? (
              <span className="block h-9 w-9 shrink-0" aria-hidden />
            ) : (
              <Link
                href={loggedIn ? "/my" : "/login"}
                className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory"
                aria-label={loggedIn ? "내 정보" : "로그인"}
              >
                <User className="h-5 w-5" />
              </Link>
            ))}
          {showActions && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory"
              aria-label="공유"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {!showBell && !showActions && !showUser && <span className="w-5" />}
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
                  <p className="text-center text-[18px] font-bold text-[#403A49]">공유하기</p>
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
                    className="mt-4 flex h-12 w-full items-center justify-center text-[16px] font-medium text-[#6B6570]"
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
