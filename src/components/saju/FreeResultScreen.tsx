import type { FreeResultViewModel } from "@/lib/saju/speakable/buildFreeResultViewModel";
import type { ElementPresenceKind } from "@/lib/saju/types";

const PRESENCE_FILL: Record<ElementPresenceKind, string> = {
  "rooted-visible": "w-full bg-[#5c3d2e]",
  "unrooted-visible": "w-2/3 bg-[#8b6f5c]",
  "hidden-only": "w-1/3 bg-[#c4b5a5]",
  absent: "w-0 bg-transparent",
};

function complementHint(source: FreeResultViewModel["complementChips"][number]["source"]): string {
  if (source === "climate") return "결";
  return "흐름";
}

export type FreeResultScreenProps = {
  model: FreeResultViewModel;
};

/**
 * Free saju result presentation only.
 * Renders `buildFreeResultViewModel` output — no engine re-judgment.
 */
export function FreeResultScreen({ model }: FreeResultScreenProps) {
  const { headline, balance, complementChips, cautions } = model;

  return (
    <div className="mx-auto w-full max-w-[430px] bg-[#f7f4ef] px-4 pb-10 pt-6 text-[#3d2b1f]">
      <header className="mb-6">
        <p className="text-[12px] font-medium tracking-[0.08em] text-[#8b6f5c]">FREE READING</p>
        <h1 className="mt-1 font-serif text-[26px] font-bold leading-snug text-[#3d2b1f]">
          나의 흐름 읽기
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#8b6f5c]">
          확정이 아니라, 지금 보이는 결을 부드럽게 살펴봅니다.
        </p>
      </header>

      <section className="rounded-[1.5rem] bg-gradient-to-b from-white to-[#faf7f2] p-5 shadow-[0_8px_30px_rgba(92,61,46,0.06)] ring-1 ring-[#ebe3d8]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a8907c]">
          한 줄로 보는 흐름
        </p>
        <p className="mt-3 font-serif text-[20px] font-semibold leading-relaxed text-[#3d2b1f]">
          {headline}
        </p>
        <p className="mt-3 inline-flex rounded-full bg-[#f0e8de] px-3 py-1 text-[12px] font-medium text-[#8b6f5c]">
          잠정 관찰
        </p>
      </section>

      <section className="mt-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-[#ebe3d8]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a8907c]">
          오행이 보이는 모습
        </p>
        <p className="mt-1 text-[13px] text-[#8b6f5c]">얼마나 드러나는지만 살핍니다. 점수 없음.</p>
        <ul className="mt-4 space-y-3">
          {balance.map((item) => (
            <li key={item.element} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5efe6] font-serif text-[16px] font-bold text-[#5c3d2e]">
                {item.element}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-[#3d2b1f]">{item.label}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#efe7dc]">
                  <div
                    className={`h-full rounded-full transition-all ${PRESENCE_FILL[item.presence]}`}
                    aria-hidden
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-[#ebe3d8]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a8907c]">
          보완해 볼 수 있는 기운
        </p>
        <p className="mt-1 text-[13px] text-[#8b6f5c]">후보일 뿐, 순서가 아닙니다.</p>
        {complementChips.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-[#faf7f2] px-4 py-3 text-[14px] leading-relaxed text-[#8b6f5c]">
            지금은 열어 둘 보완 후보가 없어요.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {complementChips.map((chip) => (
              <li
                key={`${chip.source}-${chip.element}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#e4d8ca] bg-[#fffdf9] px-3.5 py-2"
              >
                <span className="font-serif text-[17px] font-bold text-[#5c3d2e]">{chip.element}</span>
                <span className="text-[11px] font-medium text-[#a8907c]">
                  {complementHint(chip.source)} · 잠정
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cautions.length > 0 ? (
        <section className="mt-4 rounded-[1.5rem] bg-[#fffaf6] p-5 ring-1 ring-[#eadfce]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a8907c]">
            주의해 볼 점
          </p>
          <ul className="mt-3 space-y-2">
            {cautions.map((phrase) => (
              <li
                key={phrase}
                className="rounded-2xl bg-white/80 px-4 py-3 text-[15px] leading-relaxed text-[#5c3d2e] ring-1 ring-[#efe7dc]"
              >
                {phrase}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
