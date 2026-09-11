import { useEffect, useRef } from "react";

import { useFocusAudio } from "./FocusAudio";

/** Large reactive ball: pulses/scales with the live analyser output. */
export function FocusOrb({ size = 320 }: { size?: number }) {
  const { analyserRef, playing, activeHue } = useFocusAudio();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ t: 0, level: 0 });

  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const buf = new Uint8Array(128);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = stateRef.current;
      s.t += 0.02;

      let target = 0;
      const analyser = analyserRef.current;
      if (analyser && playing) {
        analyser.getByteFrequencyData(buf as unknown as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 2; i < 40; i++) sum += buf[i] ?? 0;
        target = sum / (38 * 255);
      }
      s.level += (target - s.level) * 0.12;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const cx = w / 2;
      const cy = h / 2;
      const base = w * 0.24;
      const amp = playing ? s.level * w * 0.09 : Math.sin(s.t) * w * 0.008;

      // intense ambient color field — layered drifting washes behind the orb
      const halos = [
        { hueShift: 0, scale: 1.5, alpha: 0.5, dx: Math.cos(s.t * 0.4) * 10 * dpr, dy: Math.sin(s.t * 0.5) * 8 * dpr },
        { hueShift: 40, scale: 1.75, alpha: 0.36, dx: Math.cos(s.t * 0.3 + 2) * 18 * dpr, dy: Math.sin(s.t * 0.35 + 1) * 14 * dpr },
        { hueShift: -40, scale: 2.0, alpha: 0.28, dx: Math.cos(s.t * 0.25 + 4) * 24 * dpr, dy: Math.sin(s.t * 0.28 + 3) * 16 * dpr },
        { hueShift: 80, scale: 2.2, alpha: 0.18, dx: Math.cos(s.t * 0.2 + 1) * 30 * dpr, dy: Math.sin(s.t * 0.22 + 5) * 20 * dpr },
      ];
      for (const halo of halos) {
        const hr = base * halo.scale + s.level * 46 * dpr;
        const hx = cx + halo.dx;
        const hy = cy + halo.dy;
        const g = ctx.createRadialGradient(hx, hy, base * 0.2, hx, hy, hr);
        const hh = activeHue + halo.hueShift;
        const a = halo.alpha + s.level * 0.4;
        g.addColorStop(0, `oklch(0.68 0.2 ${hh} / ${a})`);
        g.addColorStop(0.55, `oklch(0.76 0.15 ${hh} / ${a * 0.55})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
      }

      // soft orbit bands — blurred ambient arcs instead of pointy ticks
      ctx.save();
      ctx.globalAlpha = playing ? 0.55 + s.level * 0.4 : 0.4;
      ctx.strokeStyle = `oklch(0.62 0.19 ${activeHue + 30})`;
      ctx.lineWidth = (10 + s.level * 22) * dpr;
      ctx.filter = `blur(${10 * dpr}px)`;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 1.3 + s.level * 26 * dpr, s.t * 0.2, s.t * 0.2 + Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = playing ? 0.45 + s.level * 0.35 : 0.32;
      ctx.strokeStyle = `oklch(0.68 0.16 ${activeHue - 40})`;
      ctx.lineWidth = (8 + s.level * 16) * dpr;
      ctx.filter = `blur(${12 * dpr}px)`;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 1.52 + s.level * 30 * dpr, -s.t * 0.15, -s.t * 0.15 + Math.PI * 1.1);
      ctx.stroke();
      ctx.restore();

      // wobbly blob
      ctx.beginPath();
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const wobble =
          Math.sin(a * 3 + s.t * 1.6) * (4 + s.level * 22) +
          Math.sin(a * 5 - s.t * 1.1) * (3 + s.level * 14);
        const r = base + amp + wobble * dpr;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const body = ctx.createRadialGradient(
        cx - base * 0.35,
        cy - base * 0.4,
        base * 0.1,
        cx,
        cy,
        base * 1.25,
      );
      body.addColorStop(0, "oklch(0.96 0.015 85)");
      body.addColorStop(0.45, `oklch(0.72 0.15 ${activeHue})`);
      body.addColorStop(1, `oklch(0.42 0.11 ${activeHue})`);
      ctx.fillStyle = body;
      ctx.fill();
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, playing, activeHue, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="mx-auto"
      aria-hidden
    />
  );
}
