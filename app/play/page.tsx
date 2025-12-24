// app/play/page.tsx
import type { Metadata } from "next";
import PlayClient from "./PlayClient";

export const metadata: Metadata = {
  title: "Dodge Jump 플레이",
  description:
    "공을 피하며 오래 살아남는 반사신경 미니 웹게임 Dodge Jump. 키보드로 바로 플레이!",
  alternates: {
    canonical: "/play",
  },
  openGraph: {
    title: "Dodge Jump 플레이",
    description:
      "공을 피하며 오래 살아남는 반사신경 미니 웹게임 Dodge Jump. 키보드로 바로 플레이!",
    url: "/play",
    type: "website",
    locale: "ko_KR",
  },
};

export default function Page() {
  return (
    <>
      <PlayClient />

      {/* SEO용 텍스트(봇/접근성용) */}
      <section className="sr-only">
        <h2>Dodge Jump 미니 웹게임</h2>
        <p>
          Dodge Jump는 키보드로 조작하는 반사신경 기반 무료 웹게임입니다. 좌우 이동과
          점프, 대시를 활용해 공을 피하며 최대한 오래 살아남는 것이 목표입니다.
        </p>
        <p>별도의 설치 없이 브라우저에서 바로 플레이할 수 있는 HTML5 기반 미니게임입니다.</p>
      </section>
    </>
  );
}
