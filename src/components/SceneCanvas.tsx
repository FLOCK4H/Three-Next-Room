"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import * as THREE from "three";
import Room from "./Room";
import CanvasLoaderOverlay from "./ui/CanvasLoaderOverlay";
import InteractiveScreens from "./interactive/screens";
import { RectAreaLightUniformsLib } from "three-stdlib";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/app/common/shared";
import CenterNotifee from "./ui/CenterNotifee";
type ViewMode = "preview" | "render";

function PreviewLighting() {
  // Blender's Material Preview is just IBL with studio HDRI; this is close enough
  return <Environment preset="city" environmentIntensity={1} />;
}

function RenderLighting() {
  useEffect(() => {
    RectAreaLightUniformsLib.init();
  }, []);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const area2 = useRef<THREE.RectAreaLight>(null);
  const area3 = useRef<THREE.RectAreaLight>(null);

  useEffect(() => {
    // Aim lights into the room
    const target = new THREE.Vector3(7.0, -5.2, 2.4);
    area2.current?.lookAt(target);
    area3.current?.lookAt(new THREE.Vector3(target.x - 5.0, target.y - 2.0, target.z - 1.0));

    if (dirRef.current) {
      dirRef.current.target.position.copy(target);
      dirRef.current.target.updateMatrixWorld();
    }
  }, []);

  return (
    <>
      <ambientLight intensity={0.2} />

      {/* Directional Light casts shadows */}
      <directionalLight
        ref={dirRef}
        castShadow
        position={[5.0, 4, 3]}
        intensity={1.2}
        color="#ffffff"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      <rectAreaLight
        ref={area2}
        position={[-3.0, 5.496, 3.96]}
        width={1.5}
        height={1.0}
        intensity={150}
        color="#ffeedd"
      />
      <rectAreaLight
        ref={area3}
        position={[-5.0, 10.096, 1.96]}
        width={1.5}
        height={1.0}
        intensity={75}
        color="#ffeedd"
      />

    </>
  );
}

export default function SceneCanvas() {
  const [mode, setMode] = useState<ViewMode>("preview");
  const [accepted, setAccepted] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.target.copy(new THREE.Vector3().fromArray(DEFAULT_CAMERA_TARGET));
    c.update();
    c.saveState?.();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100dvh", background: "transparent" }}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{
          alpha: true,
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
        dpr={[1, 1.75]}
        camera={{ fov: 50 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          {mode === "preview" ? <PreviewLighting key="preview" /> : <RenderLighting key="render" />}
          <Room />
          <InteractiveScreens />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={accepted}    // locked until Accept
          enableDamping
          enablePan={false}
          minPolarAngle={0.85}
          maxPolarAngle={1.3}
          minAzimuthAngle={-2.1}
          maxAzimuthAngle={1.0}
          minDistance={0.8}
          maxDistance={4.0}
        />
      </Canvas>

      {/* Top-right toggle */}
      <div style={toggleWrap}>
        <button onClick={() => setMode("preview")} style={{ ...toggleBtn, ...(mode === "preview" ? activeBtn : {}) }}>
          Material
        </button>
        <button onClick={() => setMode("render")} style={{ ...toggleBtn, ...(mode === "render" ? activeBtn : {}) }}>
          Render
        </button>
      </div>

      {/* Centered, medium-sized, doesn’t drift */}
      <CenterNotifee hidden={accepted} onAccept={() => setAccepted(true)} />

      <CanvasLoaderOverlay />
    </div>
  );
}

const toggleWrap: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  display: "flex",
  gap: 8,
  zIndex: 10,
};

const toggleBtn: React.CSSProperties = {
  appearance: "none",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,.2)",
  background: "rgba(0,0,0,.4)",
  color: "white",
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 12,
  cursor: "pointer",
  backdropFilter: "blur(6px)",
  userSelect: "none",
};

const activeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,.2)",
  borderColor: "rgba(255,255,255,.45)",
};