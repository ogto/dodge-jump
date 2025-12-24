// app/play/PlayClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Keys = { left: boolean; right: boolean; jump: boolean };

const BEST_KEY = "dodge_jump_best_v5";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep01(x: number) {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}
function readBest(): number {
  if (typeof window === "undefined") return 0;
  const n = Number(localStorage.getItem(BEST_KEY) ?? "0");
  return Number.isFinite(n) ? Math.floor(n) : 0;
}
function writeBest(best: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BEST_KEY, String(best));
}

/** 공 타입 */
type BallTypeId = "tiny_fast" | "big_slow" | "bouncer" | "dropper" | "sniper";

type BallType = {
  id: BallTypeId;
  rMin: number;
  rMax: number;
  color: string;
  glow: string;
  trail: string;
  trailLen: number;

  // 물리 범위(타입별 개성)
  restMin: number;
  restMax: number;
  fricMin: number;
  fricMax: number;
  dragMin: number;
  dragMax: number;
  gMin: number;
  gMax: number;

  // 초기 속도 스케일
  vxScale: number;
  vyScale: number;

  weight: number;
};

const BALL_TYPES: BallType[] = [
  {
    id: "tiny_fast",
    rMin: 8,
    rMax: 13,
    color: "rgba(34,211,238,0.95)",
    glow: "rgba(34,211,238,0.60)",
    trail: "rgba(34,211,238,0.26)",
    trailLen: 18,
    restMin: 0.82,
    restMax: 0.92,
    fricMin: 0.01,
    fricMax: 0.05,
    dragMin: 0.0012,
    dragMax: 0.0035,
    gMin: 1600,
    gMax: 2200,
    vxScale: 1.35,
    vyScale: 1.0,
    weight: 30,
  },
  {
    id: "big_slow",
    rMin: 18,
    rMax: 28,
    color: "rgba(124,92,255,0.92)",
    glow: "rgba(124,92,255,0.55)",
    trail: "rgba(124,92,255,0.20)",
    trailLen: 12,
    restMin: 0.78,
    restMax: 0.88,
    fricMin: 0.02,
    fricMax: 0.07,
    dragMin: 0.0015,
    dragMax: 0.0045,
    gMin: 1500,
    gMax: 2100,
    vxScale: 0.9,
    vyScale: 0.9,
    weight: 18,
  },
  {
    id: "bouncer",
    rMin: 12,
    rMax: 18,
    color: "rgba(250,204,21,0.95)",
    glow: "rgba(250,204,21,0.55)",
    trail: "rgba(250,204,21,0.22)",
    trailLen: 20,
    restMin: 0.90,
    restMax: 0.97,
    fricMin: 0.01,
    fricMax: 0.05,
    dragMin: 0.0010,
    dragMax: 0.0030,
    gMin: 1400,
    gMax: 2000,
    vxScale: 1.05,
    vyScale: 1.25,
    weight: 16,
  },
  {
    id: "dropper",
    rMin: 10,
    rMax: 16,
    color: "rgba(248,113,113,0.92)",
    glow: "rgba(248,113,113,0.55)",
    trail: "rgba(248,113,113,0.22)",
    trailLen: 16,
    restMin: 0.84,
    restMax: 0.93,
    fricMin: 0.01,
    fricMax: 0.06,
    dragMin: 0.0012,
    dragMax: 0.0038,
    gMin: 1900,
    gMax: 2600,
    vxScale: 0.85,
    vyScale: 1.35,
    weight: 22,
  },
  {
    id: "sniper",
    rMin: 9,
    rMax: 14,
    color: "rgba(167,139,250,0.92)",
    glow: "rgba(167,139,250,0.55)",
    trail: "rgba(167,139,250,0.22)",
    trailLen: 14,
    restMin: 0.80,
    restMax: 0.90,
    fricMin: 0.01,
    fricMax: 0.05,
    dragMin: 0.0009,
    dragMax: 0.0026,
    gMin: 1500,
    gMax: 2200,
    vxScale: 1.60,
    vyScale: 0.85,
    weight: 14,
  },
];

function pickBallType(): BallType {
  const sum = BALL_TYPES.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * sum;
  for (const t of BALL_TYPES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return BALL_TYPES[0];
}

type TrailPt = { x: number; y: number; a: number };

type Ball = {
  type: BallTypeId;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;

  rest: number;
  fric: number;
  drag: number;
  g: number;

  flowDir: -1 | 1;

  color: string;
  glow: string;
  trailColor: string;
  trailLen: number;
  trailPts: TrailPt[];
};

export default function PlayClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const keysRef = useRef<Keys>({ left: false, right: false, jump: false });

  const [isGameOver, setIsGameOver] = useState(false);
  const [scoreUI, setScoreUI] = useState(0);
  const [bestUI, setBestUI] = useState(0);

  // 렌더 최소화용 ref
  const scoreRef = useRef(0);
  const bestRef = useRef(0);

  // 대시/무적
  const dashRef = useRef({
    activeT: 0,
    cooldownT: 0,
    invulnT: 0,
    dir: 1 as -1 | 1,
    request: false,
  });

  const dpr = useMemo(
    () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    []
  );

  const stateRef = useRef({
    startedAt: 0,
    lastT: 0,

    w: 900,
    h: 520,
    groundY: 420,

    // player
    px: 450,
    py: 420,
    pw: 34,
    ph: 48,
    vx: 0,
    vy: 0,
    onGround: true,
    jumpCount: 0, // ✅ 더블점프

    balls: [] as Ball[],
  });

  /** 난이도 t(0~1): 0~5초는 0, 5~25초 서서히 1, 이후 1 유지 */
  function difficultyT(scoreSec: number) {
    const raw = (scoreSec - 5) / 20;
    return smoothstep01(raw);
  }

  function currentParams(scoreSec: number) {
    const t = difficultyT(scoreSec);

    // 공 개수: 0초 3개 → 25초 8개 → 이후 14개까지 천천히
    const base = Math.round(lerp(3, 8, t));
    const extra = Math.min(6, Math.floor(Math.max(0, scoreSec - 25) / 18)); // 18초마다 +1 (최대 +6)
    const targetBalls = clamp(base + extra, 3, 14);

    // 바람(wind) 가속: 자연스러운 “흐름”
    const windA = lerp(18, 130, t) + Math.min(60, extra * 10);

    // 공 기본 속도(스폰시): 초반 느리게 → 중반 빠르게 → 이후 완만
    const baseSpeed = lerp(240, 420, t) + Math.min(140, extra * 18);

    // 스폰 빈도(부족할 때 채우는 확률)
    const fillProb = lerp(0.02, 0.09, t) + Math.min(0.04, extra * 0.004);

    // 공 중력 추가(스폰시): 초반 가벼움 → 점점 묵직
    const gAdd = lerp(0, 700, t) + Math.min(500, extra * 80);

    return { t, targetBalls, windA, baseSpeed, fillProb, gAdd, extra };
  }

  /** 공 생성: 초기조건만 랜덤, 이후 흐름+물리로 자연스럽게 지나감 */
  const spawnBall = (scoreSec: number) => {
    const s = stateRef.current;
    const { t, baseSpeed, gAdd } = currentParams(scoreSec);

    const type = pickBallType();
    const r = type.rMin + Math.random() * (type.rMax - type.rMin);
    const rest = type.restMin + Math.random() * (type.restMax - type.restMin);
    const fric = type.fricMin + Math.random() * (type.fricMax - type.fricMin);
    const drag = type.dragMin + Math.random() * (type.dragMax - type.dragMin);

    // 드롭 확률은 초반 낮게 → 점점 증가(초반 난이도 완화)
    const preferDrop = type.id === "dropper" ? lerp(0.20, 0.62, t) : lerp(0.18, 0.38, t);
    const roll = Math.random();

    let x = 0,
      y = 0,
      vx = 0,
      vy = 0;
    let flowDir: -1 | 1 = 1;

    if (roll < preferDrop) {
      // 상단 드롭
      x = 70 + Math.random() * (s.w - 140);
      y = -r - 50;

      flowDir = Math.random() < 0.5 ? -1 : 1;

      // 드롭은 옆속도 적당히
      vx = flowDir * lerp(120, 240, t) * type.vxScale;
      vy = lerp(80, 190, t) * type.vyScale;
    } else {
      // 좌/우 스윕 (몸통 높이 위협)
      const fromLeft = Math.random() < 0.5;
      flowDir = fromLeft ? 1 : -1;

      x = fromLeft ? -r - 50 : s.w + r + 50;

      // 초반엔 더 낮은 궤적 비중 높여서 “점프로 해결”이 되지 않게
      const low =
        Math.random() < lerp(0.88, 0.75, t)
          ? Math.random() * 90
          : 90 + Math.random() * 80;
      y = s.groundY - r - low;

      vx = flowDir * (baseSpeed + Math.random() * lerp(140, 260, t)) * type.vxScale;
      vy = (-60 + Math.random() * 120) * type.vyScale * 0.55;
    }

    const b: Ball = {
      type: type.id,
      x,
      y,
      r,
      vx,
      vy,
      rest,
      fric,
      drag,
      g: (type.gMin + Math.random() * (type.gMax - type.gMin)) + gAdd,
      flowDir,
      color: type.color,
      glow: type.glow,
      trailColor: type.trail,
      trailLen: type.trailLen,
      trailPts: Array.from({ length: type.trailLen }, () => ({ x, y, a: 0 })),
    };

    s.balls.push(b);
  };

  const init = () => {
    const s = stateRef.current;
    const now = performance.now();
    s.startedAt = now;
    s.lastT = now;

    s.px = s.w / 2;
    s.py = s.groundY;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
    s.jumpCount = 0;

    s.balls = [];

    scoreRef.current = 0;
    setScoreUI(0);

    // dash reset
    dashRef.current.activeT = 0;
    dashRef.current.cooldownT = 0;
    dashRef.current.invulnT = 0;
    dashRef.current.dir = 1;
    dashRef.current.request = false;

    // 시작은 3개(연습 구간)
    spawnBall(0);
    spawnBall(0);
    spawnBall(0);
  };

  const restart = () => {
    setIsGameOver(false);
    init();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    ctx.clearRect(0, 0, s.w, s.h);

    // grid
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= s.w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s.h);
      ctx.stroke();
    }
    for (let y = 0; y <= s.h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s.w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ground line
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, s.groundY + 1);
    ctx.lineTo(s.w, s.groundY + 1);
    ctx.stroke();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, b: Ball) => {
    // trail
    ctx.save();
    for (let i = 0; i < b.trailPts.length; i++) {
      const p = b.trailPts[i];
      if (p.a <= 0.01) continue;
      const t = i / Math.max(1, b.trailPts.length - 1);
      const rr = b.r * (0.55 + t * 0.35);
      ctx.beginPath();
      ctx.fillStyle = b.trailColor;
      ctx.globalAlpha = p.a * (0.25 + t * 0.55);
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // body
    ctx.beginPath();
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.glow;
    ctx.shadowBlur = 18;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    const px = s.px - s.pw / 2;
    const py = s.py - s.ph;

    const dashOn = dashRef.current.activeT > 0;
    const invuln = dashRef.current.invulnT > 0;

    ctx.fillStyle = dashOn ? "rgba(255,255,255,0.92)" : "rgba(124,92,255,0.95)";
    ctx.shadowColor = invuln ? "rgba(34,211,238,0.70)" : "rgba(124,92,255,0.55)";
    ctx.shadowBlur = invuln ? 28 : 18;

    ctx.fillRect(px, py, s.pw, s.ph);
    ctx.shadowBlur = 0;

    // 더블점프 UI(작게)
    if (!s.onGround) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      const dots = 2 - s.jumpCount; // 남은 점프
      for (let i = 0; i < dots; i++) {
        ctx.beginPath();
        ctx.arc(s.px - 10 + i * 10, py - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };

  const intersectsPlayer = () => {
    const s = stateRef.current;
    const rx = s.px - s.pw / 2;
    const ry = s.py - s.ph;
    const rw = s.pw;
    const rh = s.ph;

    for (const b of s.balls) {
      const closestX = clamp(b.x, rx, rx + rw);
      const closestY = clamp(b.y, ry, ry + rh);
      const dx = b.x - closestX;
      const dy = b.y - closestY;
      if (dx * dx + dy * dy <= b.r * b.r) return true;
    }
    return false;
  };

  const updateBalls = (dt: number, scoreSec: number) => {
    const s = stateRef.current;
    const { windA } = currentParams(scoreSec);

    const floorY = s.groundY;
    for (const b of s.balls) {
      // 흐름(바람): 항상 적용(자연스런 “들어오고 나감”)
      b.vx += b.flowDir * windA * dt;

      // 중력
      b.vy += b.g * dt;

      // 공기저항
      const damp = Math.exp(-b.drag * 60 * dt);
      b.vx *= damp;
      b.vy *= damp;

      // 이동
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 바닥 반발
      const fy = floorY - b.r;
      if (b.y > fy) {
        b.y = fy;
        if (b.vy > 0) b.vy = -b.vy * b.rest;
        b.vx *= 1 - b.fric;

        // “지렁이 퇴장” 방지:
        // 멈췄을 때 갑자기 킥 주지 않고,
        // 아주 작은 vx로 늘어지는 상황만 최소 속도로 “자연스럽게” 유지
        const minVx = 120;
        if (Math.abs(b.vx) < minVx) b.vx = Math.sign(b.vx || b.flowDir) * minVx;
      }

      // trail
      for (let i = 0; i < b.trailPts.length; i++) b.trailPts[i].a *= 0.92;
      b.trailPts.unshift({ x: b.x, y: b.y, a: 1 });
      if (b.trailPts.length > b.trailLen) b.trailPts.pop();
    }

    // 화면 밖 → 제거
    const margin = 260;
    for (let i = s.balls.length - 1; i >= 0; i--) {
      const b = s.balls[i];
      const out =
        b.x < -margin ||
        b.x > s.w + margin ||
        b.y > s.h + margin ||
        b.y < -margin;
      if (out) s.balls.splice(i, 1);
    }
  };

  const ensureBallCount = (scoreSec: number) => {
    const s = stateRef.current;
    const { targetBalls, fillProb } = currentParams(scoreSec);

    // 부족하면 확률적으로 채움(한 프레임에 갑자기 우르르 생기는 느낌 방지)
    while (s.balls.length < targetBalls) {
      // 시작 프레임엔 바로 채워도 되지만, 자연스러움 위해 약간의 확률을 사용
      if (Math.random() < fillProb || s.balls.length < 3) spawnBall(scoreSec);
      else break;
    }

    // 혹시 초반에 너무 적으면 최소 3개는 유지
    while (s.balls.length < 3) spawnBall(scoreSec);
  };

  const gameOver = (finalScore: number) => {
    const nextBest = Math.max(bestRef.current, finalScore);
    bestRef.current = nextBest;
    writeBest(nextBest);

    setScoreUI(finalScore);
    setBestUI(nextBest);
    setIsGameOver(true);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const step = (t: number) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = Math.min(0.033, (t - s.lastT) / 1000);
    s.lastT = t;

    // 점수(초)
    const scoreSec = Math.floor((t - s.startedAt) / 1000);

    // UI는 초 단위로만 갱신
    if (scoreSec !== scoreRef.current) {
      scoreRef.current = scoreSec;
      setScoreUI(scoreSec);
    }

    // 공 수 유지
    ensureBallCount(scoreSec);

    // 대시 타이머
    dashRef.current.cooldownT = Math.max(0, dashRef.current.cooldownT - dt);
    dashRef.current.activeT = Math.max(0, dashRef.current.activeT - dt);
    dashRef.current.invulnT = Math.max(0, dashRef.current.invulnT - dt);

    // 입력으로 방향 기억
    const keys = keysRef.current;
    if (keys.left) dashRef.current.dir = -1;
    if (keys.right) dashRef.current.dir = 1;

    // 대시 발동
    if (dashRef.current.request && dashRef.current.cooldownT <= 0 && dashRef.current.activeT <= 0) {
      dashRef.current.request = false;
      dashRef.current.activeT = 0.12;
      dashRef.current.invulnT = 0.08;
      dashRef.current.cooldownT = 0.75;
    } else {
      dashRef.current.request = false;
    }

    const dashOn = dashRef.current.activeT > 0;

    // 플레이어 이동
    const accel = 3000;
    const friction = 2300;
    const maxSpeed = 390;

    if (!dashOn) {
      if (keys.left) s.vx -= accel * dt;
      if (keys.right) s.vx += accel * dt;
      if (!keys.left && !keys.right) {
        if (s.vx > 0) s.vx = Math.max(0, s.vx - friction * dt);
        if (s.vx < 0) s.vx = Math.min(0, s.vx + friction * dt);
      }
      s.vx = clamp(s.vx, -maxSpeed, maxSpeed);
    } else {
      s.vx = dashRef.current.dir * 980;
    }

    // 더블 점프
    if (keys.jump) {
      // 0: 바닥에서 첫 점프
      // 1: 공중에서 두번째
      if (s.onGround || s.jumpCount < 2) {
        s.vy = s.jumpCount === 0 ? -640 : -560;
        s.jumpCount += 1;
        s.onGround = false;
        keysRef.current.jump = false; // 한 번만
      } else {
        keysRef.current.jump = false;
      }
    }

    // 중력
    const gravity = 2100;
    s.vy += gravity * dt;

    // 이동 적용
    s.px += s.vx * dt;
    s.py += s.vy * dt;

    // 벽 클램프
    s.px = clamp(s.px, s.pw / 2, s.w - s.pw / 2);

    // 바닥
    if (s.py >= s.groundY) {
      s.py = s.groundY;
      s.vy = 0;
      s.onGround = true;
      s.jumpCount = 0;
    }

    // 공 업데이트
    updateBalls(dt, scoreSec);

    // 충돌(무적이면 스킵)
    if (dashRef.current.invulnT <= 0) {
      if (intersectsPlayer()) {
        // 마지막 프레임 렌더 후 오버
        drawBackground(ctx);
        for (const b of s.balls) drawBall(ctx, b);
        drawPlayer(ctx);
        gameOver(scoreSec);
        return;
      }
    }

    // 렌더
    drawBackground(ctx);
    for (const b of s.balls) drawBall(ctx, b);
    drawPlayer(ctx);

    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    // best 초기화
    const b = readBest();
    bestRef.current = b;
    setBestUI(b);

    const onKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) {
        if (e.code === "Enter") restart();
        return;
      }

      if (e.code === "ArrowLeft") keysRef.current.left = true;
      if (e.code === "ArrowRight") keysRef.current.right = true;

      // Space: 점프(더블)
      if (e.code === "Space") keysRef.current.jump = true;

      // Shift: 대시(요청)
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        dashRef.current.request = true;
      }

      // Enter: 즉시 재시작
      if (e.code === "Enter") restart();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") keysRef.current.left = false;
      if (e.code === "ArrowRight") keysRef.current.right = false;
      if (e.code === "Space") keysRef.current.jump = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const s = stateRef.current;

    canvas.width = Math.floor(s.w * dpr);
    canvas.height = Math.floor(s.h * dpr);
    canvas.style.width = `${s.w}px`;
    canvas.style.height = `${s.h}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    init();
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpr]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Dodge Jump</h1>
            <p className="mt-1 text-white/60 text-sm">
              ← → 이동 / Space 더블점프 / Shift 대시(무적) / Enter 시작
            </p>
          </div>

          <div className="flex gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/60">Score</div>
              <div className="text-lg font-bold">{scoreUI}s</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/60">Best</div>
              <div className="text-lg font-bold">{bestUI}s</div>
            </div>
          </div>
        </div>

        <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-2xl">
          <canvas
            ref={canvasRef}
            className="w-full max-w-full rounded-2xl border border-white/10 bg-black/20"
          />

          {isGameOver && (
            <div className="absolute inset-0 rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" />
              <div className="relative h-full w-full flex items-center justify-center p-6">
                <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/8 backdrop-blur-xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/70">Game Over</div>
                      <div className="text-2xl font-extrabold mt-1 tracking-tight">
                        {scoreUI}s 생존
                      </div>
                    </div>
                    <Link
                      href="/"
                      className="text-sm text-white/70 hover:text-white transition underline underline-offset-4"
                    >
                      홈
                    </Link>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs text-white/60">Score</div>
                      <div className="text-3xl font-extrabold mt-1">{scoreUI}s</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs text-white/60">Best</div>
                      <div className="text-3xl font-extrabold mt-1">{bestUI}s</div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      onClick={restart}
                      className="px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-white/90 transition"
                    >
                      Enter로 재시작
                    </button>
                    <div className="text-xs text-white/60">
                      대시: 0.12s / 무적 0.08s / 쿨 0.75s
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-white/55 text-sm">
                    광고 문의 (010-3992-6664) 
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-white/50 leading-relaxed">
         {/* 구글 애드센스 영역 */}
        </div>
      </div>
    </main>
  );
}
