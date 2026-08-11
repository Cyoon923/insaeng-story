import Image from "next/image";
import { ApplyLayout } from "@/components/apply/ApplyLayout";

const QUESTIONS = [
  {
    q: "가장 기억에 남는 순간은 언제인가요?",
    hint: "예: 함께 여행했던 순간, 따뜻한 한마디, 특별한 추억",
    max: 500,
  },
  {
    q: "꼭 전하고 싶은 말은 무엇인가요?",
    hint: "예: 감사의 마음, 사랑의 표현, 전하지 못했던 말",
    max: 500,
  },
  {
    q: "가장 기억하고 싶은 모습은 어떤 모습인가요?",
    hint: "예: 환하게 웃는 모습, 열심히 사는 모습",
    max: 500,
  },
];

export default function ApplyStep3Page() {
  return (
    <ApplyLayout step={3} prevHref="/apply/story-song/2" nextHref="/apply/story-song/4">
      <div className="mb-4 flex items-center justify-between rounded-xl bg-ivory p-3">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-full">
            <Image
              src="https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=80&h=80&fit=crop"
              alt=""
              fill
              className="object-cover"
            />
          </div>
          <span className="text-sm font-medium text-brown-dark">
            선택한 주인공: <strong>부모님</strong>
          </span>
        </div>
        <button type="button" className="text-xs text-brown underline">
          주인공 변경
        </button>
      </div>

      <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-bold text-brown-dark">
        3. 당신의 이야기를 들려주세요
      </h2>
      <p className="mt-2 text-sm text-brown-light">
        정해진 질문에 자유롭게 답해 주세요. 당신의 이야기가 가사와 음악의 소재가 됩니다.
      </p>

      <div className="mt-5 space-y-5">
        {QUESTIONS.map((item, i) => (
          <div key={i}>
            <label className="mb-1 block text-sm font-semibold text-brown-dark">
              {i + 1}. {item.q}
            </label>
            <p className="mb-2 text-xs text-brown-light">{item.hint}</p>
            <textarea
              rows={4}
              placeholder="자유롭게 작성해주세요"
              className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-base outline-none focus:border-brown"
            />
            <p className="mt-1 text-right text-xs text-brown-light">0 / {item.max}</p>
          </div>
        ))}

        <div>
          <label className="mb-1 block text-sm font-semibold text-brown-dark">
            마지막으로 더 하고 싶은 이야기가 있으신가요?
          </label>
          <textarea
            rows={5}
            placeholder="형식 없이 자유롭게 작성해 주세요"
            className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-base outline-none focus:border-brown"
          />
          <p className="mt-1 text-right text-xs text-brown-light">0 / 1000</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#fdf3eb] p-4 text-xs leading-relaxed text-brown">
        ❤️ 많이 쓸수록 더 깊고 감동적인 노래가 됩니다. 부담 없이 마음 가는 대로 작성해 주세요.
      </div>
    </ApplyLayout>
  );
}
