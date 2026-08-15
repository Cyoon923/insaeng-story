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

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const draft = getDraft(flow);
      if (!draft.phone) {
        throw new Error("1단계에서 이름과 연락처를 입력해 주세요.");
      }
      const merged = { ...details, ...draft };
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
      {error ? <p className="mb-3 text-center text-[14px] text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="flex h-14 w-full items-center justify-center rounded-lg bg-[#5c3d2e] text-[16px] font-bold text-white disabled:opacity-40"
      >
        {loading ? "처리 중..." : label}
      </button>
    </div>
  );
}
