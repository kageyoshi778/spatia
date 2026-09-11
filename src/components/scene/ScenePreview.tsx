import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

import { GltfModel } from "./GltfModel";

/** A quiet, auto-rotating preview of the heart for the home page. No markers, no UI. */
export function ScenePreview() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [3.6, 1.4, 5.2], fov: 38 }} gl={{ antialias: true }}>
      <color attach="background" args={["#031634"]} />
      <hemisphereLight args={["#e8e1d4", "#2a2f3d", 0.5]} />
      <directionalLight position={[6, 10, 6]} intensity={1.8} />
      <directionalLight position={[-8, 3, -5]} intensity={0.5} color="#c9d7ff" />
      <Suspense fallback={null}>
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer
            intensity={0.8}
            color="#ffd9b0"
            position={[5, 1, 2]}
            rotation-y={-Math.PI / 2}
            scale={[16, 2, 1]}
          />
        </Environment>
        <GltfModel url="/models/heart/heart.gltf" fit={4.6} pulse />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
        autoRotate
        autoRotateSpeed={0.9}
        target={[0, 0.1, 0]}
      />
    </Canvas>
  );
}
