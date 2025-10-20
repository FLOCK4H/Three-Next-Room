import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
type Tweak = { inflate?: number | [number, number]; rollDeg?: number; offset?: [number, number, number] };

function HitPlane({
    target,
    tweak,
    onHover,
    onClick,
  }: {
    target: THREE.Mesh;
    tweak?: Tweak;
    onHover: (v: boolean) => void;
    onClick: () => void;
  }) {
    const group = useRef<THREE.Group>(null);
    const [isHover, setIsHover] = useState(false);
  
    const computed = useMemo(() => {
      // Local bbox to find thinnest axis (screen normal)
      const geom = target.geometry as THREE.BufferGeometry;
      if (!geom.boundingBox) geom.computeBoundingBox();
      const gbox = geom.boundingBox!;
      const localSize = new THREE.Vector3(); gbox.getSize(localSize);
  
      let normalIdx = 0;
      if (localSize.y < localSize.x) normalIdx = 1;
      if (localSize.z < localSize.getComponent(normalIdx)) normalIdx = 2;
      const other = [0,1,2].filter(i => i !== normalIdx) as [number, number];
  
      // World transform bits
      const worldQuat = new THREE.Quaternion();  target.getWorldQuaternion(worldQuat);
      const worldScale = new THREE.Vector3();    target.getWorldScale(worldScale);
  
      // Width/height in world units (+ inflation)
      const inflate = tweak?.inflate ?? 1.02;
      const inflateU = Array.isArray(inflate) ? inflate[0] : inflate;
      const inflateV = Array.isArray(inflate) ? inflate[1] : inflate;
      const w = (localSize.getComponent(other[0]) * Math.abs(worldScale.getComponent(other[0]))) * inflateU;
      const h = (localSize.getComponent(other[1]) * Math.abs(worldScale.getComponent(other[1]))) * inflateV;
  
      // Base alignment quaternion (Z -> screen normal)
      const normalLocal = new THREE.Vector3(Number(normalIdx===0), Number(normalIdx===1), Number(normalIdx===2));
      const worldNormal = normalLocal.clone().applyQuaternion(worldQuat).normalize();
      const qAlign = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), worldNormal);
  
      // Optional roll around the normal
      const rollRad = ((tweak?.rollDeg ?? 0) * Math.PI) / 180;
      const qRoll = new THREE.Quaternion().setFromAxisAngle(worldNormal, rollRad);
      const qTotal = qAlign.clone().multiply(qRoll);
  
      // Screen-space basis vectors (U,V,N) in world space (after roll)
      const U = new THREE.Vector3(1,0,0).applyQuaternion(qTotal).normalize();
      const V = new THREE.Vector3(0,1,0).applyQuaternion(qTotal).normalize();
      const N = new THREE.Vector3(0,0,1).applyQuaternion(qTotal).normalize();
  
      // Center in world + offsets (u,v,n)
      const centerLocal = new THREE.Vector3(); gbox.getCenter(centerLocal);
      const centerWorld = centerLocal.applyMatrix4(target.matrixWorld);
      const [du, dv, dn] = tweak?.offset ?? [0, 0, 0.0015];
      const position = centerWorld.clone().add(U.multiplyScalar(du)).add(V.multiplyScalar(dv)).add(N.multiplyScalar(dn));
  
      return { w, h, qTotal, position };
    }, [target, tweak]);
  
    const planeGeo  = useMemo(() => new THREE.PlaneGeometry(computed.w, computed.h), [computed.w, computed.h]);
    const edgesGeo  = useMemo(() => new THREE.EdgesGeometry(planeGeo), [planeGeo]);
  
    const hitMat = useMemo(() => new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.0001, depthWrite: false, side: THREE.DoubleSide,
    }), []);
    const borderMat = useMemo(() => new THREE.LineBasicMaterial({
      color: 0x00e5ff, transparent: true, opacity: 0.95, depthTest: false,
    }), []);
  
    useEffect(() => {
      if (!group.current) return;
      group.current.quaternion.copy(computed.qTotal);
      group.current.position.copy(computed.position);
    }, [computed]);
  
    return (
      <group ref={group}>
        <mesh
          geometry={planeGeo}
          material={hitMat}
          frustumCulled={false}
          onPointerOver={(e) => { e.stopPropagation(); setIsHover(true); onHover(true); }}
          onPointerOut={(e) => { e.stopPropagation(); setIsHover(false); onHover(false); }}
          onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        />
        <lineSegments geometry={edgesGeo} material={borderMat} visible={isHover} />
      </group>
    );
  }

export { HitPlane, type Tweak };