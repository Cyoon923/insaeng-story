"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]";

const PRODUCTS = [
  "이야기로 만드는 인생곡",
  "프리미엄 인생곡",
  "사주 인생곡",
  "잘 모르겠어요",
];

export default function FreeConsultPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"kakao" | "phone">("kakao");
  const [product, setProduct] = useState("잘 모르겠어요");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim() || !phone.trim()) {
      setError("이름과 연락처를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await postApp({ action: "ensureUser", phone, name });
      await postApp({
        action: "createInquiry",
        name,
        phone,
        method: method === "kakao" ? "카카오톡 상담" : "전화 상담",
        product,
        message,
      });
      router.push("/apply/complete?type=inquiry");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문의에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="무료 상담 신청" backHref="/" showActions={false} />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold leading-snug text-[#3d2b1f]">
          연락처만 남겨 주세요
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#8b6f5c]">
          어떤 상품이 맞을지 고민되시면, 이름과 연락처를 남겨 주세요. 카카오톡 또는 전화로 안내해 드립니다.
        </p>
      </section>

      <div className="space-y-5 px-4 pb-8">
        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="실명을 입력해주세요"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="예) 010-1234-5678"
            className={inputClass}
          />
        </div>

        <div>
          <p className="mb-2 text-[15px] font-medium text-[#3d2b1f]">
            상담 방법 <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod("kakao")}
              className={`h-12 rounded-xl text-[15px] font-semibold ${
                method === "kakao" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"
              }`}
            >
              카카오톡
            </button>
            <button
              type="button"
              onClick={() => setMethod("phone")}
              className={`h-12 rounded-xl text-[15px] font-semibold ${
                method === "phone" ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#5c3d2e]"
              }`}
            >
              전화
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[15px] font-medium text-[#3d2b1f]">궁금한 상품</p>
          <div className="grid grid-cols-1 gap-2">
            {PRODUCTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setProduct(item)}
                className={`h-12 rounded-xl text-[15px] font-medium ${
                  product === item ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">하고 싶은 말</label>
          <textarea
            rows={5}
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="궁금한 점을 짧게 적어 주셔도 됩니다."
            className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
          <p className="mt-1 text-right text-[12px] text-[#8b6f5c]">{message.length} / 300</p>
        </div>

        {error ? <p className="text-[14px] text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[16px] font-bold text-white disabled:opacity-40"
        >
          {loading ? "보내는 중..." : "무료 상담 신청하기"}
        </button>
      </div>
    </MobileShell>
  );
}
