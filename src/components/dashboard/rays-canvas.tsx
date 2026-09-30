"use client";

/**
 * "Rays" — generative artwork for the hero.
 *
 * The school crest is a lantern with light radiating from it. Here each
 * repair ticket becomes one ray of that light: length follows urgency, colour
 * follows status (open work glows gold, emergencies burn amber with a bead at
 * the tip, finished work dims). Around them a seeded field of fine blue rays
 * breathes slowly. The seed comes from the ticket ids, so the same data always
 * draws the same picture.
 */
import { useEffect, useRef } from "react";

import type { RepairTicket } from "@/types/database";

type Ray = Pick<RepairTicket, "id" | "urgency" | "status">;

const LENGTH: Record<Ray["urgency"], number> = { low: 0.56, medium: 0.68, high: 0.82, emergency: 0.97 };
const AMBIENT = 40;
/** The rays breathe slowly, so ~20 frames a second looks the same as 60 and costs a third. */
const FRAME_MS = 50;
const GOLDEN_ANGLE = 2.399963229728653;

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spoke {
  angle: number;
  length: number; // fraction of radius
  phase: number;
  width: number;
  kind: "ambient" | Ray["status"];
  emergency: boolean;
}

function buildSpokes(rays: Ray[]): Spoke[] {
  const rng = mulberry32(hash(rays.map((r) => r.id).join("|")) || 1);
  const spokes: Spoke[] = [];

  for (let i = 0; i < AMBIENT; i++) {
    const angle = (i / AMBIENT) * Math.PI * 2 + (rng() - 0.5) * 0.05;
    // Rays reach further upward, like the lantern's beams.
    const upward = (1 - Math.sin(angle)) / 2; // 1 at top (angle = -90°), 0 at bottom
    spokes.push({
      angle,
      length: 0.5 + 0.34 * rng() + 0.14 * upward,
      phase: rng() * Math.PI * 2,
      width: 0.6 + rng() * 0.9,
      kind: "ambient",
      emergency: false,
    });
  }

  rays.forEach((r, i) => {
    const done = r.status === "completed";
    spokes.push({
      angle: i * GOLDEN_ANGLE + rng() * 0.35,
      length: LENGTH[r.urgency] * (done ? 0.6 : 1),
      phase: rng() * Math.PI * 2,
      width: r.urgency === "emergency" ? 3 : 2,
      kind: r.status,
      emergency: r.urgency === "emergency" && !done,
    });
  });
  return spokes;
}

export function RaysCanvas({ tickets, className }: { tickets: Ray[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const spokes = buildSpokes(tickets);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;

    const palette = () => {
      const dark = document.documentElement.classList.contains("dark");
      return dark
        ? { ambient: "140,160,255", gold: "242,176,74", amber: "255,138,31", done: "170,190,255" }
        : { ambient: "43,59,184", gold: "196,122,0", amber: "214,90,0", done: "43,59,184" };
    };

    function draw(t: number) {
      if (!ctx || !width || !height) return;
      const p = palette();
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) / 2;
      const r0 = R * 0.16;
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";

      for (const s of spokes) {
        const breathe = reduced.matches ? 1 : 1 + 0.035 * Math.sin(t * 0.0006 + s.phase);
        const r1 = R * s.length * breathe;
        const x0 = cx + Math.cos(s.angle) * r0;
        const y0 = cy + Math.sin(s.angle) * r0;
        const x1 = cx + Math.cos(s.angle) * r1;
        const y1 = cy + Math.sin(s.angle) * r1;

        let rgb = p.ambient;
        let alpha = 0.32;
        if (s.kind === "pending" || s.kind === "in_progress") {
          rgb = s.emergency ? p.amber : p.gold;
          alpha = s.kind === "in_progress" ? 0.75 : 0.95;
        } else if (s.kind === "completed" || s.kind === "cancelled") {
          rgb = p.done;
          alpha = 0.5;
        }

        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(0.25, `rgba(${rgb},${alpha})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        if (s.emergency) {
          const bx = cx + Math.cos(s.angle) * r1 * 0.9;
          const by = cy + Math.sin(s.angle) * r1 * 0.9;
          ctx.fillStyle = `rgba(${p.amber},0.95)`;
          ctx.beginPath();
          ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    let last = 0;
    function loop(t: number) {
      if (t - last >= FRAME_MS) {
        last = t;
        draw(t);
      }
      frame = visible && !reduced.matches ? requestAnimationFrame(loop) : 0;
    }
    const start = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
      if (visible && !reduced.matches) start();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let onScreen = true;
    const sync = () => {
      visible = onScreen && !document.hidden;
      if (visible) start();
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e?.isIntersecting ?? true;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    const theme = new MutationObserver(() => draw(performance.now()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const onMotion = () => {
      draw(performance.now());
      if (!reduced.matches) start();
    };
    reduced.addEventListener("change", onMotion);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      theme.disconnect();
      reduced.removeEventListener("change", onMotion);
    };
  }, [tickets]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
