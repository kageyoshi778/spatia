import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type * as THREE from "three";

import type { Hotspot } from "@/lib/scenes";

type Props = {
  hotspot: Hotspot;
  active: boolean;
  /** True when some other hotspot is selected — this one steps back visually. */
  dimmed: boolean;
  index: number;
  onSelect: (id: string) => void;
};

export function Hotspot3D({ hotspot, active, dimmed, index, onSelect }: Props) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const number = String(index + 1).padStart(2, "0");
  const showName = active || hovered;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const s = active ? 1.25 + Math.sin(t * 3) * 0.08 : hovered ? 1.15 : 1;
    ref.current.scale.setScalar(s);
  });

  return (
    <group position={hotspot.position}>
      <group
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(hotspot.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <mesh>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshBasicMaterial
            color={active ? "#0e8b86" : "#e8ddcb"}
            transparent
            opacity={dimmed && !hovered ? 0.65 : 1}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.3, 20, 20]} />
          <meshBasicMaterial
            color={active ? "#0e8b86" : "#e8ddcb"}
            transparent
            opacity={hovered || active ? 0.32 : dimmed ? 0.1 : 0.14}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Number badge always; full name only when hovered or selected, so labels never pile up. */}
      <Html center style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
        <div
          className={`whitespace-nowrap rounded-full border font-mono tracking-widest uppercase transition-all duration-200 ${
            showName ? "px-2.5 py-1 text-[10px]" : "px-1.5 py-0.5 text-[9px]"
          } ${
            active
              ? "border-primary bg-background text-primary opacity-100"
              : hovered
                ? "border-border bg-background text-foreground opacity-100"
                : dimmed
                  ? "border-ink-foreground/20 bg-ink/70 text-ink-foreground/70 opacity-65"
                  : "border-ink-foreground/25 bg-ink/70 text-ink-foreground/85 opacity-90"
          }`}
          style={{ transform: showName ? "translateY(-2.2rem)" : "translateY(-1.7rem)" }}
        >
          {showName ? `${number} · ${hotspot.name}` : number}
        </div>
      </Html>
    </group>
  );
}
