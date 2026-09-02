import type { MetadataRoute } from "next";

/**
 * 사주로그 PWA 매니페스트.
 * 브랜드 색과 문구는 layout.tsx의 metadata와 같은 값을 쓴다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "사주로그",
    short_name: "사주로그",
    description:
      "고객의 이야기 또는 사주를 바탕으로 한 사람만을 위한 인생곡을 만들어 드립니다.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#403A49",
    lang: "ko",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
