"use client";

import { useId, useRef, useState } from "react";
import type { InquiryRetention, InquiryRetentionDecision } from "@/lib/types/inquiryRetention";

type Kind = "inquiry" | "chat" | "refund";
const classifications = {
  unclassified: "미분류", general: "일반 문의", complaint: "불만·분쟁", transaction: "거래 관련", mixed: "혼합 문의",
} as const;
const reasons = {
  "classification-review": "분류 확인 필요", "ongoing-handling": "처리 중",
  "ongoing-dispute": "분쟁 진행 중", "legal-proceeding": "법적 절차 진행 중",
} as const;
const blank = (): InquiryRetentionDecision => ({ classification: "unclassified", resolvedAt: null, grounds: [], hold: null, complaintRecordIds: [] });
const inputClass = "mt-1 min-h-11 w-full rounded-lg border border-[#d4c8ba] bg-white px-3 py-2 text-[16px]";
const buttonClass = "min-h-11 rounded-lg border border-[#d4c8ba] px-4 py-2 text-[15px] font-semibold disabled:opacity-50";
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** 문의 본문 없이 선택한 대상의 보존 정보만 다룬다. */
export function InquiryRetentionEditor({ kind, id }: { kind: Kind; id: string }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-4 border-t border-[#ebe3d8] pt-3 text-[#5c3d2e]">
    <button type="button" aria-expanded={open} className={buttonClass} onClick={() => setOpen(!open)}>
      {open ? "보존 정보 닫기" : "문의 분류·보존 정보"}
    </button>
    {open ? <Editor key={`${kind}:${id}`} kind={kind} id={id} /> : null}
  </div>;
}

function Editor({ kind, id }: { kind: Kind; id: string }) {
  const labelId = useId();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [decision, setDecision] = useState(blank);
  const [resolved, setResolved] = useState("");
  const [reason, setReason] = useState<"" | keyof typeof reasons>("");
  const [review, setReview] = useState("");
  const [links, setLinks] = useState("");
  const [message, setMessage] = useState("");
  const [mustReload, setMustReload] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const requiresHold = ["unclassified", "complaint", "mixed"].includes(decision.classification);
  const allowsLinks = ["complaint", "transaction", "mixed"].includes(decision.classification);

  function apply(value: { retention: InquiryRetention | null; revision: number }) {
    const next = value.retention?.decision ?? blank();
    setDecision(next); setRevision(value.revision);
    setResolved(localDate(next.resolvedAt)); setReason(next.hold?.reason ?? "");
    setReview(localDate(next.hold?.reviewAt ?? null)); setLinks(next.complaintRecordIds.join("\n"));
    setLastSaved(value.retention?.history.at(-1)?.at ?? null);
    setLoaded(true); setMustReload(false);
  }
  async function load() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setLoaded(false); setMessage("");
    try {
      const response = await fetch(`/api/admin/inquiry-retention?${new URLSearchParams({ kind, id })}`, { cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "보존 정보를 불러오지 못했습니다.");
      apply(value);
      setMessage("최신 정보를 불러왔습니다. 내용을 확인한 뒤 저장해 주세요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "보존 정보를 불러오지 못했습니다."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function save() {
    if (busyRef.current || !loaded || mustReload) return;
    if (decision.grounds.length) { setMessage("보존 근거가 있는 기록은 현재 화면에서 변경할 수 없습니다."); return; }
    if (requiresHold && !reason) { setMessage("이 분류에는 보류 사유와 다음 검토일이 필요합니다."); return; }
    const resolvedAt = resolved ? new Date(resolved) : null;
    const reviewAt = review ? new Date(review) : null;
    if (resolvedAt && (!Number.isFinite(resolvedAt.getTime()) || resolvedAt.getTime() > Date.now())) {
      setMessage("처리 종료일은 현재까지의 날짜와 시간으로 입력해 주세요."); return;
    }
    if (reason && (!reviewAt || !Number.isFinite(reviewAt.getTime()) || reviewAt.getTime() <= Date.now())) {
      setMessage("다음 검토일은 현재보다 이후로 입력해 주세요."); return;
    }
    const complaintRecordIds = links.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if ((!allowsLinks && complaintRecordIds.length) || complaintRecordIds.length > 50 || new Set(complaintRecordIds).size !== complaintRecordIds.length) {
      setMessage("연결 기록을 확인해 주세요. 일반·미분류 문의에는 연결할 수 없으며, 중복 없이 최대 50개입니다."); return;
    }
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/inquiry-retention", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, expectedRevision: revision, decision: {
          classification: decision.classification, resolvedAt: resolvedAt?.toISOString() ?? null, grounds: [],
          hold: reason ? { reason, reviewAt: reviewAt!.toISOString() } : null, complaintRecordIds,
        } }),
      });
      const value = await response.json();
      if (!response.ok) {
        if (response.status === 409) setMustReload(true);
        throw new Error(value.error ?? "저장하지 못했습니다.");
      }
      apply(value); setMessage("보존 정보를 저장했습니다.");
    } catch (error) {
      // 응답이 불명확해도 같은 revision으로 재저장하지 않고 최신 결과를 확인한다.
      setMustReload(true);
      setMessage(error instanceof Error ? error.message : "저장 결과를 확인하지 못했습니다. 최신 정보를 다시 조회해 주세요.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="mt-3 space-y-3 text-[15px]">
    <p>분류와 보류 정보를 기록합니다. 저장해도 문의가 삭제되거나 환불·처리 상태가 바뀌지 않습니다.</p>
    <button type="button" disabled={busy} className={buttonClass} onClick={load}>
      {busy ? "처리 중…" : "최신 정보 조회"}
    </button>
    {message ? <p role="status" className="whitespace-pre-wrap">{message}</p> : null}
    {loaded ? <>
      {lastSaved ? <p className="text-[13px]">마지막 저장: {new Date(lastSaved).toLocaleString("ko-KR")}</p> : <p>아직 분류 정보가 저장되지 않았습니다.</p>}
      <fieldset disabled={busy || mustReload || decision.grounds.length > 0} className="space-y-3 disabled:opacity-60">
        <legend className="sr-only">문의 보존 정보 입력</legend>
        <label className="block" htmlFor={`${labelId}-classification`}>문의 분류
          <select id={`${labelId}-classification`} className={inputClass} value={decision.classification} onChange={(e) => setDecision({ ...decision, classification: e.target.value as InquiryRetentionDecision["classification"] })}>
            {Object.entries(classifications).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block">처리 종료일 (진행 중이면 비워 두세요)
          <input type="datetime-local" className={inputClass} value={resolved} onChange={(e) => setResolved(e.target.value)} />
        </label>
        <label className="block">보류 사유{requiresHold ? " (필수)" : ""}
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            <option value="">보류 없음</option>
            {Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {reason ? <label className="block">다음 검토일 (필수)
          <input type="datetime-local" className={inputClass} value={review} onChange={(e) => setReview(e.target.value)} />
        </label> : null}
        <label className="block">연결할 불만 기록 ID (선택, 한 줄에 하나)
          <textarea className={inputClass} rows={2} value={links} onChange={(e) => setLinks(e.target.value)} />
        </label>
        <p className="text-[13px]">이미 존재하는 기록만 연결합니다. 일반·미분류 문의에서는 비워 주세요. 이름이나 문의 내용은 입력하지 마세요.</p>
        <button type="button" className={`${buttonClass} bg-[#5c3d2e] text-white`} onClick={save}>보존 정보 저장</button>
      </fieldset>
      {mustReload ? <p role="alert">저장이 잠겼습니다. 최신 정보를 조회한 뒤 다시 확인해 주세요.</p> : null}
      {decision.grounds.length ? <p role="alert">보존 근거가 있는 기록은 현재 화면에서 변경할 수 없습니다.</p> : null}
    </> : null}
  </div>;
}
