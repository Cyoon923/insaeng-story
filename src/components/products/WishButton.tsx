"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { fetchMe, postApp } from "@/lib/client/api";

export function WishButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetchMe().then((data) => {
      setLoggedIn(Boolean(data.user));
      setOn((data.wishlist ?? []).includes(productId));
    });
  }, [productId]);

  const toggle = async () => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    const result = await postApp({ action: "toggleWishlist", productId });
    setOn((result.wishlist ?? []).includes(productId));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-12 items-center justify-center rounded-full border-2 border-[#5c3d2e] px-4 text-[#5c3d2e]"
      aria-pressed={on}
      aria-label={on ? "찜 해제" : "찜하기"}
    >
      <Heart className={`h-5 w-5 ${on ? "fill-[#5c3d2e]" : ""}`} />
    </button>
  );
}
