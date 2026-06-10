// Client-side STL generation via OpenSCAD-WASM running in a Web Worker, so the
// engine init + boolean never block the UI. Output is identical to desktop OpenSCAD.

import type { ModelId, SignParams } from "./models";
import { DOORSIGN_SCAD } from "./scad";

let worker: Worker | null = null;
let reqId = 0;
const pending = new Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();
const baseStlCache = new Map<ModelId, Uint8Array>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./openscad.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; stl?: Uint8Array; error?: string }>) => {
      const { id, ok, stl, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok && stl) p.resolve(stl);
      else p.reject(new Error(error || "generation failed"));
    };
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error("worker error"));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

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

/** Generate the cut STL off-thread. Returns the STL bytes. */
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
    "--enable=manifold",
  ];

  const w = getWorker();
  const id = ++reqId;
  // Transfer a copy of the base bytes so we don't neuter the cache entry.
  const baseCopy = new Uint8Array(baseBytes);
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, baseBytes: baseCopy, svgContent, scad: DOORSIGN_SCAD, args }, [baseCopy.buffer]);
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
