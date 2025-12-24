// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-7 shadow-2xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                Dodge Jump
              </h1>
              <p className="mt-2 text-white/70">
                방향키로 이동하고, 스페이스바로 점프해서 공을 피하세요.
              </p>
            </div>

            <Link
              href="/play"
              className="px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-white/90 transition"
            >
              게임 시작
            </Link>
          </div>

          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/70">이동</div>
              <div className="mt-1 font-semibold">← → (방향키)</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/70">점프</div>
              <div className="mt-1 font-semibold">Space</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/70">재시작</div>
              <div className="mt-1 font-semibold">Enter</div>
            </div>
          </div>

          <div className="mt-6 text-sm text-white/60 leading-relaxed">
            점수는 <b>생존 시간(초)</b>입니다. 시간이 지날수록 공이 더 빨라지고 개수가 늘어납니다.
          </div>
        </div>
      </div>
    </main>
  );
}
