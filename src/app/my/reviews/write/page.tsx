"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe, postApp } from "@/lib/client/api";
import type { Consultation, Order } from "@/lib/types/app";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#403A49]";

const MESSAGE_MAX = 300;

type Target = {
  key: string;
  title: string;
  subtitle: string;
};

function receivedTargets(orders: Order[], consultations: Consultation[]): Target[] {
  const songs = orders
    .filter((item) => item.status === "완성/전달" || item.status === "완료")
    .map((item) => ({
      key: `order:${item.id}`,
      title: item.title,
      subtitle: item.status,
    }));
  const consults = consultations
    .filter((item) => item.status === "상담 완료")
    .map((item) => ({
      key: `consult:${item.id}`,
      title: "1:1 사주상담",
      subtitle: `${item.teacher} · ${item.datetime}`,
    }));
  return [...songs, ...consults];
}

function ReviewWriteForm() {
  const searchParams = useSearchParams();
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      const user = data.user ?? null;
      setLoggedIn(Boolean(user));
      if (user?.name) setName(user.name);

      // 이미 후기를 남긴 대상은 목록에서 뺀다. 서버도 409로 한 번 더 막는다.
      const written = new Set(
        ((data.myReviews ?? []) as { targetKey?: string }[])
          .map((item) => item.targetKey)
          .filter((key): key is string => Boolean(key)),
      );
      const next = receivedTargets(
        (data.orders ?? []) as Order[],
        (data.consultations ?? []) as Consultation[],
      ).filter((item) => !written.has(item.key));
      const previewTargets =
        searchParams.get("preview") === "1" && next.length === 0
          ? [
              {
                key: "preview:sample",
                title: "이야기로 만드는 인생곡",
                subtitle: "미리보기",
              },
            ]
          : next;
      setTargets(previewTargets);

      const orderId = searchParams.get("order");
      const consultId = searchParams.get("consult");
      const fromLink = orderId
        ? `order:${orderId}`
        : consultId
          ? `consult:${consultId}`
          : "";
      const matched = previewTargets.find((item) => item.key === fromLink);
      setSelectedKey(matched?.key ?? (previewTargets.length === 1 ? previewTargets[0].key : ""));
      setLoaded(true);
    });
  }, [searchParams]);

  const selected = targets.find((item) => item.key === selectedKey) ?? null;

  const submit = async () => {
    setError("");
    if (!selected) {
      setError("받으신 상품이 있어야 후기를 남길 수 있습니다.");
      return;
    }
    if (!name.trim()) {
      setError("이름을 적어 주세요.");
      return;
    }
    if (!text.trim()) {
      setError("후기를 적어 주세요.");
      return;
    }
    if (selected.key.startsWith("preview:")) {
      setDone(true);
      return;
    }
    setSaving(true);
    try {
      await postApp({
        action: "createReview",
        targetKey: selected.key,
        title: selected.title,
        name: name.trim(),
        rating,
        text: text.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "후기를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="후기 작성" backHref="/my" />

      {!loaded ? (
        <p className="px-4 py-10 text-center text-[15px] text-[#6B6570]">불러오는 중...</p>
      ) : !loggedIn ? (
        <section className="px-4 py-10 text-center">
          <p className="text-[16px] leading-relaxed text-[#6B6570]">
            로그인하면
            <br />
            받으신 상품의 후기를 남길 수 있습니다.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-14 items-center justify-center rounded-xl bg-[#403A49] px-8 text-[17px] font-semibold text-white"
          >
            로그인하기
          </Link>
        </section>
      ) : done ? (
        <section className="px-4 py-10 text-center">
          <p className="text-[22px] font-bold text-[#403A49]">적어 주셔서 감사합니다</p>
          <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
            후기를 잘 받아 두었습니다.
            <br />
            확인 후 화면에 보여 드리겠습니다.
          </p>
        </section>
      ) : targets.length === 0 ? (
        <section className="px-4 py-10 text-center">
          <p className="text-[20px] font-bold text-[#403A49]">아직 후기를 남길 수 없습니다</p>
          <p className="mt-3 text-[16px] leading-relaxed text-[#6B6570]">
            결제하고 상품을 받으신 뒤,
            <br />
            또는 사주상담이 끝난 뒤에
            <br />
            후기를 남기실 수 있습니다.
          </p>
        </section>
      ) : (
        <section className="px-4 py-5">
          <h2 className="font-serif text-[24px] font-bold text-[#403A49]">후기 작성</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
            받으신 상품에 대한 마음을 남겨 주세요.
          </p>

          <p className="mt-6 text-[16px] font-bold text-[#403A49]">받으신 상품</p>
          {targets.length === 1 ? (
            <div className="mt-3 rounded-xl bg-white px-4 py-4 ring-1 ring-[#ebe3d8]">
              <p className="text-[16px] font-semibold text-[#403A49]">{selected?.title}</p>
              {selected?.subtitle ? (
                <p className="mt-1 text-[14px] text-[#6B6570]">{selected.subtitle}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {targets.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedKey(item.key)}
                  className={`flex min-h-16 w-full flex-col items-start justify-center rounded-xl px-4 py-3 text-left ${
                    selectedKey === item.key
                      ? "bg-[#403A49] text-white"
                      : "border border-[#d4c8ba] bg-white text-[#403A49]"
                  }`}
                >
                  <span className="text-[16px] font-semibold">{item.title}</span>
                  <span
                    className={`mt-0.5 text-[13px] ${
                      selectedKey === item.key ? "text-white/80" : "text-[#6B6570]"
                    }`}
                  >
                    {item.subtitle}
                  </span>
                </button>
              ))}
            </div>
          )}

          <label className="mt-6 block text-[16px] font-bold text-[#403A49]" htmlFor="review-name">
            이름
          </label>
          <input
            id="review-name"
            className={`${inputClass} mt-2`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
          />

          <p className="mt-6 text-[16px] font-bold text-[#403A49]">별점</p>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              const selectedStar = value <= rating;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="flex h-12 w-12 items-center justify-center"
                  aria-label={`${value}점`}
                >
                  <Star
                    className={`h-8 w-8 ${
                      selectedStar ? "fill-[#c4a574] text-[#c4a574]" : "text-[#d4c8ba]"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <label className="mt-6 block text-[16px] font-bold text-[#403A49]" htmlFor="review-text">
            후기
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX))}
            maxLength={MESSAGE_MAX}
            rows={6}
            placeholder="가장 좋았던 점을 적어 주세요."
            className="mt-2 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] leading-relaxed outline-none focus:border-[#403A49]"
          />
          <p className="mt-1 text-right text-[13px] text-[#6B6570]">
            {text.length}/{MESSAGE_MAX}
          </p>

          {error ? <p className="mt-3 text-[15px] text-[#a33b2b]">{error}</p> : null}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-[#403A49] text-[18px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장하는 중..." : "후기 남기기"}
          </button>
        </section>
      )}
    </MobileShell>
  );
}

export default function ReviewWritePage() {
  return (
    <Suspense>
      <ReviewWriteForm />
    </Suspense>
  );
}
