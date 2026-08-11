import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Pencil, Crown, Sparkles } from "lucide-react";
import { LIFE_SONG_PRODUCTS, formatPriceFrom } from "@/lib/constants/products";

const ICONS = {
  pencil: Pencil,
  crown: Crown,
  sparkles: Sparkles,
} as const;

interface LifeSongCategoryCardProps {
  product: (typeof LIFE_SONG_PRODUCTS)[number];
  large?: boolean;
}

export function LifeSongCategoryCard({ product, large = false }: LifeSongCategoryCardProps) {
  const Icon = ICONS[product.icon as keyof typeof ICONS];

  return (
    <Link
      href={product.href}
      className={`group block overflow-hidden rounded-2xl bg-card ring-1 ring-border ${
        large ? "shadow-sm" : ""
      }`}
    >
      <div className={`relative w-full overflow-hidden ${large ? "h-36" : "h-24"}`}>
        <Image
          src={product.heroImage}
          alt=""
          fill
          className="object-cover transition group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90"
          style={{ color: product.accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        {product.badge && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold text-brown-dark">{product.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-brown-light">{product.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-brown">{formatPriceFrom(product.priceFrom)}</span>
          <span className="flex items-center text-sm font-medium text-brown">
            자세히 보기 <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
