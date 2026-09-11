export type FocusTrack = {
  id: string;
  title: string;
  body: string;
  tag: string;
  /** hue used for the orb glow, drawn from the cream / tan / teal / deep-sea family */
  hue: number;
};

export const FOCUS_TRACKS: FocusTrack[] = [
  {
    id: "drone",
    title: "Deep drone",
    body: "Low warm pad for reading-heavy modules. A root plus fifth, slowly breathing.",
    tag: "55 Hz base",
    hue: 85,
  },
  {
    id: "pulse",
    title: "Steady pulse",
    body: "Gentle rhythmic swell at a calm tempo. Good for flash-card drills.",
    tag: "Calm 60 BPM swell",
    hue: 185,
  },
  {
    id: "wash",
    title: "Airy wash",
    body: "Soft filtered air with a high shimmer. Made for long planner sessions.",
    tag: "Airy + shimmer",
    hue: 210,
  },
  {
    id: "night-rain",
    title: "Night rain",
    body: "Soft rainfall over a low room tone, with sparse droplet plinks. For late-night study.",
    tag: "Rain + room tone",
    hue: 235,
  },
  {
    id: "lofi-hearth",
    title: "Lo-fi hearth",
    body: "Warm cycling chords with a whisper of vinyl crackle. Steady without lyrics.",
    tag: "Chords + crackle",
    hue: 75,
  },
  {
    id: "forest-dawn",
    title: "Forest dawn",
    body: "Light air, soft pad and distant birdsong swells. For fresh morning sessions.",
    tag: "Air + birdsong",
    hue: 165,
  },
];
