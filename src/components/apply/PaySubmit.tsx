"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDraft, postApp } from "@/lib/client/api";

export function PaySubmit({
  flow,
  kind,
  product,
  title,
  amount,
  payment,
  details,
  label,
}: {
  flow: string;
  kind: "order" | "consultation";
  product?: "story" | "premium" | "saju-song";
  title: string;
  amount: number;
  payment: string;
  details: Record<string, string>;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const draft = getDraft(flow);
      if (!draft.phone) {
        throw new Error("1단계에서 이름과 연락처를 입력해 주세요.");
      }
      const merged = {
        ...details,
        ...draft,
        referralCode: referralCode.trim().toUpperCase(),
      };
      await postApp({ action: "ensureUser", phone: draft.phone, name: draft.name ?? "" });
      if (kind === "order") {
        const result = await postApp({
          action: "createOrder",
          product,
          title,
          amount,
          payment,
          details: merged,
        });
        router.push(`/apply/complete?type=order&id=${result.order.id}`);
      } else {
        const result = await postApp({
          action: "createConsultation",
          title,
          amount,
          payment,
          teacher: merged.teacher ?? "유비 선생",
          datetime: merged.datetime ?? "",
          purpose: merged.purpose ?? "",
          method: merged.method ?? "카카오톡 상담",
          option: merged.option ?? "없음",
          details: merged,
        });
        router.push(`/apply/complete?type=consult&id=${result.consultation.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <label className="block text-[16px] font-bold text-[#3d2b1f]" htmlFor="referral-code">
        추천인 코드
      </label>
      <p className="mt-1 text-[14px] leading-relaxed text-[#8b6f5c]">없으면 비워 두세요.</p>
      <input
        id="referral-code"
        value={referralCode}
        onChange={(event) => setReferralCode(event.target.value)}
        placeholder="예: IS12AB34"
        className="mt-2 h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]"
      />
      {error ? <p className="mt-3 text-center text-[14px] text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-4 flex h-14 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[16px] font-bold text-white disabled:opacity-40"
      >
        {loading ? "처리 중..." : payment === "무통장 입금" ? "신청하고 입금 안내받기" : label}
      </button>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-[#8b6f5c]">
        {payment === "무통장 입금"
          ? "신청을 받아 둔 뒤, 입금 계좌를 카카오톡 또는 전화로 알려 드립니다."
          : "카드·간편결제는 결제사 등록 후 바로 결제됩니다. 지금은 신청만 접수됩니다."}
      </p>
    </div>
  );
}
