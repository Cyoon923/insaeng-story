"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { getDraft, saveDraft } from "@/lib/client/api";

const PROTAGONISTS = [
  { id: "self", label: "나 자신", image: "/images/photo-self.jpg" },
  { id: "parents", label: "부모님", image: "/images/photo-parents.jpg" },
  { id: "partner", label: "배우자·연인", image: "/images/photo-couple.jpg" },
  { id: "family", label: "가족", image: "/images/photo-family.jpg" },
  { id: "pet", label: "반려동물", image: "/images/photo-pet.jpg" },
  { id: "other", label: "기타", image: null, hint: "친구, 스승님 등" },
] as const;

export default function ApplyStep2Page() {
  const [selected, setSelected] = useState<string>("self");
  const [otherName, setOtherName] = useState("");

  useEffect(() => {
    const draft = getDraft("story");
    if (draft.protagonistId) {
      setSelected(draft.protagonistId);
      if (draft.protagonistId === "other" && draft.protagonist && draft.protagonist !== "기타") {
        setOtherName(draft.protagonist);
      }
      return;
    }
    const item = PROTAGONISTS.find((row) => row.id === "self");
    if (item) saveDraft("story", { protagonistId: item.id, protagonist: item.label });
  }, []);

  const choose = (id: string, label: string) => {
    setSelected(id);
    if (id === "other") {
      saveDraft("story", { protagonistId: id, protagonist: otherName || "기타" });
      return;
    }
    saveDraft("story", { protagonistId: id, protagonist: label });
  };

  return (
    <ApplyLayout step={2} prevHref="/apply/story-song/1" nextHref="/apply/story-song/3">
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">2. 누구를 위한 노래인가요?</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
        노래의 주인공을 선택하시면, 더 잘 어울리는 질문을 드릴게요.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {PROTAGONISTS.map((item) => {
          const active = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item.id, item.label)}
              className={`overflow-hidden rounded-2xl bg-white text-left ${
                active ? "ring-2 ring-[#5c3d2e]" : "ring-1 ring-[#ebe3d8]"
              }`}
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
                {"hint" in item && item.hint ? (
                  <p className="mt-0.5 text-[12px] text-[#8b6f5c]">{item.hint}</p>
                ) : null}
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
            saveDraft("story", { protagonistId: "other", protagonist: e.target.value || "기타" });
          }}
          placeholder="예) 친구, 스승님"
          className="mt-3 h-14 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[17px] outline-none focus:border-[#5c3d2e]"
        />
      ) : null}

      <p className="mt-4 rounded-xl bg-[#f5efe6] px-4 py-3 text-[13px] leading-relaxed text-[#5c3d2e]">
        선택하신 주인공에 따라 더 알맞은 질문을 준비할게요.
      </p>
    </ApplyLayout>
  );
}
