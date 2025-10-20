"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";

export default function Room() {
  const { scene } = useGLTF("/models/floroom.glb");

  useMemo(() => {
    scene.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={1} />;
}

useGLTF.preload("/models/floroom.glb");