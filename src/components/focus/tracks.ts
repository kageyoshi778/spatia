export type FocusTrack = {
  id: string;
  title: string;
  body: string;
  tag: string;
  /** hue used for the orb glow, keeps vermilion/teal family by default */
  hue: number;
};

export const FOCUS_TRACKS: FocusTrack[] = [
  {
    id: "drone",
    title: "Deep drone",
    body: "Low warm pad for reading-heavy modules. A root plus fifth, slowly breathing.",
    tag: "55 Hz base",
    hue: 32,
  },
  {
    id: "pulse",
    title: "Steady pulse",
    body: "Gentle rhythmic swell at a calm tempo. Good for flash-card drills.",
    tag: "Calm 60 BPM swell",
    hue: 205,
  },
  {
    id: "wash",
    title: "Airy wash",
    body: "Soft filtered air with a high shimmer. Made for long planner sessions.",
    tag: "Airy + shimmer",
    hue: 262,
  },
  {
    id: "night-rain",
    title: "Night rain",
    body: "Soft rainfall over a low room tone, with sparse droplet plinks. For late-night study.",
    tag: "Rain + room tone",
    hue: 215,
  },
  {
    id: "lofi-hearth",
    title: "Lo-fi hearth",
    body: "Warm cycling chords with a whisper of vinyl crackle. Steady without lyrics.",
    tag: "Chords + crackle",
    hue: 45,
  },
  {
    id: "forest-dawn",
    title: "Forest dawn",
    body: "Light air, soft pad and distant birdsong swells. For fresh morning sessions.",
    tag: "Air + birdsong",
    hue: 155,
  },
];
