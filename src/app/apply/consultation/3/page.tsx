"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CONSULT_STEPS, CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const CONTENT_MAX = 500;

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function createSpeechRecognition(): BrowserSpeechRecognition | null {
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

export default function ConsultationStep3Page() {
  const [content, setContent] = useState("");
  const [method, setMethod] = useState<"kakao" | "phone">("kakao");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [summary, setSummary] = useState({
    datetime: "8월 12일(화) 오전 10:00",
    teacher: "유비 선생",
    purpose: "직업 · 사업 고민",
    option: "추가 인원 1명(궁합) +50,000원",
  });
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);

  useEffect(() => {
    const draft = getDraft("consultation");
    if (draft.content) setContent(draft.content);
    if (draft.method === "전화 상담") setMethod("phone");
    setSummary({
      datetime: draft.datetime || "8월 12일(화) 오전 10:00",
      teacher: draft.teacher || "유비 선생",
      purpose: draft.purpose || "직업 · 사업 고민",
      option: draft.option || "없음",
    });
  }, []);

  const persist = (nextContent: string, nextMethod: "kakao" | "phone") => {
    saveDraft("consultation", {
      content: nextContent,
      method: nextMethod === "kakao" ? "카카오톡 상담" : "전화 상담",
    });
  };

  const stopListening = () => {
    keepListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  };

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const shownContent = listening && interim ? (content ? `${content} ${interim}` : interim) : content;

  const startListening = () => {
    if (listening) {
      stopListening();
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      window.alert("이 브라우저에서는 말하기로 적을 수 없습니다. 글로 작성해 주세요.");
      return;
    }

    keepListeningRef.current = false;
    recognitionRef.current?.stop();
    keepListeningRef.current = true;
    setInterim("");
    setListening(true);

    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let spoken = "";
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) spoken += text;
        else live += text;
      }
      setInterim(live);
      if (!spoken) return;
      setContent((current) => {
        const merged = (current ? `${current} ${spoken}` : spoken).slice(0, CONTENT_MAX);
        saveDraft("consultation", { content: merged });
        return merged;
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        stopListening();
        window.alert("마이크 사용을 허용해 주세요.");
      }
    };
    recognition.onend = () => {
      if (!keepListeningRef.current) {
        recognitionRef.current = null;
        setListening(false);
        setInterim("");
        return;
      }
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setListening(false);
        setInterim("");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <ApplyLayout
      step={3}
      title="사주 분석 시작하기"
      basePath="/apply/consultation"
      steps={CONSULT_STEPS}
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
      prevHref="/apply/consultation/2"
      nextHref="/apply/consultation/4"
      heroText={"가장 궁금한 내용을\n편하게 적어주세요"}
    >
      <h2 className="font-serif text-[22px] font-bold text-[#403A49]">3. 상담 내용</h2>

      <div className="mt-4 rounded-2xl bg-[#f5efe6] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold text-[#403A49]">선택한 상담 정보</p>
          <Link href="/apply/consultation/1" className="text-[13px] font-medium text-[#403A49]">
            변경하기
          </Link>
        </div>
        <ul className="mt-3 space-y-1 text-[14px] leading-relaxed text-[#403A49]">
          <li>{summary.datetime}</li>
          <li>{summary.teacher}</li>
          <li>{summary.purpose}</li>
          <li>{summary.option}</li>
        </ul>
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-[16px] font-semibold text-[#403A49]">
          가장 궁금한 내용을 적어주세요 <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-[14px] leading-relaxed text-[#6B6570]">
          글로 쓰거나, 말로 하셔도 됩니다. 말하는 동안 글자가 바로 나타납니다.
        </p>
        <textarea
          rows={8}
          maxLength={CONTENT_MAX}
          value={shownContent}
          onChange={(e) => {
            setContent(e.target.value);
            persist(e.target.value, method);
          }}
          placeholder="지금 가장 고민되는 부분이나 궁금한 내용을 자세히 적어주시면 더 정확한 상담이 가능합니다."
          className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#403A49]"
        />
        <button
          type="button"
          onClick={startListening}
          className={`mt-2 flex h-12 w-full items-center justify-center rounded-xl text-[16px] font-semibold ${
            listening
              ? "bg-[#403A49] text-white"
              : "border border-[#d4c8ba] bg-white text-[#403A49]"
          }`}
        >
          {listening ? "듣고 있어요. 다시 누르면 멈춰요" : "말로 말하기"}
        </button>
        {listening ? (
          <p className="mt-2 rounded-xl bg-[#f5efe6] px-4 py-3 text-[15px] leading-relaxed text-[#403A49]">
            지금 듣고 있어요. 말하면 위 칸에 글자가 바로 나옵니다.
          </p>
        ) : null}
        <p className="mt-1 text-right text-[12px] text-[#6B6570]">
          {shownContent.length} / {CONTENT_MAX}
        </p>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[16px] font-semibold text-[#403A49]">
          상담 방법 <span className="text-red-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setMethod("kakao");
              persist(content, "kakao");
            }}
            className={`h-14 rounded-xl text-[15px] font-semibold ${
              method === "kakao" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"
            }`}
          >
            카카오톡 상담
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("phone");
              persist(content, "phone");
            }}
            className={`h-14 rounded-xl text-[15px] font-semibold ${
              method === "phone" ? "bg-[#403A49] text-white" : "border border-[#e8dfd4] bg-white text-[#403A49]"
            }`}
          >
            전화 상담
          </button>
        </div>
      </div>
    </ApplyLayout>
  );
}
