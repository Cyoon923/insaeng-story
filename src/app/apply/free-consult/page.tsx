"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { postApp } from "@/lib/client/api";

const inputClass =
  "h-12 w-full rounded-xl border border-[#e8dfd4] bg-white px-4 text-[16px] outline-none focus:border-[#5c3d2e]";
const MESSAGE_MAX = 300;

const PRODUCTS = [
  "이야기로 만드는 인생곡",
  "프리미엄 인생곡",
  "사주 인생곡",
  "잘 모르겠어요",
];

const SOURCES = [
  "지인 소개",
  "검색",
  "유튜브",
  "인스타그램",
  "카카오톡",
  "기타",
];

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

export default function FreeConsultPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"kakao" | "phone">("kakao");
  const [product, setProduct] = useState("잘 모르겠어요");
  const [source, setSource] = useState("");
  const [customSource, setCustomSource] = useState("");
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);

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

  const shownMessage = listening && interim ? (message ? `${message} ${interim}` : interim) : message;

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
      setMessage((current) => {
        const merged = current ? `${current} ${spoken}` : spoken;
        return merged.slice(0, MESSAGE_MAX);
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

  const submit = async () => {
    setError("");
    if (!name.trim() || !phone.trim()) {
      setError("이름과 연락처를 입력해 주세요.");
      return;
    }
    if (!source) {
      setError("어떻게 알게 되셨는지 골라 주세요.");
      return;
    }
    if (source === "기타" && !customSource.trim()) {
      setError("기타를 고르셨으면 내용을 적어 주세요.");
      return;
    }
    const sourceLabel = source === "기타" ? `기타 (${customSource.trim()})` : source;
    stopListening();
    setLoading(true);
    try {
      await postApp({ action: "ensureUser", phone, name });
      await postApp({
        action: "createInquiry",
        name,
        phone,
        method: method === "kakao" ? "카카오톡 상담" : "전화 상담",
        product,
        message: `알게 된 경로: ${sourceLabel}${message.trim() ? `\n${message}` : ""}`,
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
          <p className="mb-2 text-[15px] font-medium text-[#3d2b1f]">
            어떻게 알게 되셨나요? <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SOURCES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSource(item)}
                className={`h-12 rounded-xl text-[15px] font-medium ${
                  source === item ? "bg-[#5c3d2e] text-white" : "border border-[#e8dfd4] bg-white text-[#3d2b1f]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {source === "기타" ? (
            <input
              type="text"
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              placeholder="어떻게 알게 되셨는지 적어 주세요"
              className={`mt-3 ${inputClass}`}
            />
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-[15px] font-medium text-[#3d2b1f]">하고 싶은 말</label>
          <p className="mb-2 text-[14px] leading-relaxed text-[#8b6f5c]">
            글로 쓰거나, 말로 하셔도 됩니다. 말하는 동안 글자가 바로 나타납니다.
          </p>
          <textarea
            rows={5}
            maxLength={MESSAGE_MAX}
            value={shownMessage}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="궁금한 점이나 사연을 적어 주셔도 됩니다."
            className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#5c3d2e]"
          />
          <button
            type="button"
            onClick={startListening}
            className={`mt-2 flex h-12 w-full items-center justify-center rounded-xl text-[16px] font-semibold ${
              listening
                ? "bg-[#5c3d2e] text-white"
                : "border border-[#d4c8ba] bg-white text-[#5c3d2e]"
            }`}
          >
            {listening ? "듣고 있어요. 다시 누르면 멈춰요" : "말로 말하기"}
          </button>
          {listening ? (
            <p className="mt-2 rounded-xl bg-[#f5efe6] px-4 py-3 text-[15px] leading-relaxed text-[#5c3d2e]">
              지금 듣고 있어요. 말하면 위 칸에 글자가 바로 나옵니다.
            </p>
          ) : null}
          <p className="mt-1 text-right text-[12px] text-[#8b6f5c]">
            {shownMessage.length} / {MESSAGE_MAX}
          </p>
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
