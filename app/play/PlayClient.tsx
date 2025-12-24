// app/play/PlayClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Keys = { left: boolean; right: boolean; jump: boolean };

const BEST_KEY = "dodge_jump_best_v5";

/* ================= utils ================= */
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

/* ================= ball types ================= */
type BallTypeId = "tiny_fast" | "big_slow" | "bouncer" | "dropper" | "sniper";

type BallType = {
  id: BallTypeId;
  rMin: number;
  rMax: number;
  color: string;
  glow: string;
  trail: string;
  trailLen: number;

  restMin: number;
  restMax: number;
  fricMin: number;
  fricMax: number;
  dragMin: number;
  dragMax: number;
  gMin: number;
  gMax: number;

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
    restMin: 0.9,
    restMax: 0.97,
    fricMin: 0.01,
    fricMax: 0.05,
    dragMin: 0.001,
    dragMax: 0.003,
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
    restMin: 0.8,
    restMax: 0.9,
    fricMin: 0.01,
    fricMax: 0.05,
    dragMin: 0.0009,
    dragMax: 0.0026,
    gMin: 1500,
    gMax: 2200,
    vxScale: 1.6,
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

/* ================= base config (scaled) ================= */
const BASE = {
  w: 900,
  h: 520,
  groundY: 420,

  pw: 34,
  ph: 48,

  // player physics (base)
  accel: 3000,
  friction: 2300,
  maxSpeed: 390,

  jump1: -640,
  jump2: -560,

  gravity: 2100,

  dashSpeed: 980,
  dashActive: 0.12,
  dashInvuln: 0.08,
  dashCooldown: 0.75,
};

export default function PlayClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const keysRef = useRef<Keys>({ left: false, right: false, jump: false });

  const [isGameOver, setIsGameOver] = useState(false);
  const [scoreUI, setScoreUI] = useState(0);
  const [bestUI, setBestUI] = useState(0);

  // 모바일(포인터 coarse) 감지
  const [isMobile, setIsMobile] = useState(false);

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

  // “현재 화면 스케일”(BASE 대비)
  const scaleRef = useRef(1);

  const stateRef = useRef({
    startedAt: 0,
    lastT: 0,

    w: BASE.w,
    h: BASE.h,
    groundY: BASE.groundY,

    px: BASE.w / 2,
    py: BASE.groundY,
    pw: BASE.pw,
    ph: BASE.ph,
    vx: 0,
    vy: 0,
    onGround: true,
    jumpCount: 0,

    balls: [] as Ball[],
  });

  /* ================= responsive sizing =================
     - stage 영역 폭에 맞춰 w/h를 계산
     - scale이 바뀌면 위치/속도도 비율로 변환해서 체감 동일 유지
  ======================================================= */
  const applyResize = () => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const rect = stage.getBoundingClientRect();
    const maxW = 900;
    const minW = 320;

    // container 폭 기반
    const displayW = clamp(Math.floor(rect.width), minW, maxW);
    const aspect = BASE.h / BASE.w;
    const displayH = Math.floor(displayW * aspect);

    const newScale = displayW / BASE.w;
    const oldScale = scaleRef.current || 1;
    const ratio = newScale / oldScale;

    scaleRef.current = newScale;

    // state 스케일 적용(연속성 유지)
    const s = stateRef.current;
    s.w = displayW;
    s.h = displayH;
    s.groundY = Math.floor(BASE.groundY * newScale);

    // 플레이어 사이즈/위치/속도 스케일 변환
    s.pw = BASE.pw * newScale;
    s.ph = BASE.ph * newScale;

    s.px *= ratio;
    s.py *= ratio;
    s.vx *= ratio;
    s.vy *= ratio;

    // 공들도 스케일 변환
    for (const b of s.balls) {
      b.x *= ratio;
      b.y *= ratio;
      b.r *= ratio;
      b.vx *= ratio;
      b.vy *= ratio;
      // 중력도 길이 스케일에 맞춤 (가속은 px/s^2 이라 scale 적용)
      b.g *= ratio;

      for (const p of b.trailPts) {
        p.x *= ratio;
        p.y *= ratio;
      }
    }

    // canvas 실제 픽셀 크기 반영
    canvas.width = Math.floor(displayW * dpr);
    canvas.height = Math.floor(displayH * dpr);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 바닥 아래로 떨어진 경우 보정
    s.px = clamp(s.px, s.pw / 2, s.w - s.pw / 2);
    if (s.py > s.groundY) s.py = s.groundY;
  };

  /* ================= difficulty ================= */
  function difficultyT(scoreSec: number) {
    const raw = (scoreSec - 5) / 20;
    return smoothstep01(raw);
  }

  function currentParams(scoreSec: number) {
    const t = difficultyT(scoreSec);

    const base = Math.round(lerp(3, 8, t));
    const extra = Math.min(6, Math.floor(Math.max(0, scoreSec - 25) / 18));
    const targetBalls = clamp(base + extra, 3, 14);

    // wind/velocity/gravity도 scale 반영
    const sc = scaleRef.current || 1;

    const windA = (lerp(18, 130, t) + Math.min(60, extra * 10)) * sc;
    const baseSpeed = (lerp(240, 420, t) + Math.min(140, extra * 18)) * sc;

    const fillProb = lerp(0.02, 0.09, t) + Math.min(0.04, extra * 0.004);

    const gAdd = (lerp(0, 700, t) + Math.min(500, extra * 80)) * sc;

    return { t, targetBalls, windA, baseSpeed, fillProb, gAdd, extra };
  }

  const spawnBall = (scoreSec: number) => {
    const s = stateRef.current;
    const { t, baseSpeed, gAdd } = currentParams(scoreSec);
    const sc = scaleRef.current || 1;

    const type = pickBallType();
    const r = (type.rMin + Math.random() * (type.rMax - type.rMin)) * sc;
    const rest = type.restMin + Math.random() * (type.restMax - type.restMin);
    const fric = type.fricMin + Math.random() * (type.fricMax - type.fricMin);
    const drag = type.dragMin + Math.random() * (type.dragMax - type.dragMin);

    const preferDrop =
      type.id === "dropper" ? lerp(0.2, 0.62, t) : lerp(0.18, 0.38, t);
    const roll = Math.random();

    let x = 0,
      y = 0,
      vx = 0,
      vy = 0;
    let flowDir: -1 | 1 = 1;

    if (roll < preferDrop) {
      x = 70 * sc + Math.random() * (s.w - 140 * sc);
      y = -r - 50 * sc;

      flowDir = Math.random() < 0.5 ? -1 : 1;

      vx = flowDir * lerp(120, 240, t) * type.vxScale * sc;
      vy = lerp(80, 190, t) * type.vyScale * sc;
    } else {
      const fromLeft = Math.random() < 0.5;
      flowDir = fromLeft ? 1 : -1;

      x = fromLeft ? -r - 50 * sc : s.w + r + 50 * sc;

      const low =
        Math.random() < lerp(0.88, 0.75, t)
          ? Math.random() * (90 * sc)
          : 90 * sc + Math.random() * (80 * sc);
      y = s.groundY - r - low;

      vx =
        flowDir *
        (baseSpeed + Math.random() * lerp(140, 260, t) * sc) *
        type.vxScale;
      vy = (-60 + Math.random() * 120) * type.vyScale * 0.55 * sc;
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
      g:
        (type.gMin + Math.random() * (type.gMax - type.gMin)) * sc +
        gAdd,
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

    // 현재 스케일 기반 중앙 배치
    s.px = s.w / 2;
    s.py = s.groundY;
    s.vx = 0;
    s.vy = 0;
    s.onGround = true;
    s.jumpCount = 0;

    s.balls = [];

    scoreRef.current = 0;
    setScoreUI(0);

    dashRef.current.activeT = 0;
    dashRef.current.cooldownT = 0;
    dashRef.current.invulnT = 0;
    dashRef.current.dir = 1;
    dashRef.current.request = false;

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

  /* ================= rendering ================= */
  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    ctx.clearRect(0, 0, s.w, s.h);

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;

    const grid = 60 * (scaleRef.current || 1);
    for (let x = 0; x <= s.w; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s.h);
      ctx.stroke();
    }
    for (let y = 0; y <= s.h; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s.w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, s.groundY + 1);
    ctx.lineTo(s.w, s.groundY + 1);
    ctx.stroke();
  };

  const drawBall = (ctx: CanvasRenderingContext2D, b: Ball) => {
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

    if (!s.onGround) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      const dots = 2 - s.jumpCount;
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
      b.vx += b.flowDir * windA * dt;
      b.vy += b.g * dt;

      const damp = Math.exp(-b.drag * 60 * dt);
      b.vx *= damp;
      b.vy *= damp;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const fy = floorY - b.r;
      if (b.y > fy) {
        b.y = fy;
        if (b.vy > 0) b.vy = -b.vy * b.rest;
        b.vx *= 1 - b.fric;

        const minVx = 120 * (scaleRef.current || 1);
        if (Math.abs(b.vx) < minVx) b.vx = Math.sign(b.vx || b.flowDir) * minVx;
      }

      for (let i = 0; i < b.trailPts.length; i++) b.trailPts[i].a *= 0.92;
      b.trailPts.unshift({ x: b.x, y: b.y, a: 1 });
      if (b.trailPts.length > b.trailLen) b.trailPts.pop();
    }

    const margin = 260 * (scaleRef.current || 1);
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

    while (s.balls.length < targetBalls) {
      if (Math.random() < fillProb || s.balls.length < 3) spawnBall(scoreSec);
      else break;
    }
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

    const scoreSec = Math.floor((t - s.startedAt) / 1000);
    if (scoreSec !== scoreRef.current) {
      scoreRef.current = scoreSec;
      setScoreUI(scoreSec);
    }

    ensureBallCount(scoreSec);

    // dash timers
    dashRef.current.cooldownT = Math.max(0, dashRef.current.cooldownT - dt);
    dashRef.current.activeT = Math.max(0, dashRef.current.activeT - dt);
    dashRef.current.invulnT = Math.max(0, dashRef.current.invulnT - dt);

    const keys = keysRef.current;
    if (keys.left) dashRef.current.dir = -1;
    if (keys.right) dashRef.current.dir = 1;

    // dash trigger
    if (
      dashRef.current.request &&
      dashRef.current.cooldownT <= 0 &&
      dashRef.current.activeT <= 0
    ) {
      dashRef.current.request = false;
      dashRef.current.activeT = BASE.dashActive;
      dashRef.current.invulnT = BASE.dashInvuln;
      dashRef.current.cooldownT = BASE.dashCooldown;
    } else {
      dashRef.current.request = false;
    }

    const dashOn = dashRef.current.activeT > 0;
    const sc = scaleRef.current || 1;

    // player move constants scaled
    const accel = BASE.accel * sc;
    const friction = BASE.friction * sc;
    const maxSpeed = BASE.maxSpeed * sc;

    if (!dashOn) {
      if (keys.left) s.vx -= accel * dt;
      if (keys.right) s.vx += accel * dt;

      if (!keys.left && !keys.right) {
        if (s.vx > 0) s.vx = Math.max(0, s.vx - friction * dt);
        if (s.vx < 0) s.vx = Math.min(0, s.vx + friction * dt);
      }

      s.vx = clamp(s.vx, -maxSpeed, maxSpeed);
    } else {
      s.vx = dashRef.current.dir * BASE.dashSpeed * sc;
    }

    // jump (double)
    if (keys.jump) {
      if (s.onGround || s.jumpCount < 2) {
        s.vy = (s.jumpCount === 0 ? BASE.jump1 : BASE.jump2) * sc;
        s.jumpCount += 1;
        s.onGround = false;
        keysRef.current.jump = false;
      } else {
        keysRef.current.jump = false;
      }
    }

    // gravity
    s.vy += BASE.gravity * sc * dt;

    // integrate
    s.px += s.vx * dt;
    s.py += s.vy * dt;

    s.px = clamp(s.px, s.pw / 2, s.w - s.pw / 2);

    if (s.py >= s.groundY) {
      s.py = s.groundY;
      s.vy = 0;
      s.onGround = true;
      s.jumpCount = 0;
    }

    updateBalls(dt, scoreSec);

    if (dashRef.current.invulnT <= 0) {
      if (intersectsPlayer()) {
        drawBackground(ctx);
        for (const b of s.balls) drawBall(ctx, b);
        drawPlayer(ctx);
        gameOver(scoreSec);
        return;
      }
    }

    drawBackground(ctx);
    for (const b of s.balls) drawBall(ctx, b);
    drawPlayer(ctx);

    rafRef.current = requestAnimationFrame(step);
  };

  /* ================= mobile detection ================= */
  useEffect(() => {
    if (typeof window === "undefined") return;

    type MQLLegacy = MediaQueryList & {
      addListener?: (listener: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (e: MediaQueryListEvent) => void) => void;
    };

    const mq = window.matchMedia("(pointer: coarse)") as MQLLegacy;

    const apply = () => setIsMobile(Boolean(mq.matches));
    apply();

    const onChange = () => apply();

    // 최신 브라우저
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    }

    // 구형 Safari
    mq.addListener?.(onChange);
    return () => mq.removeListener?.(onChange);
  }, []);

  /* ================= keyboard controls (PC) ================= */
  useEffect(() => {
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

      if (e.code === "Space") keysRef.current.jump = true;

      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        dashRef.current.request = true;
      }

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

  /* ================= mount + resize observer ================= */
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    // 최초 사이즈 적용 후 init
    applyResize();
    init();
    rafRef.current = requestAnimationFrame(step);

    const ro = new ResizeObserver(() => {
      applyResize();
    });
    ro.observe(stage);

    const onRotate = () => applyResize();
    window.addEventListener("orientationchange", onRotate);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", onRotate);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpr]);

  /* ================= mobile one-hand input =================
     - 화면 터치: 좌/우 이동
     - 버튼: 점프/대시
     - 스크롤/줌 방지: touchAction none + preventDefault
  ========================================================== */
  const activeMoveRef = useRef<"left" | "right" | null>(null);

  const setMove = (dir: "left" | "right" | null) => {
    activeMoveRef.current = dir;
    keysRef.current.left = dir === "left";
    keysRef.current.right = dir === "right";
  };

  const handleMovePointerDown = (e: React.PointerEvent) => {
    if (!isMobile) return;
    if (isGameOver) {
      restart();
      return;
    }
    // 버튼 위 터치면 무시(버튼이 stopPropagation 할 거라 안전)
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    setMove(isLeft ? "left" : "right");
  };

  const handleMovePointerUp = () => {
    if (!isMobile) return;
    setMove(null);
  };

  const tapJump = () => {
    if (isGameOver) {
      restart();
      return;
    }
    keysRef.current.jump = true;
    // 다음 프레임에 해제(연속 터치에도 안정)
    setTimeout(() => (keysRef.current.jump = false), 40);
  };

  const tapDash = () => {
    if (isGameOver) {
      restart();
      return;
    }
    dashRef.current.request = true;
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-3 sm:space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Dodge Jump</h1>
            <p className="mt-1 text-white/60 text-sm">
              {isMobile
                ? "화면 좌/우 터치로 이동 · 점프/대시는 버튼 · 게임오버 화면 탭=재시작"
                : "← → 이동 / Space 더블점프 / Shift 대시(무적) / Enter 재시작"}
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

        <div
          className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-3 sm:p-4 shadow-2xl"
          style={{ touchAction: "none" }}
        >
          {/* stage: 반응형 사이징 기준 */}
          <div
            ref={stageRef}
            className="relative mx-auto w-full"
            style={{
              // 너무 길게 늘어지는 것 방지
              maxWidth: 900,
            }}
          >
            <canvas
              ref={canvasRef}
              className="block w-full rounded-2xl border border-white/10 bg-black/20"
              style={{ touchAction: "none" }}
            />

            {/* 모바일 이동 터치 레이어(캔버스 위 투명) */}
            {isMobile && !isGameOver && (
              <div
                className="absolute inset-0 rounded-2xl"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleMovePointerDown(e);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  handleMovePointerUp();
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  handleMovePointerUp();
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  handleMovePointerUp();
                }}
              />
            )}

            {/* 모바일 버튼(한손 모드) */}
            {isMobile && (
              <div className="absolute bottom-3 right-3 flex flex-col gap-2">
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tapJump();
                  }}
                  className="select-none rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-5 py-4 text-sm font-semibold text-white active:scale-[0.98]"
                  style={{ minWidth: 92, touchAction: "none" }}
                >
                  JUMP
                </button>
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    tapDash();
                  }}
                  className="select-none rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-5 py-4 text-sm font-semibold text-white active:scale-[0.98]"
                  style={{ minWidth: 92, touchAction: "none" }}
                >
                  DASH
                </button>
              </div>
            )}

            {/* GameOver 오버레이 */}
            {isGameOver && (
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  if (!isMobile) return;
                  e.preventDefault();
                  restart();
                }}
              >
                <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" />
                <div className="relative h-full w-full flex items-center justify-center p-4 sm:p-6">
                  <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/8 backdrop-blur-xl p-5 sm:p-6 shadow-2xl">
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

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/60">Score</div>
                        <div className="text-3xl font-extrabold mt-1">{scoreUI}s</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs text-white/60">Best</div>
                        <div className="text-3xl font-extrabold mt-1">{bestUI}s</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                      <button
                        onClick={restart}
                        className="px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:bg-white/90 transition"
                      >
                        {isMobile ? "탭해서 재시작" : "Enter로 재시작"}
                      </button>
                      <div className="text-xs text-white/60">
                        대시: {BASE.dashActive}s / 무적 {BASE.dashInvuln}s / 쿨 {BASE.dashCooldown}s
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-white/55 text-sm">
                      광고 문의 (010-3992-6664)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-white/50 leading-relaxed">
          {/* 구글 애드센스 영역 */}
        </div>
      </div>
    </main>
  );
}
