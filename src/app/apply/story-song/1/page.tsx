import { ApplyLayout } from "@/components/apply/ApplyLayout";

export default function ApplyStep1Page() {
  return (
    <ApplyLayout step={1} nextHref="/apply/story-song/2">
      <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-bold text-brown-dark">
        1. 신청자 정보
      </h2>
      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brown-dark">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="실명을 입력해주세요"
            className="w-full rounded-xl border border-border bg-white px-4 py-3.5 text-base outline-none focus:border-brown"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brown-dark">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            placeholder="예) 010-1234-5678"
            className="w-full rounded-xl border border-border bg-white px-4 py-3.5 text-base outline-none focus:border-brown"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brown-dark">이메일</label>
          <input
            type="email"
            placeholder="선택 사항입니다"
            className="w-full rounded-xl border border-border bg-white px-4 py-3.5 text-base outline-none focus:border-brown"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-brown-dark">
            상담 방법 선택 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="rounded-xl bg-brown py-3.5 text-sm font-semibold text-white">
              카카오톡
            </button>
            <button type="button" className="rounded-xl border border-border bg-white py-3.5 text-sm font-semibold text-brown">
              이메일
            </button>
          </div>
        </div>
        <p className="text-xs text-brown-light">
          정확한 연락처를 남겨주셔야 원활한 상담이 가능합니다.
        </p>
      </div>
    </ApplyLayout>
  );
}
