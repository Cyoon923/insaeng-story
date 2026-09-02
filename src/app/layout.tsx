import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사주로그 | 인생의 서사를 연주하고 기록한다",
  description: "고객의 이야기 또는 사주를 바탕으로 한 사람만을 위한 인생곡을 만들어 드립니다.",
  // iPhone에서 홈 화면에 추가하면 주소창 없이 앱처럼 실행된다.
  appleWebApp: {
    capable: true,
    title: "사주로그",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // manifest.ts의 theme_color와 같은 값을 쓴다.
  themeColor: "#403A49",
  // standalone 실행 시 노치·홈 인디케이터 영역까지 화면을 채운다.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
