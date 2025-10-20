"use client";

import { useProgress } from "@react-three/drei";
import Spinner from "./Spinner";

export default function CanvasLoaderOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return <Spinner label={`Loading ${Math.round(progress)}%`} />;
}