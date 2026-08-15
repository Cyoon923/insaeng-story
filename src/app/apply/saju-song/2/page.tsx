"use client";

import { useEffect, useState } from "react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { SAJU_STEPS } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const MOODS = ["따뜻한", "잔잔한", "희망적인", "감동적인", "아련한", "설렘 가득한", "차분한", "직접 입력"];
const SONG_PLACEHOLDERS = [
  "예) 김광석 - 서른 즈음에",
  "예) 아이유 - 밤편지",
  "예) 성시경 - 너의 모든 순간",
  "가수와 노래 제목을 입력해주세요",
  "가수와 노래 제목을 입력해주세요",
];

export default function SajuStep2Page() {
  const [selectedMoods, setSelectedMoods] = useState<string[]>(["따뜻한"]);
  const [customMood, setCustomMood] = useState("");
  const [songs, setSongs] = useState(["", "", ""]);
  const [story, setStory] = useState("");

  const persist = (moods: string[], mood: string, nextSongs: string[], nextStory: string) => {
    saveDraft("saju-song", {
      moods: moods.filter((item) => item !== "직접 입력").join(" / "),
      customMood: mood,
      songs: nextSongs.filter(Boolean).join("\n"),
      story: nextStory,
    });
  };

  useEffect(() => {
    const draft = getDraft("saju-song");
    if (draft.moods) setSelectedMoods(draft.moods.split(" / ").filter(Boolean));
    if (draft.customMood) setCustomMood(draft.customMood);
    if (draft.songs) {
      const next = draft.songs.split("\n");
      setSongs(next.length >= 3 ? next : [...next, "", "", ""].slice(0, 3));
    }
    if (draft.story) setStory(draft.story);
  }, []);

  return (
    <ApplyLayout
      step={2}
      title="사주 인생곡 신청하기"
      basePath="/apply/saju-song"
      steps={SAJU_STEPS}
      prevHref="/apply/saju-song/1"
      nextHref="/apply/saju-song/3"
      heroText={"노래 스타일과 당신의 이야기를\n함께 알려주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">2. 노래 스타일 + 당신의 이야기</h2>
      <p className="mt-2 text-[14px] text-[#8b6f5c]">사주 정보와 함께 이야기, 음악 취향을 반영합니다.</p>

      <div className="mt-6">
        <p className="mb-3 text-[16px] font-semibold text-[#3d2b1f]">
          가사 분위기 <span className="text-[13px] font-normal text-[#8b6f5c]">복수 선택 가능</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {MOODS.map((mood) => {
            const active = selectedMoods.includes(mood);
            return (
              <button
                key={mood}
                type="button"
                onClick={() => {
                  const next = selectedMoods.includes(mood)
                    ? selectedMoods.filter((item) => item !== mood)
                    : [...selectedMoods, mood];
                  setSelectedMoods(next);
                  persist(next, customMood, songs, story);
                }}
                className={`h-12 rounded-xl text-[15px] font-medium ${
                  active ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
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
              persist(selectedMoods, e.target.value, songs, story);
            }}
            placeholder="원하는 분위기를 직접 입력해주세요"
            className="mt-3 h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
        ) : null}
      </div>

      <div className="mt-7">
        <p className="mb-1 text-[16px] font-semibold text-[#3d2b1f]">
          참고하고 싶은 가수와 노래 <span className="text-red-500">*</span>
        </p>
        <p className="mb-3 text-[13px] text-[#8b6f5c]">최소 3곡, 최대 5곡까지 입력할 수 있습니다.</p>
        {songs.map((song, i) => (
          <input
            key={i}
            type="text"
            value={song}
            onChange={(e) => {
              const next = songs.map((item, index) => (index === i ? e.target.value : item));
              setSongs(next);
              persist(selectedMoods, customMood, next, story);
            }}
            placeholder={SONG_PLACEHOLDERS[i]}
            className="mb-2 h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
        ))}
        {songs.length < 5 ? (
          <button
            type="button"
            onClick={() => setSongs((prev) => [...prev, ""])}
            className="mt-1 h-12 w-full rounded-xl border border-dashed border-[#5c3d2e] text-[15px] font-medium text-[#5c3d2e]"
          >
            + 노래 추가하기
          </button>
        ) : null}
      </div>

      <div className="mt-7">
        <p className="mb-1 text-[16px] font-semibold text-[#3d2b1f]">
          당신의 이야기 <span className="text-red-500">*</span>
        </p>
        <p className="mb-2 text-[13px] text-[#8b6f5c]">
          힘들었던 순간, 감사한 사람, 이루고 싶은 꿈, 나에게 전하고 싶은 말
        </p>
        <textarea
          rows={7}
          maxLength={500}
          value={story}
          onChange={(e) => {
            setStory(e.target.value);
            persist(selectedMoods, customMood, songs, e.target.value);
          }}
          placeholder="당신의 이야기를 자유롭게 들려주세요."
          className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#5c3d2e]"
        />
        <p className="mt-1 text-right text-[12px] text-[#8b6f5c]">{story.length} / 500</p>
      </div>
    </ApplyLayout>
  );
}
