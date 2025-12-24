// app/result/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

function toInt(v: string | null, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export default function ResultPage() {
  const sp = useSearchParams();
  const score = useMemo(() => toInt(sp.get("score"), 0), [sp]);
  const best = useMemo(() => toInt(sp.get("best"), score), [sp, score]);

  const shareText = useMemo(() => {
    return `Dodge Jump 기록: ${score}s (최고 ${best}s)`;
  }, [score, best]);

  const copyShare = async () => {
    await navigator.clipboard.writeText(shareText);
    alert("공유 문구 복사 완료");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-5">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-7 shadow-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Game Over</h1>
          <p className="mt-2 text-white/65">
            엔터로 재시작은 플레이 화면에서 가능합니다.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Score</div>
              <div className="mt-1 text-4xl font-extrabold">{score}s</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs text-white/60">Best</div>
              <div className="mt-1 text-4xl font-extrabold">{best}s</div>
            </div>
          </div>

          <div className="mt-6 flex gap-2 flex-wrap">
            <Link
              href="/play"
              className="px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-white/90 transition"
            >
              다시 하기
            </Link>
            <button
              onClick={copyShare}
              className="px-5 py-3 rounded-2xl border border-white/15 bg-white/5 font-semibold"
            >
              결과 복사
            </button>
            <Link
              href="/"
              className="px-5 py-3 rounded-2xl border border-white/15 bg-white/5 font-semibold"
            >
              홈
            </Link>
          </div>
        </div>

        {/* 광고는 여기(결과 화면)에만 두는 게 제일 안전하고 효율적 */}
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-white/55">
          광고 영역 (결과 화면 전용)
        </div>
      </div>
    </main>
  );
}
