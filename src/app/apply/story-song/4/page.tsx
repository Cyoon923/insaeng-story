"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const PROTAGONIST_IMAGES: Record<string, string> = {
  self: "/images/photo-self.jpg",
  parents: "/images/photo-parents.jpg",
  partner: "/images/photo-couple.jpg",
  family: "/images/photo-family.jpg",
  pet: "/images/photo-pet.jpg",
  other: "/images/photo-self.jpg",
};

const MOODS = ["따뜻한", "잔잔한", "희망적인", "감동적인", "아련한", "설렘 가득한", "차분한", "직접 입력"];

const SONG_PLACEHOLDERS = [
  "예) 김광석 - 서른 즈음에",
  "예) 아이유 - 밤편지",
  "예) 성시경 - 너의 모든 순간",
  "가수와 노래 제목을 입력해주세요",
  "가수와 노래 제목을 입력해주세요",
];

export default function ApplyStep4Page() {
  const [selectedMoods, setSelectedMoods] = useState<string[]>(["따뜻한"]);
  const [customMood, setCustomMood] = useState("");
  const [songs, setSongs] = useState(["", "", ""]);
  const [protagonist, setProtagonist] = useState("부모님");
  const [protagonistId, setProtagonistId] = useState("parents");

  useEffect(() => {
    const draft = getDraft("story");
    if (draft.moods) setSelectedMoods(draft.moods.split(" / ").filter(Boolean));
    if (draft.customMood) setCustomMood(draft.customMood);
    if (draft.songs) {
      const next = draft.songs.split("\n").filter((item) => item.length >= 0);
      setSongs(next.length >= 3 ? next : [...next, "", "", ""].slice(0, 3));
    }
    if (draft.protagonist) setProtagonist(draft.protagonist);
    if (draft.protagonistId) setProtagonistId(draft.protagonistId);
  }, []);

  const persist = (moods: string[], mood: string, nextSongs: string[]) => {
    saveDraft("story", {
      moods: moods.filter((item) => item !== "직접 입력").join(" / "),
      customMood: mood,
      songs: nextSongs.filter(Boolean).join("\n"),
    });
  };

  const toggleMood = (mood: string) => {
    const next = selectedMoods.includes(mood)
      ? selectedMoods.filter((item) => item !== mood)
      : [...selectedMoods, mood];
    setSelectedMoods(next);
    persist(next, customMood, songs);
  };

  return (
    <ApplyLayout step={4} prevHref="/apply/story-song/3" nextHref="/apply/story-song/5"
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <h2 className="font-serif text-[22px] font-bold text-[#403A49]">4. 어떤 노래로 만들어드릴까요?</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
        원하시는 가사 분위기와 참고곡을 알려주세요. 여러 개를 선택하시면 더 잘 반영됩니다.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5efe6] p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white">
            <Image
              src={PROTAGONIST_IMAGES[protagonistId] ?? "/images/photo-parents.jpg"}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <p className="text-[12px] text-[#6B6570]">선택한 주인공</p>
            <p className="text-[16px] font-bold text-[#403A49]">{protagonist}</p>
          </div>
        </div>
        <Link href="/apply/story-song/2" className="text-[13px] font-medium text-[#403A49]">
          주인공 변경
        </Link>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[18px] font-semibold text-[#403A49]">
          ① 가사 분위기 <span className="text-[14px] font-normal text-[#6B6570]">여러 개 고를 수 있어요</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MOODS.map((mood) => {
            const active = selectedMoods.includes(mood);
            return (
              <button
                key={mood}
                type="button"
                onClick={() => toggleMood(mood)}
                className={`min-h-14 rounded-xl px-2 text-[17px] font-semibold ${
                  active
                    ? "bg-[#403A49] text-white"
                    : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>
        {selectedMoods.includes("직접 입력") ? (
          <input
            type="text"
            value={customMood}
            onChange={(e) => {
              setCustomMood(e.target.value);
              persist(selectedMoods, e.target.value, songs);
            }}
            placeholder="원하는 분위기를 직접 입력해주세요"
            className="mt-3 h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]"
          />
        ) : null}
      </div>

      <div className="mt-7">
        <p className="mb-1 text-[18px] font-semibold text-[#403A49]">
          ② 참고하고 싶은 가수와 노래 <span className="text-red-500">*</span>
        </p>
        <p className="mb-3 text-[15px] text-[#6B6570]">최소 3곡, 최대 5곡까지 입력할 수 있습니다.</p>
        {songs.map((song, i) => (
          <input
            key={i}
            type="text"
            value={song}
            onChange={(e) => {
              const next = songs.map((item, index) => (index === i ? e.target.value : item));
              setSongs(next);
              persist(selectedMoods, customMood, next);
            }}
            placeholder={SONG_PLACEHOLDERS[i]}
            className="mb-3 h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#403A49]"
          />
        ))}
        {songs.length < 5 ? (
          <button
            type="button"
            onClick={() => setSongs((prev) => [...prev, ""])}
            className="mt-1 h-14 w-full rounded-xl border border-dashed border-[#403A49] text-[17px] font-semibold text-[#403A49]"
          >
            + 노래 추가하기
          </button>
        ) : null}
        <p className="mt-3 rounded-xl bg-[#f5efe6] px-4 py-3 text-[15px] leading-relaxed text-[#403A49]">
          입력하신 노래는 분위기와 스타일을 이해하기 위한 참고용입니다.
        </p>
      </div>
    </ApplyLayout>
  );
}
