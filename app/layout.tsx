// app/layout.tsx
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dodge Jump – 반사신경 미니 웹게임",
    template: "%s | Dodge Jump",
  },
  description:
    "공을 피하며 오래 살아남는 반사신경 미니 웹게임. 키보드로 즐기는 무료 웹게임 Dodge Jump!",
  keywords: [
    "공피하기",
    "공피하기 게임",
    "순발력 게임",
    "점수내기",
    "미니게임",
    "웹게임",
    "무료게임",
    "반사신경 게임",
    "피하기 게임",
    "키보드 게임",
    "browser game",
    "dodge game",
  ],
  authors: [{ name: "Dodge Jump" }],
  creator: "Dodge Jump",
  publisher: "Dodge Jump",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "Dodge Jump – 반사신경 미니 웹게임",
    description:
      "공을 피하며 오래 살아남는 반사신경 미니 웹게임. 키보드로 바로 플레이!",
    url: "https://YOUR_DOMAIN.vercel.app",
    siteName: "Dodge Jump",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: "Dodge Jump – 반사신경 미니 웹게임",
    description:
      "공을 피하며 오래 살아남는 반사신경 미니 웹게임. 지금 바로 플레이!",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
