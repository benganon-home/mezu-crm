// Single-shot OpenSCAD-WASM worker: does exactly ONE generation, then the main
// thread terminates it. OpenSCAD's main() can't be run twice in one WASM instance
// (2nd callMain aborts) and a fresh instance can't be made in the same realm — so
// each generation gets its own throwaway worker (its own realm = clean instance).

import { createOpenSCAD } from "openscad-wasm-prebuilt";

interface Req {
  baseBytes: Uint8Array;
  svgContent: string;
  scad: string;
  args: string[];
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const { baseBytes, svgContent, scad, args } = e.data;
  const post = (msg: object, transfer?: Transferable[]) =>
    (self as unknown as Worker).postMessage(msg, transfer ?? []);
  try {
    const oscad = await createOpenSCAD({ noInitialRun: true, printErr: () => {} });
    const inst = oscad.getInstance() as unknown as {
      FS: {
        writeFile: (p: string, d: string | Uint8Array) => void;
        readFile: (p: string, o: { encoding: "binary" }) => Uint8Array;
      };
      callMain: (a: string[]) => number;
    };
    inst.FS.writeFile("/base.stl", baseBytes);
    inst.FS.writeFile("/text.svg", svgContent);
    inst.FS.writeFile("/model.scad", scad);
    const code = inst.callMain(args);
    if (code !== 0) throw new Error(`exit-${code}`);
    const out = inst.FS.readFile("/out.stl", { encoding: "binary" });
    const copy = new Uint8Array(out);
    post({ ok: true, stl: copy }, [copy.buffer]);
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
