"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { fetchMe } from "@/lib/client/api";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]";

const KINDS = [
  { id: "story", label: "이야기로 만드는 인생곡" },
  { id: "premium", label: "프리미엄 인생곡" },
  { id: "saju-song", label: "사주 인생곡" },
  { id: "consultation", label: "1:1 사주상담" },
] as const;

const MESSAGE_MAX = 300;

export default function ReviewWritePage() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"] | "">("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      if (data.user?.name) setName(data.user.name);
    });
  }, []);

  const submit = () => {
    setError("");
    if (!kind) {
      setError("어떤 후기인지 골라 주세요.");
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
    setDone(true);
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="후기 작성" backHref="/my" />

      {done ? (
        <section className="px-4 py-10 text-center">
          <p className="text-[22px] font-bold text-[#3d2b1f]">적어 주셔서 감사합니다</p>
          <p className="mt-3 text-[16px] leading-relaxed text-[#8b6f5c]">
            후기를 잘 받아 두었습니다.
            <br />
            확인 후 화면에 보여 드리겠습니다.
          </p>
        </section>
      ) : (
        <section className="px-4 py-5">
          <h2 className="font-serif text-[24px] font-bold text-[#3d2b1f]">후기 작성</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">
            받으신 서비스와 마음을 짧게 남겨 주세요.
          </p>

          <p className="mt-6 text-[16px] font-bold text-[#3d2b1f]">어떤 후기인가요?</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setKind(item.id)}
                className={`flex min-h-14 items-center justify-center rounded-xl px-4 text-[16px] font-semibold ${
                  kind === item.id
                    ? "bg-[#5c3d2e] text-white"
                    : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="mt-6 block text-[16px] font-bold text-[#3d2b1f]" htmlFor="review-name">
            이름
          </label>
          <input
            id="review-name"
            className={`${inputClass} mt-2`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
          />

          <p className="mt-6 text-[16px] font-bold text-[#3d2b1f]">별점</p>
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              const selected = value <= rating;
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
                      selected ? "fill-[#c4a574] text-[#c4a574]" : "text-[#d4c8ba]"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <label className="mt-6 block text-[16px] font-bold text-[#3d2b1f]" htmlFor="review-text">
            후기
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MESSAGE_MAX))}
            maxLength={MESSAGE_MAX}
            rows={6}
            placeholder="가장 좋았던 점을 적어 주세요."
            className="mt-2 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] leading-relaxed outline-none focus:border-[#5c3d2e]"
          />
          <p className="mt-1 text-right text-[13px] text-[#8b6f5c]">
            {text.length}/{MESSAGE_MAX}
          </p>

          {error ? <p className="mt-3 text-[15px] text-[#a33b2b]">{error}</p> : null}

          <button
            type="button"
            onClick={submit}
            className="mt-6 flex h-14 w-full items-center justify-center rounded-xl bg-[#5c3d2e] text-[18px] font-semibold text-white"
          >
            후기 남기기
          </button>
        </section>
      )}
    </MobileShell>
  );
}
