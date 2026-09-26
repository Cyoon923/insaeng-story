"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, ChevronLeft, Share2, User } from "lucide-react";
import { fetchMe } from "@/lib/client/api";
import { AGENT_SEEN_EVENT, fetchUnseenAgentReply } from "@/lib/client/chatAgentUnseen";
import { IMAGES } from "@/lib/constants/images";

/**
 * 카카오톡 공유에 쓰는 공식 JavaScript SDK.
 *
 * 공유 시트에서 카카오톡을 누른 순간에만 내려받는다. 모든 화면에서 미리 불러오지 않는다.
 * 앱 키는 코드에 적지 않고 NEXT_PUBLIC_KAKAO_JS_KEY로만 읽는다.
 * 키가 없거나 내려받기·초기화가 실패하면 null을 돌려준다. 실패를 성공처럼 다루지 않는다.
 */
const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";

interface KakaoShareSdk {
  init(key: string): void;
  isInitialized(): boolean;
  Share: { sendDefault(settings: Record<string, unknown>): void };
}

declare global {
  interface Window {
    Kakao?: KakaoShareSdk;
  }
}

/** 한 번 내려받으면 그 결과를 계속 쓴다. 같은 스크립트를 두 번 넣지 않는다. */
let kakaoSdkLoad: Promise<KakaoShareSdk | null> | null = null;

function loadKakaoSdk(): Promise<KakaoShareSdk | null> {
  if (kakaoSdkLoad) return kakaoSdkLoad;
  kakaoSdkLoad = new Promise((resolve) => {
    if (window.Kakao) {
      resolve(window.Kakao);
      return;
    }
    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.onload = () => resolve(window.Kakao ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return kakaoSdkLoad;
}

/** 쓸 준비가 끝난 SDK. init은 한 번만 한다. 준비되지 않으면 null이다. */
async function kakaoShareSdk(): Promise<KakaoShareSdk | null> {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;
  const sdk = await loadKakaoSdk();
  if (!sdk) return null;
  try {
    if (!sdk.isInitialized()) sdk.init(key);
    return sdk.isInitialized() ? sdk : null;
  } catch {
    return null;
  }
}

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

/**
 * 공유 버튼을 숨기는 경로. 로그인해야 볼 수 있는 개인 화면이라
 * 주소를 남에게 넘길 이유가 없고, 주문 id 같은 식별자가 링크에 담긴다.
 * 공개 페이지(상품·상담·후기·약관 등)는 지금처럼 그대로 공유할 수 있다.
 */
const PRIVATE_PATH_PREFIXES = ["/my", "/social-link"];

function isPrivatePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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
  const pathname = usePathname();
  // 개인 화면에서는 showActions가 true로 넘어와도 공유 버튼을 그리지 않는다.
  const canShare = showActions && !isPrivatePath(pathname);

  const [mounted, setMounted] = useState(false);
  // 로그인 여부는 기존 세션 판별(GET /api/app 의 user)을 그대로 사용한다.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  // 아직 보지 못한 상담원 답변이 있는지. 도령 위젯과 같은 서버 사실·같은 기록을 본다.
  const [agentUnseen, setAgentUnseen] = useState(false);

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

  useEffect(() => {
    // 종이 있는 화면에서만, 화면에 붙을 때 한 번 묻는다. 기존 고객 목록 API 하나만 쓴다.
    // 주기적으로 다시 묻지 않는다(polling·focus·visibility 감시 없음).
    if (!showBell) return;
    let alive = true;
    fetchUnseenAgentReply().then((unseen) => {
      if (alive) setAgentUnseen(unseen);
    });
    // 도령이에서 상담원 대화를 확인해 읽음이 기록되면 같은 화면의 종도 함께 내린다.
    const onSeen = () => setAgentUnseen(false);
    window.addEventListener(AGENT_SEEN_EVENT, onSeen);
    return () => {
      alive = false;
      window.removeEventListener(AGENT_SEEN_EVENT, onSeen);
    };
  }, [showBell]);

  /**
   * 공유하는 것은 언제나 사주로그 홈 하나다.
   * 지금 보고 있는 주소(window.location.href)는 공유하지 않는다. 신청 단계나 내부 화면의
   * 주소를 남에게 넘기지 않기 위해서다. 제목도 화면마다 달라지지 않게 고정한다.
   */
  const homeUrl = () => `${window.location.origin}/`;
  const SHARE_TITLE = "사주로그 | 인생의 서사를 연주하고 기록한다";
  // layout.tsx의 metadata.description, manifest.ts의 description과 같은 공식 문구다.
  const SHARE_DESCRIPTION =
    "고객의 이야기 또는 사주를 바탕으로 한 사람만을 위한 인생곡을 만들어 드립니다.";

  const showCopied = (message: string) => {
    setShareOpen(false);
    setShareMessage(message);
    window.setTimeout(() => setShareMessage(""), 2500);
  };

  /** 공유 시트 안에서만 보여 주는 안내. 시트를 닫지 않아 다른 방법을 바로 고를 수 있다. */
  const showShareNotice = (message: string) => {
    setShareMessage(message);
    window.setTimeout(() => setShareMessage(""), 2500);
  };

  /**
   * 카카오톡 공유. 공식 Kakao.Share.sendDefault만 쓴다.
   * 보내는 링크는 홈 하나이고(mobileWebUrl·webUrl 모두 homeUrl()),
   * 제목·설명은 사주로그 공식 문구, 대표 이미지는 기존 hero 이미지를 절대 주소로 넘긴다.
   * 준비가 안 되었으면 조용히 성공한 척하지 않고 다른 방법을 안내한다.
   */
  const shareKakao = async () => {
    const sdk = await kakaoShareSdk();
    if (!sdk) {
      showShareNotice("카카오톡 공유를 쓸 수 없어요. 주소 복사를 이용해 주세요.");
      return;
    }
    const url = homeUrl();
    try {
      sdk.Share.sendDefault({
        objectType: "feed",
        content: {
          title: SHARE_TITLE,
          description: SHARE_DESCRIPTION,
          imageUrl: `${window.location.origin}${IMAGES.hero}`,
          link: { mobileWebUrl: url, webUrl: url },
        },
      });
      setShareOpen(false);
    } catch {
      showShareNotice("카카오톡 공유를 열지 못했어요. 주소 복사를 이용해 주세요.");
    }
  };

  /**
   * 텔레그램 공유. 보내는 주소는 홈 하나이고 제목도 고정 문구다.
   * 지금 보고 있는 주소(pathname·search·hash)는 어떤 경우에도 넣지 않는다.
   */
  const shareTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(homeUrl())}&text=${encodeURIComponent(SHARE_TITLE)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setShareOpen(false);
  };

  const shareCopy = async () => {
    const copied = await copyLink(homeUrl());
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
            <Link
              href="/my/notifications"
              className="relative shrink-0 rounded-lg p-2 text-brown hover:bg-ivory"
              aria-label={agentUnseen ? "알림 (새 상담원 답변 있음)" : "알림"}
            >
              <Bell className="h-5 w-5" />
              {/*
                새 상담원 답변 표시. 도령이 버튼과 같은 모양·같은 뜻이다(N = New, 개수 아님).
                누르는 동작은 그대로 /my/notifications 이동이며, 누른 것만으로 읽음이 되지 않는다.
              */}
              {agentUnseen ? (
                <span
                  aria-hidden
                  className="absolute right-0 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 text-[11px] font-bold leading-none text-white"
                >
                  N
                </span>
              ) : null}
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
          {canShare && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="shrink-0 rounded-lg p-2 text-brown hover:bg-ivory"
              aria-label="공유"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {!showBell && !canShare && !showUser && <span className="w-5" />}
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
                      className="flex h-14 w-full items-center justify-center rounded-xl bg-[#fee500] text-[17px] font-semibold text-[#3d2b1f]"
                    >
                      카카오톡
                    </button>
                    <button
                      type="button"
                      onClick={shareTelegram}
                      className="flex h-14 w-full items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[17px] font-semibold text-[#5c3d2e]"
                    >
                      텔레그램
                    </button>
                    <button
                      type="button"
                      onClick={shareCopy}
                      className="flex h-14 w-full items-center justify-center rounded-xl border border-[#d4c8ba] bg-white text-[17px] font-semibold text-[#5c3d2e]"
                    >
                      주소 복사
                    </button>
                  </div>
                  {shareMessage ? (
                    <p className="mt-3 text-center text-[14px] leading-relaxed text-[#5c3d2e]">
                      {shareMessage}
                    </p>
                  ) : null}
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
