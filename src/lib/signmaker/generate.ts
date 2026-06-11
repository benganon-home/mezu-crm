// Client-side STL generation via OpenSCAD-WASM (Manifold backend). Runs on the
// main thread (a module Web Worker can't load the embedded-data-URI WASM in this
// Next bundle). Manifold makes a cut ~170ms, so the UI barely pauses.

import type { ModelId, SignParams } from "./models";
import { DOORSIGN_SCAD } from "./scad";

type OscadFS = {
  writeFile: (path: string, data: string | Uint8Array) => void;
  readFile: (path: string, opts: { encoding: "binary" }) => Uint8Array;
};
type OscadInstance = { FS: OscadFS; callMain: (args: string[]) => number };

let instancePromise: Promise<OscadInstance> | null = null;
const baseStlCache = new Map<ModelId, Uint8Array>();

function getInstance(): Promise<OscadInstance> {
  if (!instancePromise) {
    instancePromise = import("openscad-wasm-prebuilt").then(async (mod) => {
      const oscad = await mod.createOpenSCAD({ noInitialRun: true, printErr: () => {} });
      return oscad.getInstance() as unknown as OscadInstance;
    });
  }
  return instancePromise;
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

/** Generate the cut STL in-browser. Returns the STL bytes. */
export async function generateStl({ modelId, svgContent, params }: GenerateInput): Promise<Uint8Array> {
  const [inst, baseBytes] = await Promise.all([getInstance(), loadBaseStl(modelId)]);

  inst.FS.writeFile("/base.stl", baseBytes);
  inst.FS.writeFile("/text.svg", svgContent);
  inst.FS.writeFile("/model.scad", DOORSIGN_SCAD);

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
    "--backend=manifold", // fast + low-memory; CGAL (default) OOMs in the WASM heap
  ];

  let code: number;
  try {
    code = inst.callMain(args);
  } catch {
    instancePromise = null; // a WASM abort leaves the runtime unusable
    throw new Error("engine-crash");
  }
  if (code !== 0) {
    instancePromise = null;
    throw new Error(`exit-${code}`);
  }
  return inst.FS.readFile("/out.stl", { encoding: "binary" });
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
