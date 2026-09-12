"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, X } from "lucide-react";

/**
 * 사주로그 AI 안내 도령이의 화면 껍데기.
 *
 * 이 단계에서는 아직 AI에 묻지 않는다. 빠른 질문은 미리 적어 둔 답변을
 * 화면에만 붙여 UI를 확인하는 용도이고, 입력창·전송 버튼은 잠겨 있다.
 * 어떤 경우에도 네트워크 요청을 보내지 않는다.
 *
 * 위치 규칙
 * - 하단 메뉴(BottomNav, h-60px, z-50) 바로 위 오른쪽에 둔다. 메뉴를 가리지 않는다.
 * - 모바일 셸과 같은 max-w-[430px] 안에서 움직여 데스크톱에서도 셸 옆에 붙지 않는다.
 * - iPhone 홈 인디케이터만큼 safe-area를 더해 띄운다.
 * - z는 BottomNav(50)보다 위, BenefitNotice(90)·상담 모달(95)보다 아래로 둔다.
 */
const BOTTOM_NAV_HEIGHT = "60px";

/**
 * 도령이 표정. 지금은 avatar만 화면에 쓰고, 나머지는 답변 종류에 따라
 * 골라 쓸 수 있도록 이름만 정해 둔다. (실제 사용은 AI 연결 단계에서)
 */
export const DORYEONG_FACES = {
  avatar: "/images/doryeong-chatbot-avatar.png",
  greeting: "/images/doryeong-chatbot-greeting.png",
  curious: "/images/doryeong-chatbot-curious.png",
  helpful: "/images/doryeong-chatbot-helpful.png",
  yes: "/images/doryeong-chatbot-yes.png",
  waiting: "/images/doryeong-chatbot-waiting.png",
  goodday: "/images/doryeong-chatbot-goodday.png",
} as const;

export type DoryeongFace = keyof typeof DORYEONG_FACES;

/**
 * 답변 성격에 맞는 표정. AI를 붙일 때 답변을 만들면서 이 값 중 하나를 고른다.
 * greeting 첫 인사 / curious 되묻기 / helpful 안내 / yes 확인 /
 * waiting 처리 중 / goodday 마무리 인사
 */
export type DoryeongMood = "greeting" | "curious" | "helpful" | "yes" | "waiting" | "goodday";

/** 표정 이름을 실제 이미지 경로로 바꾼다. 모르는 값이면 기본 얼굴을 쓴다. */
export function faceSrcOf(mood: DoryeongMood | undefined): string {
  if (!mood) return DORYEONG_FACES.avatar;
  return DORYEONG_FACES[mood] ?? DORYEONG_FACES.avatar;
}

/** 대화 한 줄. AI 연결 단계에서 이 배열에 메시지가 쌓인다. */
export interface ChatMessage {
  id: string;
  role: "user" | "doryeong";
  text: string;
  /** 도령이 메시지에만 쓴다. 없으면 기본 얼굴로 그린다. */
  mood?: DoryeongMood;
}

/**
 * 자주 묻는 주제와 임시 답변.
 *
 * answer는 UI 확인용으로 손으로 적은 문구다. AI를 붙일 때 이 값을 지우고
 * chatKnowledge 기반 응답으로 바꾼다. 지금은 어떤 요청도 보내지 않는다.
 */
const QUICK_QUESTIONS = [
  {
    icon: "🎵",
    label: "인생곡이 뭐예요?",
    answer:
      "사주로그의 인생곡은 이야기를 바탕으로 세상에 하나뿐인 노래를 만드는 서비스예요. 이야기로 만드는 인생곡, 프리미엄 인생곡, 사주 인생곡으로 나뉘어요.",
  },
  {
    icon: "✨",
    label: "인생곡 종류 차이",
    answer:
      "이야기로 만드는 인생곡은 직접 작성한 이야기를 바탕으로 제작하고, 프리미엄 인생곡은 상담과 인생곡 제작을 함께 진행해요. 사주 인생곡은 사주 정보를 바탕으로 현재 필요한 메시지를 노래로 만들어요. 뮤직비디오는 프리미엄 기본 포함이 아니라 선택 가능한 추가 옵션이에요.",
  },
  {
    icon: "🔮",
    label: "사주상담 안내",
    // AI 연결 단계에서는 선생님 이름을 문구에 적지 않고
    // src/lib/constants/consultationTeachers.ts의 현재 데이터를 읽어 안내한다.
    answer:
      "사주로그의 1:1 사주상담은 여러 선생님 중 원하는 선생님을 선택해 진행할 수 있어요. 상담 신청 화면에서 선생님별 상담 정보와 가능한 일정을 확인하고 선택할 수 있어요.",
  },
  {
    icon: "💳",
    label: "가격·옵션",
    answer:
      "상품과 선택 옵션에 따라 금액이 달라져요. 원하시는 상품을 말씀해 주시면 기본 가격과 선택 가능한 옵션을 안내해드릴게요.",
  },
  {
    icon: "📝",
    label: "신청 방법",
    answer:
      "원하는 상품을 선택한 뒤 신청 정보를 입력하고 확인 및 결제를 진행하면 돼요. 상품별로 신청 단계는 조금씩 달라요.",
  },
] as const;

/** 연락받을 방법. 상담 신청 화면에서 쓰는 방식과 같은 어휘를 쓴다. */
const CONTACT_METHODS = ["카카오톡", "전화", "문자"] as const;

type ContactMethod = (typeof CONTACT_METHODS)[number];

/** 도령이 말풍선. 왼쪽 정렬 + 작은 표정 프로필 + 크림색 배경. */
function DoryeongBubble({ text, mood }: { text: string; mood?: DoryeongMood }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3eefb]">
        <Image
          src={faceSrcOf(mood)}
          alt=""
          width={72}
          height={72}
          className="h-8 w-8 object-contain"
        />
      </span>
      <p className="max-w-[78%] whitespace-pre-line rounded-2xl rounded-tl-md bg-[#f5efe6] px-4 py-3 text-[16px] leading-relaxed text-[#403A49]">
        {text}
      </p>
    </div>
  );
}

/** 사용자 말풍선. 오른쪽 정렬 + 브라운 배경 + 흰 글자. */
function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[78%] whitespace-pre-line rounded-2xl rounded-tr-md bg-[#403A49] px-4 py-3 text-[16px] leading-relaxed text-white">
        {text}
      </p>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  // AI 연결 전이라 처음에는 비어 있다. 지금은 빠른 질문으로만 쌓인다.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  // 말풍선 key로만 쓰는 일련번호. 같은 질문을 여러 번 눌러도 값이 겹치지 않는다.
  const seqRef = useRef(0);

  // 실제 상담원 문의 폼. 아직 서버에 보내지 않고 화면에만 결과를 남긴다.
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryMethod, setInquiryMethod] = useState<ContactMethod>("카카오톡");
  const [inquiryContact, setInquiryContact] = useState("");
  const [inquiryText, setInquiryText] = useState("");

  useEffect(() => {
    // 새 말풍선이 생기면 대화 영역 아래가 보이게 한다. 패널 안에서만 움직인다.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /**
   * UI 확인용 임시 동작. 질문을 그대로 사용자 말풍선에 넣고,
   * 미리 적어 둔 답변을 도령이 말풍선에 잇는다. 서버에 아무것도 묻지 않는다.
   */
  const askQuickQuestion = (label: string, answer: string) => {
    const seq = (seqRef.current += 1);
    setMessages((previous) => [
      ...previous,
      { id: `u-${seq}`, role: "user", text: label },
      { id: `d-${seq}`, role: "doryeong", text: answer, mood: "helpful" },
    ]);
  };

  const canSubmitInquiry =
    inquiryName.trim().length > 0 &&
    inquiryContact.trim().length > 0 &&
    inquiryText.trim().length > 0;

  /**
   * 문의 폼 제출. 아직 서버에 저장하지 않고 화면에만 접수 안내를 남긴다.
   * 실제 접수는 이후 단계에서 붙인다.
   */
  const submitInquiry = () => {
    if (!canSubmitInquiry) return;
    const seq = (seqRef.current += 1);
    setMessages((previous) => [
      ...previous,
      {
        id: `u-${seq}`,
        role: "user",
        text: `상담원 문의\n이름: ${inquiryName.trim()}\n연락 방법: ${inquiryMethod}\n연락처: ${inquiryContact.trim()}\n내용: ${inquiryText.trim()}`,
      },
      {
        id: `d-${seq}`,
        role: "doryeong",
        text: "문의가 접수되었어요. 확인 후 상담원이 연락드릴게요.",
        mood: "yes",
      },
    ]);
    setInquiryOpen(false);
    setInquiryName("");
    setInquiryMethod("카카오톡");
    setInquiryContact("");
    setInquiryText("");
  };

  return (
    // 셸 폭에 맞춘 고정 레이어. 빈 영역이 화면 터치를 막지 않도록 pointer-events를 끈다.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[430px]">
      {open ? (
        <section
          className="pointer-events-auto mx-3 flex h-[76vh] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-[#ebe3d8] bg-[#fffdf9] shadow-[0_6px_24px_rgba(64,58,73,0.18)]"
          style={{
            marginBottom: `calc(${BOTTOM_NAV_HEIGHT} + env(safe-area-inset-bottom) + 12px)`,
          }}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-[#ebe3d8] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3eefb]">
              <Image
                src={DORYEONG_FACES.avatar}
                alt=""
                width={72}
                height={72}
                className="h-8 w-8 object-contain"
              />
            </span>
            <span className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold leading-tight text-[#403A49]">사주로그 AI 안내</h2>
              <p className="mt-0.5 text-[12px] leading-tight text-[#6B6570]">
                사주로그 이용을 도와드려요
              </p>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-lg p-2 text-[#6B6570] hover:bg-[#f5efe6]"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* 대화 영역. 첫 인사와 자주 묻는 질문 아래로 실제 대화가 이어진다. */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#faf8f5] px-4 py-4">
            <div className="space-y-2">
              <DoryeongBubble text={"안녕하세요. 도령이에요 🐾\n무엇을 도와드릴까요?"} />
              <p className="pl-11 text-[13px] leading-relaxed text-[#6B6570]">
                상품, 사주상담, 가격과 신청 방법을 물어보세요.
              </p>
            </div>

            <section className="rounded-2xl border border-[#ebe3d8] bg-white p-3">
              <h3 className="text-[13px] font-bold text-[#6B6570]">자주 묻는 질문</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map(({ icon, label, answer }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => askQuickQuestion(label, answer)}
                    className="flex min-w-[calc(50%-0.25rem)] flex-1 items-center gap-1.5 rounded-xl border border-[#e0d5c8] bg-[#fffdf9] px-3 py-2 text-left text-[13px] font-medium text-[#5c3d2e] active:bg-[#f5efe6]"
                  >
                    <span aria-hidden>{icon}</span>
                    <span className="min-w-0 flex-1">{label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#ebe3d8] bg-white p-3">
              <p className="text-[13px] leading-relaxed text-[#6B6570]">
                AI 안내로 해결되지 않으셨나요?
              </p>
              {inquiryOpen ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-[13px] font-bold text-[#403A49]">이름</span>
                    <input
                      type="text"
                      value={inquiryName}
                      onChange={(event) => setInquiryName(event.target.value)}
                      placeholder="이름을 입력해 주세요"
                      className="mt-1 h-11 w-full rounded-xl border border-[#e8dfd4] bg-[#fffdf9] px-3 text-[15px] text-[#403A49] outline-none focus:border-[#403A49]"
                    />
                  </label>

                  <div>
                    <span className="text-[13px] font-bold text-[#403A49]">연락받을 방법</span>
                    <div className="mt-1 flex gap-2">
                      {CONTACT_METHODS.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setInquiryMethod(method)}
                          aria-pressed={inquiryMethod === method}
                          className={`h-10 flex-1 rounded-xl border text-[14px] font-medium ${
                            inquiryMethod === method
                              ? "border-[#403A49] bg-[#403A49] text-white"
                              : "border-[#e0d5c8] bg-[#fffdf9] text-[#5c3d2e]"
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-[13px] font-bold text-[#403A49]">연락처</span>
                    <input
                      type="tel"
                      value={inquiryContact}
                      onChange={(event) => setInquiryContact(event.target.value)}
                      placeholder="연락받을 번호나 아이디"
                      className="mt-1 h-11 w-full rounded-xl border border-[#e8dfd4] bg-[#fffdf9] px-3 text-[15px] text-[#403A49] outline-none focus:border-[#403A49]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[13px] font-bold text-[#403A49]">문의 내용</span>
                    <textarea
                      value={inquiryText}
                      onChange={(event) => setInquiryText(event.target.value)}
                      rows={3}
                      placeholder="궁금한 내용을 적어 주세요"
                      className="mt-1 w-full resize-none rounded-xl border border-[#e8dfd4] bg-[#fffdf9] px-3 py-2 text-[15px] leading-relaxed text-[#403A49] outline-none focus:border-[#403A49]"
                    />
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInquiryOpen(false)}
                      className="h-11 rounded-xl border border-[#e0d5c8] bg-[#fffdf9] px-4 text-[15px] font-medium text-[#6B6570]"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={submitInquiry}
                      disabled={!canSubmitInquiry}
                      className="h-11 flex-1 rounded-xl bg-[#403A49] text-[15px] font-semibold text-white disabled:opacity-40"
                    >
                      문의 남기기
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#403A49] bg-[#fffdf9] text-[15px] font-semibold text-[#403A49] active:bg-[#f5efe6]"
                >
                  실제 상담원에게 문의하기
                </button>
              )}
            </section>

            {messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} text={message.text} />
              ) : (
                <DoryeongBubble key={message.id} text={message.text} mood={message.mood} />
              ),
            )}
            <div ref={endRef} />
          </div>

          <div className="shrink-0 border-t border-[#ebe3d8] bg-[#fffdf9] px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                placeholder="궁금한 내용을 입력해주세요"
                aria-label="메시지 입력"
                className="h-12 flex-1 rounded-xl border border-[#e8dfd4] bg-white px-3 text-[16px] text-[#403A49] outline-none placeholder:text-[#9c96a6] disabled:bg-white"
              />
              <button
                type="button"
                disabled
                aria-label="보내기"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#403A49] text-white disabled:opacity-70"
              >
                <Send className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div
          className="flex justify-end px-3"
          style={{
            paddingBottom: `calc(${BOTTOM_NAV_HEIGHT} + env(safe-area-inset-bottom) + 12px)`,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-[#fffdf9] ring-1 ring-[#e6dcf3] shadow-[0_3px_12px_rgba(124,92,214,0.22)]"
            aria-label="사주로그 AI 안내 열기"
          >
            {/* 아이콘 뒤에서 아주 은은하게 번지는 보라 glow. 움직임이 크지 않게 6초 주기로 둔다. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(124,92,214,0.28)_0%,rgba(124,92,214,0)_70%)] [animation-duration:6s]"
            />
            <Image
              src={DORYEONG_FACES.avatar}
              alt=""
              width={112}
              height={112}
              className="relative h-12 w-12 object-contain"
            />
          </button>
        </div>
      )}
    </div>
  );
}
