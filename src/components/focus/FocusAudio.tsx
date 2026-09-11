import { useRouterState } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Pause } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { FOCUS_TRACKS } from "./tracks";

type FocusAudioState = {
  activeId: string | null;
  playing: boolean;
  volume: number;
  activeTitle: string | null;
  activeHue: number;
  analyserRef: { current: AnalyserNode | null };
  toggle: (id: string) => void;
  stop: () => void;
  setVolume: (v: number) => void;
};

const FocusAudioCtx = createContext<FocusAudioState | null>(null);

export function useFocusAudio() {
  const ctx = useContext(FocusAudioCtx);
  if (!ctx) throw new Error("useFocusAudio must be used inside <FocusAudioProvider>");
  return ctx;
}

export function FocusAudioProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nodesRef = useRef<AudioScheduledSourceNode[]>([]);
  const timersRef = useRef<number[]>([]);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const stop = useCallback(() => {
    timersRef.current.forEach((t) => window.clearInterval(t));
    timersRef.current = [];
    nodesRef.current.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect();
      } catch {
        /* noop */
      }
    });
    nodesRef.current = [];
    if (masterRef.current) {
      try {
        masterRef.current.disconnect();
      } catch {
        /* noop */
      }
      masterRef.current = null;
    }
    analyserRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(volume * 0.4, ctxRef.current.currentTime, 0.1);
    }
  }, [volume]);

  const startTrack = useCallback(
    (id: string) => {
      if (typeof window === "undefined") return;
      stop();
      const Ctx = window.AudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;

      const master = ctx.createGain();
      master.gain.value = volumeRef.current * 0.4;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      master.connect(analyser);
      analyser.connect(ctx.destination);
      masterRef.current = master;
      analyserRef.current = analyser;

      const nodes: AudioScheduledSourceNode[] = [];
      const every = (ms: number, fn: () => void) => {
        const t = window.setInterval(fn, ms);
        timersRef.current.push(t);
      };
      const noiseBuffer = () => {
        const len = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
      };
      const osc = (freq: number, type: OscillatorType, gain: number, detune = 0) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = gain;
        o.connect(g);
        g.connect(master);
        o.start();
        nodes.push(o);
        return o;
      };
      const noise = (filterType: BiquadFilterType, freq: number, gain: number, q = 0.8) => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer();
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = freq;
        filter.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start();
        nodes.push(src);
        return { src, filter, g };
      };
      const plink = (freq: number, dur = 0.6, gain = 0.08, type: OscillatorType = "sine") => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + dur + 0.05);
      };

      if (id === "drone") {
        osc(55, "sine", 0.5);
        osc(82.5, "sine", 0.3);
        osc(110, "triangle", 0.12, 4);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lg = ctx.createGain();
        lg.gain.value = 0.15;
        lfo.connect(lg);
        lg.connect(master.gain);
        lfo.start();
        nodes.push(lfo);
      } else if (id === "pulse") {
        osc(174, "sine", 0.4);
        osc(261, "sine", 0.2);
        osc(348, "triangle", 0.08);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1;
        const lg = ctx.createGain();
        lg.gain.value = 0.18;
        lfo.connect(lg);
        lg.connect(master.gain);
        lfo.start();
        nodes.push(lfo);
      } else if (id === "wash") {
        const { filter } = noise("lowpass", 800, 0.12);
        osc(523.25, "sine", 0.06);
        osc(784, "sine", 0.04, 5);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.12;
        const lg = ctx.createGain();
        lg.gain.value = 300;
        lfo.connect(lg);
        lg.connect(filter.frequency);
        lfo.start();
        nodes.push(lfo);
      } else if (id === "night-rain") {
        osc(55, "sine", 0.22);
        osc(110, "sine", 0.08);
        noise("bandpass", 2400, 0.14, 0.5);
        noise("highpass", 5000, 0.03);
        every(900, () => {
          plink(1400 + Math.random() * 1800, 0.4 + Math.random() * 0.5, 0.03 + Math.random() * 0.04);
        });
      } else if (id === "lofi-hearth") {
        noise("highpass", 5000, 0.015);
        noise("lowpass", 300, 0.1);
        const chords = [
          [110, 130.81, 164.81],
          [87.31, 110, 130.81],
          [98, 123.47, 146.83],
          [82.41, 103.83, 123.47],
        ];
        let ci = 0;
        const voices: OscillatorNode[] = [];
        const gains: GainNode[] = [];
        chords[0]!.forEach((f) => {
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.value = 0.12;
          o.connect(g);
          g.connect(master);
          o.start();
          voices.push(o);
          gains.push(g);
        });
        nodes.push(...voices);
        every(4000, () => {
          ci = (ci + 1) % chords.length;
          const chord = chords[ci]!;
          voices.forEach((v, i) => {
            v.frequency.setTargetAtTime(chord[i]!, ctx.currentTime, 0.8);
          });
        });
        every(500, () => {
          if (Math.random() < 0.4) plink(3000 + Math.random() * 3000, 0.05, 0.012, "square");
        });
      } else {
        // forest-dawn
        noise("lowpass", 600, 0.07);
        osc(220, "sine", 0.1);
        osc(277.18, "sine", 0.07);
        osc(329.63, "sine", 0.05);
        every(2600, () => {
          const base = 2200 + Math.random() * 1400;
          const o = ctx.createOscillator();
          o.type = "sine";
          const t = ctx.currentTime;
          o.frequency.setValueAtTime(base, t);
          o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.15);
          o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.35);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.06, t + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          o.connect(g);
          g.connect(master);
          o.start(t);
          o.stop(t + 0.6);
        });
      }

      nodesRef.current = nodes;
      setActiveId(id);
      setPlaying(true);
    },
    [stop],
  );

  const toggle = useCallback(
    (id: string) => {
      if (activeId === id && playing) {
        stop();
        setActiveId(null);
      } else {
        startTrack(id);
      }
    },
    [activeId, playing, startTrack, stop],
  );

  const setVolume = useCallback((v: number) => setVolumeState(v), []);

  const active = FOCUS_TRACKS.find((t) => t.id === activeId) ?? null;

  const value = useMemo<FocusAudioState>(
    () => ({
      activeId,
      playing,
      volume,
      activeTitle: active?.title ?? null,
      activeHue: active?.hue ?? 185,
      analyserRef,
      toggle,
      stop,
      setVolume,
    }),
    [activeId, playing, volume, active, toggle, stop, setVolume],
  );

  return (
    <FocusAudioCtx.Provider value={value}>
      {children}
      <FocusMiniBall />
    </FocusAudioCtx.Provider>
  );
}

/** Floating ball pinned to the top on every page except /focus-music while audio plays. */
function FocusMiniBall() {
  const { activeId, playing, activeTitle, activeHue, toggle, stop } = useFocusAudio();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!playing || !activeId || pathname === "/focus-music") return null;

  return (
    <div className="fixed right-5 top-16 z-50">
      <div className="panel flex items-center gap-3 py-2 pl-2 pr-3">
        <Link
          to="/focus-music"
          aria-label="Open focus music"
          className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, oklch(0.95 0.02 85), oklch(0.7 0.16 ${activeHue}) 55%, oklch(0.45 0.12 ${activeHue}) 100%)`,
            boxShadow: `0 0 18px oklch(0.7 0.16 ${activeHue} / 0.55)`,
          }}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          <span className="font-display text-sm text-white">♪</span>
        </Link>
        <div className="min-w-0">
          <p className="label-mono">Now focusing</p>
          <Link to="/focus-music" className="block max-w-[140px] truncate text-sm font-medium hover:text-primary">
            {activeTitle}
          </Link>
        </div>
        <button
          onClick={() => toggle(activeId)}
          aria-label="Pause focus music"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pause className="h-4 w-4" />
        </button>
        <button
          onClick={stop}
          aria-label="Stop focus music"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
