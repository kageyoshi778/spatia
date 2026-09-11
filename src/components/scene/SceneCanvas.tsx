import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

import { CathedralModel } from "./CathedralModel";
import { BinaryTreeModel, DnaModel, LatticeModel, WaveModel } from "./ConceptModels";
import { GltfModel } from "./GltfModel";
import { Hotspot3D } from "./Hotspot3D";
import { MoleculeModel } from "./MoleculeModel";
import { GearboxModel, SolarSystemModel, TectonicModel } from "./ScienceModels";
import type { SceneModule } from "@/lib/scenes";

export type Viewpoint = {
  position: [number, number, number];
  distance: number;
  azimuth: number;
  polar: number;
};

type Controls = React.ComponentRef<typeof OrbitControls>;

/** Dev aid: `?cam=x,y,z` overrides the starting camera so hotspots can be placed from set views. */
function debugCamera(): [number, number, number] | null {
  if (typeof window === "undefined" || !import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get("cam");
  const v = raw?.split(",").map(Number) ?? [];
  return v.length === 3 && v.every(Number.isFinite) ? (v as [number, number, number]) : null;
}

function ViewpointTracker({ onChange }: { onChange: (v: Viewpoint) => void }) {
  const camera = useThree((s) => s.camera);
  const last = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const p = camera.position;
      const distance = p.length();
      const azimuth = Math.atan2(p.x, p.z);
      const polar = Math.acos(Math.min(1, Math.max(-1, p.y / (distance || 1))));
      const stamp = Math.round(distance * 10) + Math.round(azimuth * 20) * 1000;
      if (stamp === last.current) return;
      last.current = stamp;
      onChange({
        position: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        distance: +distance.toFixed(2),
        azimuth,
        polar,
      });
    }, 320);
    return () => clearInterval(id);
  }, [camera, onChange]);

  return null;
}

type Flight = {
  t: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
};

const FLIGHT_SECONDS = 0.9;

/**
 * Smoothly re-frames the camera on the selected hotspot. Keeps the student's current
 * viewing direction so the move reads as "lean in", not "teleport". Any drag or scroll
 * cancels the flight immediately so the user is always in control.
 */
function CameraRig({
  controls,
  focus,
  approach,
  sceneScale,
}: {
  controls: RefObject<Controls | null>;
  focus: [number, number, number] | null;
  /** Optional direction to view the focus from (tour stops); otherwise keep the current angle. */
  approach: [number, number, number] | null;
  sceneScale: number;
}) {
  const camera = useThree((s) => s.camera);
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => {
      flight.current = null;
    };
    c.addEventListener("start", cancel);
    return () => c.removeEventListener("start", cancel);
  }, [controls]);

  const focusKey = focus ? `${focus.join(",")}|${approach?.join(",") ?? ""}` : null;
  useEffect(() => {
    const c = controls.current;
    if (!focus || !c) return;
    const toTarget = new THREE.Vector3(...focus);
    const dir = approach ? new THREE.Vector3(...approach) : camera.position.clone().sub(c.target);
    if (dir.lengthSq() < 1e-6) dir.set(0.4, 0.35, 1);
    dir.normalize();
    // Frame the neighbourhood, not the surface: far enough out that adjacent structures stay in view.
    const distance = Math.max(4, sceneScale * 0.7);
    flight.current = {
      t: 0,
      fromPos: camera.position.clone(),
      toPos: toTarget.clone().add(dir.multiplyScalar(distance)),
      fromTarget: c.target.clone(),
      toTarget,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useFrame((_, dt) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + dt / FLIGHT_SECONDS);
    const k = 1 - Math.pow(1 - f.t, 3);
    camera.position.lerpVectors(f.fromPos, f.toPos, k);
    c.target.lerpVectors(f.fromTarget, f.toTarget, k);
    c.update();
    if (f.t >= 1) flight.current = null;
  });

  return null;
}

function SceneBody({ scene, options }: { scene: SceneModule; options: Record<string, boolean> }) {
  if (scene.id === "cardiac")
    return <GltfModel url="/models/heart/heart.gltf" fit={5} pulse={options["pulse"] ?? true} />;
  if (scene.id === "caffeine")
    return <MoleculeModel showHydrogens={options["hydrogens"] ?? true} />;
  if (scene.id === "cathedral") return <CathedralModel showVault={options["vault"] ?? true} />;
  if (scene.id === "solar-system") return <SolarSystemModel />;
  if (scene.id === "tectonics") return <TectonicModel />;
  if (scene.id === "binary-tree") return <BinaryTreeModel />;
  if (scene.id === "dna") return <DnaModel unwind={options["unwind"] ?? false} />;
  if (scene.id === "wave-interference")
    return <WaveModel twoSources={options["twoSources"] ?? true} />;
  if (scene.id === "lattice") return <LatticeModel showBonds={options["bonds"] ?? true} />;
  return <GearboxModel />;
}

type Props = {
  scene: SceneModule;
  activeHotspot: string | null;
  onSelectHotspot: (id: string) => void;
  onViewpoint: (v: Viewpoint) => void;
  options: Record<string, boolean>;
  autoRotate: boolean;
  approach?: [number, number, number] | null;
};

export function SceneCanvas({
  scene,
  activeHotspot,
  onSelectHotspot,
  onViewpoint,
  options,
  autoRotate,
  approach = null,
}: Props) {
  const controls = useRef<Controls>(null);
  const active = scene.hotspots.find((h) => h.id === activeHotspot) ?? null;
  const sceneScale = new THREE.Vector3(...scene.camera.position).distanceTo(
    new THREE.Vector3(...scene.camera.target),
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: debugCamera() ?? scene.camera.position, fov: 45 }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelectHotspot("")}
    >
      <color attach="background" args={["#031634"]} />

      <fog attach="fog" args={["#031634", 26, 70]} />
      <hemisphereLight args={["#bcd7ff", "#2a2f3d", 0.55]} />
      <directionalLight
        position={[8, 14, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-9, 5, -6]} intensity={0.6} color="#8fd8ff" />
      <pointLight position={[0, 3, 6]} intensity={18} distance={22} color="#ffd8a8" />

      <Suspense fallback={null}>
        <Environment resolution={128}>
          <Lightformer intensity={2.4} position={[0, 6, 0]} scale={[12, 12, 1]} />
          <Lightformer
            intensity={1.1}
            color="#8fc4ff"
            position={[-6, 2, -2]}
            rotation-y={Math.PI / 2}
            scale={[20, 2, 1]}
          />
          <Lightformer
            intensity={0.9}
            color="#ffc07a"
            position={[6, 1, 2]}
            rotation-y={-Math.PI / 2}
            scale={[20, 2, 1]}
          />
        </Environment>

        <SceneBody scene={scene} options={options} />

        {scene.hotspots.map((h, i) => (
          <Hotspot3D
            key={h.id}
            hotspot={h}
            index={i}
            active={activeHotspot === h.id}
            dimmed={activeHotspot !== null && activeHotspot !== h.id}
            onSelect={onSelectHotspot}
          />
        ))}
      </Suspense>

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={2.5}
        maxDistance={30}
        target={scene.camera.target}
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
      />
      <CameraRig
        controls={controls}
        focus={active?.position ?? null}
        approach={approach}
        sceneScale={sceneScale}
      />
      <ViewpointTracker onChange={onViewpoint} />
    </Canvas>
  );
}
