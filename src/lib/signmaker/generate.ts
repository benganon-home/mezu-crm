// Client-side STL generation via OpenSCAD-WASM (Manifold backend).
// Each generation runs in its OWN throwaway Web Worker: OpenSCAD can only run
// once per WASM instance, and a 2nd instance can't be created in the same realm,
// so reusing anything aborts the 2nd generation. A fresh worker per call = a
// fresh realm = a clean instance every time. Off-thread, so the UI stays smooth.

import type { ModelId, SignParams } from "./models";
import { DOORSIGN_SCAD } from "./scad";

const baseStlCache = new Map<ModelId, Uint8Array>();

async function loadBaseStl(modelId: ModelId): Promise<Uint8Array> {
  const cached = baseStlCache.get(modelId);
  if (cached) return cached;
  const buf = await fetch(`/signmaker/${modelId}.stl`).then((r) => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  baseStlCache.set(modelId, bytes);
  return bytes;
}

export interface GenerateInput {
  modelId: ModelId;
  svgContent: string;
  params: SignParams;
}

/** Generate the cut STL in a throwaway worker. Returns the STL bytes. */
export async function generateStl({ modelId, svgContent, params }: GenerateInput): Promise<Uint8Array> {
  const baseBytes = await loadBaseStl(modelId);
  const args = [
    "/model.scad",
    "-o",
    "/out.stl",
    "-D",
    `depth=${params.depth}`,
    "-D",
    `svg_scale=${0.4 * (params.userScale ?? 1)}`,
    "-D",
    `z_offset=${params.zOffset}`,
    "-D",
    `base_offset_x=${params.baseOffsetX}`,
    "-D",
    `base_offset_y=${params.baseOffsetY}`,
    "-D",
    `text_offset_y=${params.textOffsetY}`,
    "--backend=manifold",
  ];

  return new Promise<Uint8Array>((resolve, reject) => {
    const worker = new Worker(new URL("./openscad.worker.ts", import.meta.url), { type: "module" });
    const done = (fn: () => void) => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("timeout"))), 60000);
    worker.onmessage = (e: MessageEvent<{ ok: boolean; stl?: Uint8Array; error?: string }>) => {
      if (e.data.ok && e.data.stl) done(() => resolve(e.data.stl!));
      else done(() => reject(new Error(e.data.error || "generation failed")));
    };
    worker.onerror = () => done(() => reject(new Error("worker error")));

    const baseCopy = new Uint8Array(baseBytes); // transferable copy (keeps cache intact)
    worker.postMessage({ baseBytes: baseCopy, svgContent, scad: DOORSIGN_SCAD, args }, [baseCopy.buffer]);
  });
}

/** Trigger a browser download of STL bytes. */
export function downloadStl(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".stl") ? filename : `${filename}.stl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
