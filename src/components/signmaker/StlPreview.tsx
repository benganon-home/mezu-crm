"use client";

import { Suspense, useMemo, Component, type ReactNode } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import * as THREE from "three";
import { UNIT_MM, type SignParams } from "@/lib/signmaker/models";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { children: ReactNode }) {
    if (prev.children !== this.props.children && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface BaseInfo {
  geo: THREE.BufferGeometry;
  topZ: number;
}

function useBase(url: string): BaseInfo {
  const geometry = useLoader(STLLoader, url);
  return useMemo(() => {
    const g = (geometry as THREE.BufferGeometry).clone();
    g.center();
    g.computeVertexNormals();
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    return { geo: g, topZ: bb.max.z };
  }, [geometry]);
}

function Base({ base }: { base: BaseInfo }) {
  return (
    <mesh geometry={base.geo}>
      <meshStandardMaterial color="#cdd5e2" roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

function SvgOverlay({ url, base, params }: { url: string; base: BaseInfo; params: SignParams }) {
  const data = useLoader(SVGLoader, url);

  const built = useMemo(() => {
    const shapes: THREE.Shape[] = [];
    for (const path of data.paths) for (const s of SVGLoader.createShapes(path)) shapes.push(s);
    if (shapes.length === 0) return null;
    const visualDepth = Math.max(0.8, params.depth);
    const g = new THREE.ExtrudeGeometry(shapes, { depth: visualDepth, bevelEnabled: false });
    g.scale(1, -1, 1);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -bb.min.z);
    return { geo: g };
  }, [data, params.depth]);

  if (!built) return null;
  const scale = UNIT_MM * params.userScale;
  const textZ = params.zOffset - base.topZ + 0.6;

  return (
    <mesh geometry={built.geo} scale={[scale, scale, 1]} position={[0, params.textOffsetY, textZ]}>
      <meshStandardMaterial color="#2D2B55" roughness={0.4} metalness={0.1} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}

function Scene({ baseUrl, svgUrl, params }: { baseUrl: string; svgUrl: string | null; params: SignParams }) {
  const base = useBase(baseUrl);
  return (
    <>
      <Base base={base} />
      {svgUrl && (
        <Boundary key={svgUrl}>
          <SvgOverlay url={svgUrl} base={base} params={params} />
        </Boundary>
      )}
    </>
  );
}

export default function StlPreview({
  baseUrl,
  svgUrl,
  params,
  className,
}: {
  baseUrl: string;
  svgUrl: string | null;
  params: SignParams;
  className?: string;
}) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [70, -300, 360], fov: 30, up: [0, 0, 1], near: 1, far: 4000 }}
      >
        <color attach="background" args={["#F8F7FC"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[60, -60, 160]} intensity={1.1} />
        <directionalLight position={[-80, 80, 60]} intensity={0.45} />
        <Suspense fallback={null}>
          <Scene baseUrl={baseUrl} svgUrl={svgUrl} params={params} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
