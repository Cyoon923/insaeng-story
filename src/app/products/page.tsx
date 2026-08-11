import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { LifeSongCategoryCard } from "@/components/products/LifeSongCategoryCard";
import { LIFE_SONG_PRODUCTS } from "@/lib/constants/products";

export default function ProductsPage() {
  return (
    <MobileShell>
      <AppHeader variant="page" title="인생곡" backHref="/" />

      <section className="px-4 py-6">
        <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-2xl font-bold text-brown-dark">
          인생곡
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-brown-light">
          당신의 이야기 또는 사주를 바탕으로
          <br />
          세상에 하나뿐인 노래를 만들어 드립니다.
        </p>
      </section>

      <div className="space-y-4 px-4 pb-8">
        {LIFE_SONG_PRODUCTS.map((product) => (
          <LifeSongCategoryCard key={product.id} product={product} large />
        ))}
      </div>
    </MobileShell>
  );
}
