"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { LIFE_SONG_PRODUCTS, formatPriceFrom } from "@/lib/constants/products";
import { fetchMe, postApp } from "@/lib/client/api";

export default function WishlistPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setLoggedIn(Boolean(data.user));
      setIds(data.wishlist ?? []);
      setLoaded(true);
    });
  }, []);

  const items = LIFE_SONG_PRODUCTS.filter((product) => ids.includes(product.id));

  const remove = async (productId: string) => {
    const result = await postApp({ action: "toggleWishlist", productId });
    setIds(result.wishlist ?? []);
  };

  return (
    <MobileShell>
      <AppHeader variant="page" title="찜한 상품" backHref="/my" />

      <section className="px-4 py-5">
        <h2 className="font-serif text-[24px] font-bold text-[#403A49]">찜한 상품</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6B6570]">
          관심 있는 상품을 모아 볼 수 있습니다.
        </p>
      </section>

      <div className="space-y-3 px-4 pb-8">
        {loaded && !loggedIn ? (
          <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-[#ebe3d8]">
            <p className="text-[15px] text-[#6B6570]">로그인하면 찜한 상품을 저장할 수 있습니다.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-[#403A49] px-6 text-[15px] font-semibold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : null}
        {loaded && loggedIn && items.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-[#6B6570] ring-1 ring-[#ebe3d8]">
            아직 찜한 상품이 없습니다. 상품 화면에서 하트를 눌러 주세요.
          </p>
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#ebe3d8]">
            <Link href={item.href} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f5efe6]">
              <Image src={item.heroImage} alt="" fill className="object-cover" sizes="80px" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link href={item.href} className="text-[16px] font-bold leading-snug text-[#403A49]">
                  {item.title}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded-lg p-1"
                  aria-label={`${item.title} 찜 해제`}
                >
                  <Heart className="mt-0.5 h-5 w-5 shrink-0 fill-[#403A49] text-[#403A49]" />
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#6B6570]">{item.description}</p>
              <p className="mt-2 text-[15px] font-bold text-[#403A49]">{formatPriceFrom(item.priceFrom)}</p>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
