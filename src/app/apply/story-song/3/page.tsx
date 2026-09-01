"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mic } from "lucide-react";
import { ApplyLayout } from "@/components/apply/ApplyLayout";
import { CHARCOAL_STEPPER } from "@/components/apply/ApplyStepper";
import { getDraft, saveDraft } from "@/lib/client/api";

const PROTAGONIST_IMAGES: Record<string, string> = {
  self: "/images/photo-self.jpg",
  parents: "/images/photo-parents.jpg",
  partner: "/images/photo-couple.jpg",
  family: "/images/photo-family.jpg",
  pet: "/images/photo-pet.jpg",
  other: "/images/photo-self.jpg",
};

const QUESTIONS = [
  {
    key: "memory",
    q: "가장 기억에 남는 순간은 언제인가요?",
    hint: "함께 여행했던 순간, 따뜻한 한마디, 특별한 추억",
    max: 500,
  },
  {
    key: "message",
    q: "꼭 전하고 싶은 말은 무엇인가요?",
    hint: "감사의 마음, 사랑의 표현, 전하지 못했던 말",
    max: 500,
  },
  {
    key: "image",
    q: "가장 기억하고 싶은 모습은 어떤 모습인가요?",
    hint: "환하게 웃는 모습, 열심히 사는 모습, 함께한 행복한 순간",
    max: 500,
  },
] as const;

type AnswerKey = "memory" | "message" | "image" | "free";

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

export default function ApplyStep3Page() {
  const [answers, setAnswers] = useState({ memory: "", message: "", image: "", free: "" });
  const [protagonist, setProtagonist] = useState("부모님");
  const [protagonistId, setProtagonistId] = useState("parents");
  const [listeningKey, setListeningKey] = useState<AnswerKey | null>(null);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef<AnswerKey | null>(null);
  const maxRef = useRef(500);

  useEffect(() => {
    const draft = getDraft("story");
    setAnswers({
      memory: draft.memory ?? "",
      message: draft.message ?? "",
      image: draft.image ?? "",
      free: draft.free ?? "",
    });
    if (draft.protagonist) setProtagonist(draft.protagonist);
    if (draft.protagonistId) setProtagonistId(draft.protagonistId);
  }, []);

  const stopListening = () => {
    keepListeningRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListeningKey(null);
    setInterim("");
  };

  useEffect(() => {
    return () => {
      keepListeningRef.current = null;
      recognitionRef.current?.stop();
    };
  }, []);

  const update = (key: AnswerKey, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    saveDraft("story", next);
  };

  const shownText = (key: AnswerKey) => {
    if (listeningKey !== key || !interim) return answers[key];
    return answers[key] ? `${answers[key]} ${interim}` : interim;
  };

  const startListening = (key: AnswerKey, max: number) => {
    if (listeningKey === key) {
      stopListening();
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) {
      window.alert("이 브라우저에서는 말하기로 적을 수 없습니다. 글로 작성해 주세요.");
      return;
    }

    keepListeningRef.current = null;
    recognitionRef.current?.stop();
    maxRef.current = max;
    keepListeningRef.current = key;
    setInterim("");
    setListeningKey(key);

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
      setAnswers((current) => {
        const merged = current[key] ? `${current[key]} ${spoken}` : spoken;
        const next = { ...current, [key]: merged.slice(0, maxRef.current) };
        saveDraft("story", next);
        return next;
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        stopListening();
        window.alert("마이크 사용을 허용해 주세요.");
      }
    };
    recognition.onend = () => {
      if (keepListeningRef.current !== key) {
        recognitionRef.current = null;
        setListeningKey(null);
        setInterim("");
        return;
      }
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        setListeningKey(null);
        setInterim("");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // 질문 3개와 자유작성란을 통틀어 최소 한 곳에는 내용이 있어야 한다.
  const validateNext = () => {
    const written = Object.values(answers).some((item) => item.trim());
    if (!written) return "이야기를 한 가지 이상 작성해 주세요.";
    return "";
  };

  return (
    <ApplyLayout step={3} prevHref="/apply/story-song/2" nextHref="/apply/story-song/4" validateNext={validateNext}
      stepperTheme={CHARCOAL_STEPPER}
      shellBg="bg-[#FFFFFF]"
    >
      <div className="mb-4 flex items-center justify-between rounded-xl bg-[#f5efe6] p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white">
            <Image
              src={PROTAGONIST_IMAGES[protagonistId] ?? "/images/photo-parents.jpg"}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <p className="text-[12px] text-[#6B6570]">선택한 주인공</p>
            <p className="text-[16px] font-bold text-[#403A49]">{protagonist}</p>
          </div>
        </div>
        <Link href="/apply/story-song/2" className="text-[13px] font-medium text-[#403A49]">
          주인공 변경
        </Link>
      </div>

      <h2 className="text-[22px] font-bold text-[#403A49]">3. 당신의 이야기를 들려주세요</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6B6570]">
        글로 쓰거나, 말로 하셔도 됩니다. 말하는 동안 글자가 바로 나타납니다.
      </p>

      <div className="mt-5 space-y-6">
        {QUESTIONS.map((item, i) => (
          <div key={item.key}>
            <label className="mb-1 block text-[16px] font-semibold text-[#403A49]">
              {i + 1}. {item.q}
            </label>
            <p className="mb-2 text-[13px] text-[#6B6570]">{item.hint}</p>
            <textarea
              rows={5}
              maxLength={item.max}
              value={shownText(item.key)}
              onChange={(e) => update(item.key, e.target.value)}
              placeholder="자유롭게 작성해주세요"
              className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#403A49]"
            />
            <button
              type="button"
              onClick={() => startListening(item.key, item.max)}
              className={`mt-2 flex h-12 w-full items-center justify-center rounded-xl text-[16px] font-semibold ${
                listeningKey === item.key
                  ? "bg-[#403A49] text-white"
                  : "border border-[#d4c8ba] bg-white text-[#403A49]"
              }`}
            >
              <Mic className="mr-2 h-5 w-5" />
              {listeningKey === item.key ? "말씀해 주세요…" : "누르고 말하기"}
            </button>
            {listeningKey === item.key ? (
              <p className="mt-2 rounded-xl bg-[#f5efe6] px-4 py-3 text-[15px] leading-relaxed text-[#403A49]">
                지금 듣고 있어요. 말하면 위 칸에 글자가 바로 나옵니다.
              </p>
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-[#6B6570]">
              <span>버튼을 누른 후 편하게 말씀해 주세요.</span>
              <span className="shrink-0">
                {shownText(item.key).length} / {item.max}
              </span>
            </div>
          </div>
        ))}

        <div>
          <label className="mb-1 block text-[16px] font-semibold text-[#403A49]">하고 싶은 말</label>
          <p className="mb-2 text-[13px] text-[#6B6570]">
            위 질문 외에 전하고 싶은 이야기를 자유롭게 적어주세요.
          </p>
          <textarea
            rows={7}
            maxLength={1000}
            value={shownText("free")}
            onChange={(e) => update("free", e.target.value)}
            placeholder="당신의 이야기를 자유롭게 들려주세요."
            className="w-full resize-none rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#403A49]"
          />
          <button
            type="button"
            onClick={() => startListening("free", 1000)}
            className={`mt-2 flex h-12 w-full items-center justify-center rounded-xl text-[16px] font-semibold ${
              listeningKey === "free"
                ? "bg-[#403A49] text-white"
                : "border border-[#d4c8ba] bg-white text-[#403A49]"
            }`}
          >
            <Mic className="mr-2 h-5 w-5" />
            {listeningKey === "free" ? "말씀해 주세요…" : "누르고 말하기"}
          </button>
          {listeningKey === "free" ? (
            <p className="mt-2 rounded-xl bg-[#f5efe6] px-4 py-3 text-[15px] leading-relaxed text-[#403A49]">
              지금 듣고 있어요. 말하면 위 칸에 글자가 바로 나옵니다.
            </p>
          ) : null}
          <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-[#6B6570]">
            <span>버튼을 누른 후 편하게 말씀해 주세요.</span>
            <span className="shrink-0">{shownText("free").length} / 1000</span>
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-[#f5efe6] px-4 py-3 text-[13px] leading-relaxed text-[#403A49]">
        많이 쓸수록 더 깊고 감동적인 노래가 됩니다. 부담 없이 마음 가는 대로 작성해 주세요.
      </p>
    </ApplyLayout>
  );
}
