"use client";

import { useState } from "react";
import Image from "next/image";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { saveDraft } from "@/lib/client/api";

const EXAMPLES = [
  { title: "부모님께 전하고 싶은 마음", image: "/images/photo-parents.jpg" },
  { title: "사랑하는 사람과의 특별한 이야기", image: "/images/photo-couple.jpg" },
  { title: "지나온 인생의 소중한 순간들", image: "/images/photo-self.jpg" },
  { title: "감사와 축하의 마음을 담아", image: "/images/photo-gift.jpg" },
];

export default function ApplyStep1Page() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"kakao" | "phone">("kakao");

  const persist = (next: { name?: string; phone?: string; method?: string }) => {
    saveDraft("story", {
      name: next.name ?? name,
      phone: next.phone ?? phone,
      method: next.method ?? (method === "kakao" ? "카카오톡 상담" : "전화 상담"),
    });
  };

  return (
    <ApplyLayout step={1} nextHref="/apply/story-song/2" requireContactFlow="story">
      <h2 className="font-serif text-[22px] font-bold text-[#3d2b1f]">1. 기본정보</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
        신청에 필요한 기본 정보를 입력해 주세요.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              persist({ name: e.target.value });
            }}
            placeholder="실명을 입력해주세요"
            className="h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              persist({ phone: e.target.value });
            }}
            placeholder="예) 010-1234-5678"
            className="h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[15px] font-medium text-[#3d2b1f]">
            상담 방법 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMethod("kakao");
                persist({ method: "카카오톡 상담" });
              }}
              className={`h-12 rounded-xl text-[15px] font-semibold ${
                method === "kakao"
                  ? "bg-[#5c3d2e] text-white"
                  : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"
              }`}
            >
              카카오톡 상담
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("phone");
                persist({ method: "전화 상담" });
              }}
              className={`h-12 rounded-xl text-[15px] font-semibold ${
                method === "phone"
                  ? "bg-[#5c3d2e] text-white"
                  : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"
              }`}
            >
              전화 상담
            </button>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-[#8b6f5c]">
          정확한 연락처를 남겨주셔야 원활한 상담이 가능합니다.
        </p>
      </div>

      <section className="mt-8">
        <h3 className="text-[17px] font-bold text-[#3d2b1f]">이런 이야기를 노래로 만들 수 있어요</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {EXAMPLES.map((item) => (
            <div key={item.title}>
              <div className="relative h-[100px] overflow-hidden rounded-xl bg-[#f5efe6]">
                <Image src={item.image} alt="" fill className="object-cover" sizes="160px" />
              </div>
              <p className="mt-2 text-[14px] font-medium leading-snug text-[#3d2b1f]">{item.title}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-[#f5efe6] px-4 py-3 text-[13px] leading-relaxed text-[#5c3d2e]">
          정해진 형식은 없어요. 당신의 진심을 자유롭게 들려주세요.
        </p>
      </section>
    </ApplyLayout>
  );
}
