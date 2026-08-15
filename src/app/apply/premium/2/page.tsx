"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { STORY_STEPS } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const PROTAGONISTS = [
  { id: "self", label: "나 자신", image: "/images/photo-self.jpg" },
  { id: "parents", label: "부모님", image: "/images/photo-parents.jpg" },
  { id: "partner", label: "배우자·연인", image: "/images/photo-couple.jpg" },
  { id: "family", label: "가족", image: "/images/photo-family.jpg" },
  { id: "pet", label: "반려동물", image: "/images/photo-pet.jpg" },
  { id: "other", label: "기타", image: null, hint: "친구, 스승님 등" },
] as const;

export default function PremiumStep2Page() {
  const [selected, setSelected] = useState("parents");
  const [otherName, setOtherName] = useState("");

  useEffect(() => {
    const draft = getDraft("premium");
    if (draft.protagonistId) {
      setSelected(draft.protagonistId);
      if (draft.protagonistId === "other" && draft.protagonist && draft.protagonist !== "기타") {
        setOtherName(draft.protagonist);
      }
      return;
    }
    const item = PROTAGONISTS.find((row) => row.id === "parents");
    if (item) saveDraft("premium", { protagonistId: item.id, protagonist: item.label });
  }, []);

  const choose = (id: string, label: string) => {
    setSelected(id);
    if (id === "other") {
      saveDraft("premium", { protagonistId: id, protagonist: otherName || "기타" });
      return;
    }
    saveDraft("premium", { protagonistId: id, protagonist: label });
  };

  return (
    <ApplyLayout
      step={2}
      title="프리미엄 인생곡 신청하기"
      basePath="/apply/premium"
      steps={STORY_STEPS}
      prevHref="/apply/premium/1"
      nextHref="/apply/premium/3"
      heroText={"사주상담과 스토리상담을 바탕으로\n하나뿐인 인생곡을 만듭니다"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">2. 누구를 위한 노래인가요?</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#8b6f5c]">선택한 주인공을 기준으로 사주상담과 스토리상담이 진행됩니다.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {PROTAGONISTS.map((item) => {
          const active = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item.id, item.label)}
              className={`overflow-hidden rounded-2xl bg-white text-left ${active ? "ring-2 ring-[#5c3d2e]" : "ring-1 ring-[#ebe3d8]"}`}
            >
              <div className="relative h-[100px] bg-[#f5efe6]">
                {item.image ? (
                  <Image src={item.image} alt="" fill className="object-cover" sizes="180px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#5c3d2e]">
                    <Pencil className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[15px] font-bold text-[#3d2b1f]">{item.label}</p>
                {"hint" in item && item.hint ? <p className="mt-0.5 text-[12px] text-[#8b6f5c]">{item.hint}</p> : null}
              </div>
            </button>
          );
        })}
      </div>

      {selected === "other" ? (
        <input
          type="text"
          value={otherName}
          onChange={(e) => {
            setOtherName(e.target.value);
            saveDraft("premium", { protagonistId: "other", protagonist: e.target.value || "기타" });
          }}
          placeholder="예) 친구, 스승님"
          className="mt-3 h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#5c3d2e]"
        />
      ) : null}
    </ApplyLayout>
  );
}
