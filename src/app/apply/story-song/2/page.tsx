import Image from "next/image";
import { ApplyLayout } from "@/components/apply/ApplyLayout";

const PROTAGONISTS = [
  { id: "self", label: "나 자신", image: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=200&h=200&fit=crop" },
  { id: "parents", label: "부모님", image: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=200&h=200&fit=crop" },
  { id: "partner", label: "배우자·연인", image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=200&h=200&fit=crop" },
  { id: "family", label: "가족", image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=200&h=200&fit=crop" },
  { id: "pet", label: "반려동물", image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop" },
  { id: "other", label: "기타", image: null },
];

export default function ApplyStep2Page() {
  return (
    <ApplyLayout step={2} prevHref="/apply/story-song/1" nextHref="/apply/story-song/3">
      <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-bold text-brown-dark">
        2. 누구를 위한 노래인가요?
      </h2>
      <p className="mt-2 text-sm text-brown-light">
        노래의 주인공을 선택하시면, 더 잘 어울리는 질문을 드릴게요.
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {PROTAGONISTS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="overflow-hidden rounded-2xl bg-card ring-2 ring-transparent hover:ring-brown focus:ring-brown"
          >
            <div className="relative aspect-square bg-ivory">
              {p.image ? (
                <Image src={p.image} alt={p.label} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl">✏️</div>
              )}
            </div>
            <p className="py-2 text-xs font-semibold text-brown-dark">{p.label}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-[#fdf3eb] p-4 text-xs leading-relaxed text-brown">
        💡 선택하신 주인공에 따라 더 알맞은 질문을 준비할게요.
      </div>
    </ApplyLayout>
  );
}
