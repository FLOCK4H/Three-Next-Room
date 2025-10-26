"use client";

import { Html, useCursor, useGLTF, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {HitPlane, Tweak} from "./HitPlane";
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from "@/app/common/shared";

type ScreenId = "left" | "right" | null;

const TWEAKS: Record<string, Tweak> = {
  ScreenLeft:  { inflate: 1.02, rollDeg: 0,   offset: [0, 0, 0.0015] },
  ScreenRight: { inflate: 1.02, rollDeg: 0,   offset: [0, 0, 0.0015] },
};

type FocusOpts = {
  distance?: number;                 // how far in front of target to stop (meters)
  offset?: [number, number, number]; // world-space offsets x,y,z
  duration?: number;                 // ms
};

type Props = {
  leftName?: string;
  rightName?: string;
  onFocus?: (active: ScreenId) => void;
};

function useControlsLock(controls: any | undefined) {
  const touches = useRef(0);
  const lock = () => { if (controls) controls.enabled = false; };
  const unlock = () => { if (controls) controls.enabled = true; };

  return {
    onPointerEnter: () => lock(),
    onPointerLeave: () => { touches.current = 0; unlock(); },
    onTouchStart: () => { touches.current += 1; lock(); },
    onTouchEnd: () => {
      touches.current = Math.max(0, touches.current - 1);
      if (touches.current === 0) unlock();
    },
    onTouchCancel: () => { touches.current = 0; unlock(); },
    onWheel: (e: any) => { e.stopPropagation(); },     // prevent wheel zoom from hitting controls
  };
}

export default function InteractiveScreens({
  leftName = "ScreenLeft",
  rightName = "ScreenRight",
  onFocus,
}: Props) {
  const { camera } = useThree();
  const controls = useThree(s => s.controls as any | undefined);
  const [active, setActive] = useState<ScreenId>(null);
  const [hovered, setHovered] = useState<ScreenId>(null);
  const xpTex = useTexture("/textures/xp.jpg");
  xpTex.colorSpace = THREE.SRGBColorSpace;
  xpTex.anisotropy = 4;
  
  const lockHandlers = useControlsLock(controls);



  useEffect(() => {
    console.log(camera.position.toArray());
  }, [camera]);

  useEffect(() => {
    if (active !== null) return;
  
    // cancel any in-flight focus anim
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  
    const c = controls;
  
    const startPos    = camera.position.clone();
    const startTarget = (c?.target?.clone())
      ?? startPos.clone().add(camera.getWorldDirection(new THREE.Vector3()));
  
    const endPos    = new THREE.Vector3().fromArray(DEFAULT_CAMERA_POSITION);
    const endTarget = new THREE.Vector3().fromArray(DEFAULT_CAMERA_TARGET);
  
    const t0 = performance.now();
    const dur = 500;
  
    const tick = (now: number) => {
      const t    = Math.min(1, (now - t0) / dur);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  
      camera.position.lerpVectors(startPos, endPos, ease);
  
      const look = new THREE.Vector3().lerpVectors(startTarget, endTarget, ease);
      if (c) {
        c.target.copy(look);
        c.update?.();
      } else {
        camera.lookAt(look);
      }
  
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    };
  
    animRef.current = requestAnimationFrame(tick);
  }, [active, camera, controls]);

  const { scene } = useGLTF("/models/floroom.glb");

  type RepoItem = { id: number; name: string; html_url: string; description: string | null; og: string };

  const [cryptoRepos, setCryptoRepos] = useState<RepoItem[] | null>(null);
  const [hackRepos,   setHackRepos]   = useState<RepoItem[] | null>(null);
  const [loading,     setLoading]     = useState<ScreenId>(null);
  
  async function fetchRepos(tagset: "crypto" | "hacking") {
    setLoading(tagset === "crypto" ? "left" : "right");
    try {
      const res = await fetch(`/api/github?user=FLOCK4H&tagset=${tagset}`, { cache: "no-store" });
      const json = await res.json();
      return (json.items as RepoItem[]) ?? [];
    } catch {
      return [];
    } finally {
      setLoading(null);
    }
  }

  const { left, right } = useMemo(() => {
    let l: THREE.Mesh | null = null;
    let r: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if ((o as any).isMesh && o.name) {
        if (!l && o.name === leftName) l = o as THREE.Mesh;
        if (!r && o.name === rightName) r = o as THREE.Mesh;
      }
    });
    return { left: l, right: r };
  }, [scene, leftName, rightName]);

  const centers = useMemo(() => {
    const toCenter = (m: THREE.Mesh | null) => {
      if (!m) return null;
      const box = new THREE.Box3().setFromObject(m);
      return box.getCenter(new THREE.Vector3());
    };
    return { left: toCenter(left), right: toCenter(right) };
  }, [left, right]);

  const animRef = useRef<number | null>(null);

  const getFocusDistance = (mesh: THREE.Mesh | null): number => {
    if (!mesh) return 0.8;
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length();
    return Math.max(radius * 2, 0.6);
  };

  const focusCamera = (target: THREE.Vector3 | null, opts: FocusOpts = {}) => {
    if (!target) return;
    const { distance = 1.1, offset = [0, 0, 0], duration = 650 } = opts;
  
    const startPos    = camera.position.clone();
    const startTarget = (controls?.target?.clone())
      ?? startPos.clone().add(camera.getWorldDirection(new THREE.Vector3()));
  
    let dir = target.clone().sub(startPos);
    if (dir.lengthSq() < 1e-8) dir = camera.getWorldDirection(new THREE.Vector3()); // fallback
    dir.normalize();
  
    const endPos = target.clone()
      .addScaledVector(dir, -distance)
      .add(new THREE.Vector3().fromArray(offset));
  
    const t0 = performance.now();
    const dur = Math.max(120, duration);
  
    const tick = (now: number) => {
      const t    = Math.min(1, (now - t0) / dur);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  
      camera.position.lerpVectors(startPos, endPos, ease);
  
      const look = new THREE.Vector3().lerpVectors(startTarget, target, ease);
      if (controls) {
        controls.target.copy(look);
        controls.update?.();
      } else {
        camera.lookAt(look);
      }
  
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    };
  
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const toggle = (mesh: THREE.Mesh | null, on: boolean) => {
      if (!mesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
      mats.forEach((m: any) => {
        if (m && "colorWrite" in m) m.colorWrite = !on; // disable drawing color when active
      });
    };
    toggle(left,  active === "left");
    toggle(right, active === "right");
  
    return () => {
      toggle(left,  false);
      toggle(right, false);
    };
  }, [active, left, right]);

  useEffect(() => {
    onFocus?.(active);
    if (active === "left")  focusCamera(centers.left,  { distance: getFocusDistance(left)  });
    if (active === "right") focusCamera(centers.right, { distance: getFocusDistance(right) });
  }, [active, centers, left, right, onFocus]);

  useEffect(() => {
    if (active === "left"  && cryptoRepos === null) fetchRepos("crypto").then(setCryptoRepos);
    if (active === "right" && hackRepos   === null) fetchRepos("hacking").then(setHackRepos);
  }, [active]); // eslint-disable-line

  // pointer cursor on hover
  useCursor(!!hovered);

  const basisFor = (mesh: THREE.Mesh | null) => {
    if (!mesh) return null;

    // local bbox
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    const size = new THREE.Vector3(); bb.getSize(size);

    // thinnest local axis -> normal
    let nIdx = 0;
    if (size.y < size.x) nIdx = 1;
    if (size.z < size.getComponent(nIdx)) nIdx = 2;

    mesh.updateWorldMatrix(true, true);
    const M = mesh.matrixWorld.clone();

    // world basis with sign (handles negative scaling)
    const origin = new THREE.Vector3().setFromMatrixPosition(M);
    const ex = new THREE.Vector3(1,0,0).applyMatrix4(M).sub(origin).normalize();
    const ey = new THREE.Vector3(0,1,0).applyMatrix4(M).sub(origin).normalize();
    const ez = new THREE.Vector3(0,0,1).applyMatrix4(M).sub(origin).normalize();

    let N = [ex,ey,ez][nIdx].clone().normalize();

    // center in world
    const cLocal = new THREE.Vector3(); bb.getCenter(cLocal);
    const center = cLocal.applyMatrix4(M);

    // face the camera
    if (camera.position.clone().sub(center).dot(N) < 0) N.multiplyScalar(-1);

    // make an upright V by projecting world-up onto plane
    const worldUp = new THREE.Vector3(0,1,0);
    const projOnPlane = (v: THREE.Vector3, n: THREE.Vector3) =>
      v.clone().sub(n.clone().multiplyScalar(v.dot(n)));

    let V = projOnPlane(worldUp, N);
    if (V.lengthSq() < 1e-8) {
      const camUp = camera.up.clone().applyQuaternion(camera.quaternion);
      V = projOnPlane(camUp, N);
      if (V.lengthSq() < 1e-8) V = ey.clone();
    }
    V.normalize();

    // U = V × N; re-orthogonalize V = N × U
    let U = V.clone().cross(N).normalize();
    V = N.clone().cross(U).normalize();

    // right-handed check
    if (U.clone().cross(V).dot(N) < 0) U.multiplyScalar(-1);

    // quaternion that orients +Z out of screen, +Y ≈ world up
    const rot = new THREE.Matrix4().makeBasis(U, V, N);
    const q = new THREE.Quaternion().setFromRotationMatrix(rot);

    // --- compute exact W/H along (U,V) by projecting bbox corners ---
    const min = bb.min, max = bb.max;
    const corners = [
      new THREE.Vector3(min.x,min.y,min.z), new THREE.Vector3(max.x,min.y,min.z),
      new THREE.Vector3(min.x,max.y,min.z), new THREE.Vector3(max.x,max.y,min.z),
      new THREE.Vector3(min.x,min.y,max.z), new THREE.Vector3(max.x,min.y,max.z),
      new THREE.Vector3(min.x,max.y,max.z), new THREE.Vector3(max.x,max.y,max.z),
    ].map(v => v.applyMatrix4(M));

    let uMin=Infinity,uMax=-Infinity,vMin=Infinity,vMax=-Infinity;
    for (const p of corners){
      const u = p.dot(U), v = p.dot(V);
      if (u<uMin) uMin=u; if (u>uMax) uMax=u;
      if (v<vMin) vMin=v; if (v>vMax) vMax=v;
    }
    const w = (uMax - uMin);
    const h = (vMax - vMin);

    return { q, center, w, h };
  };
  
  const leftBasis  = useMemo(() => basisFor(left),  [left, camera]);
  const rightBasis = useMemo(() => basisFor(right), [right, camera]);

  return (
    <>
      {left && (
        <HitPlane
          target={left}
          tweak={TWEAKS["ScreenLeft"]}
          onHover={(v) => setHovered(v ? "left" : null)}
          onClick={() => setActive("left")}
        />
      )}
      {right && (
        <HitPlane
          target={right}
          tweak={TWEAKS["ScreenRight"]}
          onHover={(v) => setHovered(v ? "right" : null)}
          onClick={() => setActive("right")}
        />
      )}

      {/* Left screen HTML */}
      {active === "left" && leftBasis && (
      <group position={leftBasis.center} quaternion={leftBasis.q}>
          <mesh position={[0, 0, 0.005]}>
            <planeGeometry args={[leftBasis.w, leftBasis.h]} />
            <meshBasicMaterial
              map={xpTex}
              color={0xffffff}
              side={THREE.FrontSide}
              depthWrite={true}
              depthTest={true}
              polygonOffset
              polygonOffsetUnits={1}
              polygonOffsetFactor={-4}
            />
          </mesh>
          <Html
            transform
            position={[0, 0, 0.02]}
            distanceFactor={1.3}
            occlude={false}
            wrapperClass="ui-surface"               // NEW: class on the outer Html wrapper
            zIndexRange={[100, 0]}                  // keep DOM safely above canvas
            style={{ pointerEvents: "auto" }}       // keep; touch-action comes from CSS class below
            onPointerEnter={lockHandlers.onPointerEnter}
            onPointerLeave={lockHandlers.onPointerLeave}
            onTouchStart={lockHandlers.onTouchStart}
            onTouchEnd={lockHandlers.onTouchEnd}
            onTouchCancel={lockHandlers.onTouchCancel}
            onWheel={lockHandlers.onWheel}
          >
            <div style={panel}>
              <div style={panelHeader}>
                <span style={panelHeaderTitle}>Blockchain</span>
                <button style={closeBtn} onClick={() => setActive(null)}>×</button>
              </div>
              <div
                style={panelBody}
                onPointerEnter={lockHandlers.onPointerEnter}
                onPointerLeave={lockHandlers.onPointerLeave}
                onTouchStart={lockHandlers.onTouchStart}
                onTouchEnd={lockHandlers.onTouchEnd}
                onTouchCancel={lockHandlers.onTouchCancel}
                onWheel={lockHandlers.onWheel}
              >
                {loading === "left" && <div style={{ opacity: .8, fontSize: 12 }}>Loading…</div>}
                {cryptoRepos && cryptoRepos.length === 0 && <div style={{ opacity: .8, fontSize: 12 }}>No crypto-tagged repos.</div>}
                {cryptoRepos && cryptoRepos.map((r) => (
                  <div key={r.id} style={repoRow}>
                    <img
                      src={`/api/og?url=${encodeURIComponent(r.og)}`}
                      alt=""
                      style={thumbImg}
                    />
                    <div style={textCol}>
                      <a
                        href={r.html_url}
                        target="_blank"
                        rel="noreferrer"
                        style={repoNameLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.name}
                      </a>
                      <span style={repoDescription}>{r.description || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Html>
        </group>
      )}

      {/* Right screen HTML */}
      {active === "right" && rightBasis && (
      <group position={rightBasis.center} quaternion={rightBasis.q}>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[rightBasis.w, rightBasis.h]} />
          <meshBasicMaterial
            map={xpTex}
            color={0xffffff}
            side={THREE.FrontSide}
            depthWrite={true}
            depthTest={true}
            polygonOffset
            polygonOffsetUnits={1}
            polygonOffsetFactor={-4}
          />
        </mesh>

        <Html
            transform
            position={[0, 0, 0.02]}
            distanceFactor={1.3}
            occlude={false}
            wrapperClass="ui-surface"               // NEW: class on the outer Html wrapper
            zIndexRange={[100, 0]}                  // keep DOM safely above canvas
            style={{ pointerEvents: "auto" }}       // keep; touch-action comes from CSS class below
            onPointerEnter={lockHandlers.onPointerEnter}
            onPointerLeave={lockHandlers.onPointerLeave}
            onTouchStart={lockHandlers.onTouchStart}
            onTouchEnd={lockHandlers.onTouchEnd}
            onTouchCancel={lockHandlers.onTouchCancel}
            onWheel={lockHandlers.onWheel}
        >
        <div style={panel}>
          <div style={panelHeader}>
            <span style={panelHeaderTitle}>Hacking</span>
            <button style={closeBtn} onClick={() => setActive(null)}>×</button>
          </div>
          <div
                style={panelBody}
                onPointerEnter={lockHandlers.onPointerEnter}
                onPointerLeave={lockHandlers.onPointerLeave}
                onTouchStart={lockHandlers.onTouchStart}
                onTouchEnd={lockHandlers.onTouchEnd}
                onTouchCancel={lockHandlers.onTouchCancel}
                onWheel={lockHandlers.onWheel}
              >
            {loading === "right" && <div style={{ opacity: .8, fontSize: 12 }}>Loading…</div>}
            {hackRepos && hackRepos.length === 0 && <div style={{ opacity: .8, fontSize: 12 }}>No hacking-tagged repos.</div>}
            {hackRepos && hackRepos.map((r) => (
              <div key={r.id} style={repoRow}>
                  <img
                  src={`/api/og?url=${encodeURIComponent(r.og)}`}
                  alt=""
                  style={thumbImg}
                />
                  <div style={textCol}>
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noreferrer"
                      style={repoNameLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.name}
                    </a>
                    <span style={repoDescription}>{r.description || "—"}</span>
                  </div>
                </div>
            ))}
          </div>
        </div>
        </Html>
      </group>
    )}
    </>
  );
}

const panel: React.CSSProperties = {
  maxHeight: 180,
  background: "rgba(0,0,0,.6)",
  color: "white",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  boxShadow: "0 6px 30px rgba(0,0,0,.35)",
  overflowX: "hidden",
  overflowY: "hidden",
  backdropFilter: "blur(6px)",
};

const panelBody: React.CSSProperties = {
  padding: 12,
  background: "rgba(0,0,0,.25)",
  overflowY: "auto",
  maxHeight: 128,
  WebkitOverflowScrolling: "touch",
  touchAction: "pan-y",
  overscrollBehavior: "contain",
};

const repoRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 0",
  fontSize: 14,
  touchAction: "pan-y",
  cursor: "default",
};

const thumbImg: React.CSSProperties = {
  width: 56,
  height: 56,
  objectFit: "cover",
  borderRadius: 8,
  background: "#111",
  pointerEvents: "auto",
  touchAction: "pan-y",
};

const textCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  touchAction: "pan-y",
};

const repoNameLink: React.CSSProperties = {
  fontWeight: 700,
  lineHeight: 1.1,
  fontFamily: "Roboto Mono, monospace",
  color: "inherit",
  textDecoration: "none",
  display: "inline-block",
  pointerEvents: "auto",
  touchAction: "pan-y",
  WebkitTapHighlightColor: "rgba(255,255,255,.15)",
};

const repoDescription: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 220,
  whiteSpace: "nowrap",
  fontFamily: "Roboto Mono, monospace",
  pointerEvents: "auto",
  touchAction: "pan-y",
};

const panelHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,.06)", fontSize: 13 };
const panelHeaderTitle: React.CSSProperties = { fontWeight: 700, fontFamily: "Verdana, sans-serif" };
const closeBtn:    React.CSSProperties = { width: 24, height: 24, borderRadius: 6, border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "white", cursor: "pointer" };
const repoName: React.CSSProperties = { fontWeight: 700, lineHeight: 1.1, fontFamily: "Roboto Mono, monospace" };