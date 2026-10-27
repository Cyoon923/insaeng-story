"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { YOUTUBE_VIDEOS, YOUTUBE_CHANNEL_URL, type YouTubeVideo } from "@/lib/constants/youtube";

/** 자동 이동 간격. 다시 시작할 때도 이만큼 기다린 뒤 움직인다. */
const AUTO_INTERVAL_MS = 5000;
/** 사용자 조작이 끝난 뒤 자동 이동을 다시 시작하기까지의 대기. */
const RESUME_DELAY_MS = 8000;

/** Fisher–Yates. 입력 배열은 바꾸지 않는다. random은 테스트에서 주입한다. */
function shuffled<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 다음 자동 이동 위치. positions는 스크롤 컨테이너 기준 카드 왼쪽 위치(scrollLeft와 같은 좌표)다.
 * 넘칠 카드가 없으면 null, 끝에 닿았으면 0(처음으로 되감기), 아니면 지금보다 오른쪽의 첫 카드
 * (마지막 카드 근처에서는 최대 스크롤 위치로 자른다).
 */
function nextScrollLeft(positions: readonly number[], scrollLeft: number, maxScroll: number): number | null {
  if (positions.length < 2 || maxScroll <= 1) return null;
  if (scrollLeft >= maxScroll - 1) return 0;
  const next = positions.find((left) => left > scrollLeft + 1);
  return Math.min(next ?? maxScroll, maxScroll);
}

/** 테스트용 내부 함수. 런타임 동작에는 영향을 주지 않는다. */
export const __youTubeSectionInternals = { shuffled, nextScrollLeft };

export function YouTubeSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 좌우 버튼·카드 영역. hover·포커스·누름과 화면 안 여부를 이 영역으로 판단한다. */
  const areaRef = useRef<HTMLDivElement>(null);
  /** 사용자가 영역을 한 번이라도 조작했는지. 늦게 온 목록이 순서·위치를 바꾸지 않게 한다. */
  const interactedRef = useRef(false);
  /** 최종 목록이 정해졌는지. 그 전에는 자동 이동하지 않는다(섞기 전후로 위치가 어긋나지 않게). */
  const settledRef = useRef(false);
  // 첫 렌더는 고정 목록이다. 서버 HTML과 같아야 하므로 렌더 중에는 섞지 않는다.
  const [videos, setVideos] = useState<YouTubeVideo[]>(YOUTUBE_VIDEOS);

  useEffect(() => {
    // 기존 조회 1회가 끝나면(실패 포함) 최종 목록의 복사본을 한 번만 섞는다.
    const settle = (list: YouTubeVideo[]) => {
      // 개발 모드 StrictMode는 이 effect를 두 번 실행해 응답도 두 번 온다. 섞기는 첫 응답에서 한 번만 한다.
      if (settledRef.current) return;
      settledRef.current = true;
      if (interactedRef.current) {
        // 이미 조작 중이거나 조작했으면 순서와 위치를 그대로 두고 새 영상만 뒤에 붙인다.
        setVideos((current) => {
          const ids = new Set(current.map((video) => video.id));
          const added = list.filter((video) => !ids.has(video.id));
          return added.length > 0 ? [...current, ...added] : current;
        });
        return;
      }
      setVideos(shuffled(list));
    };
    fetch("/api/youtube", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { videos?: YouTubeVideo[] }) => settle(data.videos?.length ? data.videos : YOUTUBE_VIDEOS))
      .catch(() => settle(YOUTUBE_VIDEOS));
  }, []);

  /*
   * 자동 이동. React 상태를 바꾸지 않고 스크롤 위치만 옮긴다.
   * - 멈춤: 마우스 hover, 영역 안 키보드 포커스, 누르고 있는 포인터·터치(놓을 때까지)
   * - 재개: 조작이 모두 끝나고 8초 뒤
   * - 타이머 정지: 화면 밖, 숨겨진 탭, 동작 줄이기 설정. 다시 시작할 때는 5초를 기다린다.
   */
  useEffect(() => {
    const area = areaRef.current;
    const scroller = scrollRef.current;
    if (!area || !scroller) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | null = null;
    let visible = typeof IntersectionObserver === "undefined";
    let hovering = false;
    let keyboardFocus = false;
    let pointerDown = false;
    let touching = false;
    let lastInteraction = 0;

    const active = () => visible && !document.hidden && !motion.matches;
    const holding = () => hovering || keyboardFocus || pointerDown || touching;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const schedule = (delay: number) => {
      stop();
      if (active() && !holding()) timer = setTimeout(step, delay);
    };
    // 즉시 움직이지 않는다. 조작 직후면 재개 대기가 끝날 때까지 기다린다.
    const restart = () => schedule(Math.max(AUTO_INTERVAL_MS, lastInteraction + RESUME_DELAY_MS - Date.now()));

    function step() {
      timer = null;
      if (!active() || holding()) return;
      if (settledRef.current && scroller) {
        // offsetLeft는 기준 요소(offsetParent)가 컨테이너가 아닐 수 있어 화면 좌표 차이로 계산한다.
        const origin = scroller.getBoundingClientRect().left - scroller.scrollLeft;
        const positions = Array.from(scroller.children, (card) => card.getBoundingClientRect().left - origin);
        const target = nextScrollLeft(positions, scroller.scrollLeft, scroller.scrollWidth - scroller.clientWidth);
        if (target !== null) scroller.scrollTo({ left: target, behavior: "smooth" });
      }
      schedule(AUTO_INTERVAL_MS);
    }

    const startHold = () => {
      interactedRef.current = true;
      stop();
    };
    const endHold = () => {
      lastInteraction = Date.now();
      if (!holding()) restart();
    };

    // hover는 마우스만 본다. 모바일 탭이 남기는 가짜 hover로 영영 멈추지 않게 한다.
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      hovering = true;
      startHold();
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !hovering) return;
      hovering = false;
      endHold();
    };
    // 터치는 브라우저가 가로 스크롤을 넘겨받으면 pointercancel이 먼저 오므로 touch 이벤트로 따로 본다.
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerDown = true;
      startHold();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !pointerDown) return;
      pointerDown = false;
      endHold();
    };
    const onTouchStart = () => {
      touching = true;
      startHold();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!touching || event.touches.length > 0) return;
      touching = false;
      endHold();
    };
    const onWheel = () => {
      interactedRef.current = true;
      lastInteraction = Date.now();
      if (!holding()) restart();
    };
    // 키보드 포커스만 멈춘다. 링크를 눌러 생긴 포커스가 남아 계속 멈춰 있지 않게 한다.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null;
      let focusVisible = false;
      try {
        focusVisible = Boolean(target?.matches(":focus-visible"));
      } catch {
        focusVisible = false;
      }
      if (!focusVisible) return;
      keyboardFocus = true;
      startHold();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!keyboardFocus || area.contains(event.relatedTarget as Node | null)) return;
      keyboardFocus = false;
      endHold();
    };
    const onActivityChange = () => {
      if (active()) restart();
      else stop();
    };

    area.addEventListener("pointerenter", onPointerEnter);
    area.addEventListener("pointerleave", onPointerLeave);
    area.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    area.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    area.addEventListener("wheel", onWheel, { passive: true });
    area.addEventListener("focusin", onFocusIn);
    area.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onActivityChange);
    motion.addEventListener("change", onActivityChange);
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      onActivityChange();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          visible = Boolean(entry?.isIntersecting);
          onActivityChange();
        },
        { threshold: 0.3 },
      );
      observer.observe(area);
    }

    return () => {
      stop();
      observer?.disconnect();
      area.removeEventListener("pointerenter", onPointerEnter);
      area.removeEventListener("pointerleave", onPointerLeave);
      area.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      area.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      area.removeEventListener("wheel", onWheel);
      area.removeEventListener("focusin", onFocusIn);
      area.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onActivityChange);
      motion.removeEventListener("change", onActivityChange);
    };
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  };

  return (
    <section className="bg-[#FFFFFF] px-4 pb-5 pt-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-[#ff0000] text-[8px] font-bold text-white">
              ▶
            </span>
            <h2 className="text-[17px] font-bold text-[#403A49]">사주로그 공식 유튜브</h2>
          </div>
          <p className="mt-1 pl-[22px] text-[13px] leading-relaxed text-[#6B6570]">
            실제 고객님의 이야기를 완성 작품으로 만나보세요.
          </p>
        </div>
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 shrink-0 rounded-md bg-[#ff0000] px-3 py-1.5 text-[11px] font-bold text-white"
        >
          구독하기
        </a>
      </div>

      <div ref={areaRef} className="relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute -left-1 top-[38px] z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-[#ebe3d8]"
          aria-label="이전 영상"
        >
          <ChevronLeft className="h-4 w-4 text-[#8b6f5c]" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute -right-1 top-[38px] z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-[#ebe3d8]"
          aria-label="다음 영상"
        >
          <ChevronRight className="h-4 w-4 text-[#8b6f5c]" />
        </button>

        <div ref={scrollRef} className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {videos.map((video) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-[138px] shrink-0"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-[#ebe3d8]">
                <Image src={video.thumbnail} alt={video.title} fill className="object-cover" sizes="138px" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-[#5c3d2e] text-[#5c3d2e]" />
                  </div>
                </div>
                {video.duration ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {video.duration}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 line-clamp-2 text-[11px] font-bold leading-snug text-[#403A49]">
                {video.title}
              </h3>
              <p className="mt-0.5 text-[10px] text-[#6B6570]">{video.views}</p>
            </a>
          ))}
        </div>
      </div>

      <Link
        href="/cases"
        className="mt-3.5 flex w-full items-center justify-center gap-1 rounded-xl border border-[#403A49] bg-[#fffdf9] py-3 text-[13px] font-semibold text-[#403A49]"
      >
        유튜브 더 보기 <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
