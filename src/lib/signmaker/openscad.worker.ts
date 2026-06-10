// Web Worker: runs OpenSCAD-WASM off the main thread so the UI stays responsive
// (the engine init + boolean can take a couple of seconds).

import { createOpenSCAD } from "openscad-wasm-prebuilt";

type OscadFS = {
  writeFile: (path: string, data: string | Uint8Array) => void;
  readFile: (path: string, opts: { encoding: "binary" }) => Uint8Array;
};
type OscadInstance = { FS: OscadFS; callMain: (args: string[]) => number };

let instance: OscadInstance | null = null;

interface Req {
  id: number;
  baseBytes: Uint8Array;
  svgContent: string;
  scad: string;
  args: string[];
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, baseBytes, svgContent, scad, args } = e.data;
  try {
    if (!instance) {
      const oscad = await createOpenSCAD({ noInitialRun: true, printErr: () => {} });
      instance = oscad.getInstance() as unknown as OscadInstance;
    }
    instance.FS.writeFile("/base.stl", baseBytes);
    instance.FS.writeFile("/text.svg", svgContent);
    instance.FS.writeFile("/model.scad", scad);
    const code = instance.callMain(args);
    if (code !== 0) {
      instance = null; // a bad exit can leave the runtime unusable
      throw new Error(`OpenSCAD failed (code ${code})`);
    }
    const out = instance.FS.readFile("/out.stl", { encoding: "binary" });
    const copy = new Uint8Array(out); // detach a private copy to transfer
    (self as unknown as Worker).postMessage({ id, ok: true, stl: copy }, [copy.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
