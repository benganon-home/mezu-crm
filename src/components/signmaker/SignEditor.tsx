"use client";

import { useEffect, useRef, useState } from "react";
import { FONTS, loadFont, buildSvg, type CreatorLine } from "@/lib/signmaker/text-to-svg";
import { MODEL_IDS, MODEL_PRESETS, type ModelId, type SignParams } from "@/lib/signmaker/models";
import { generateStl, downloadStl } from "@/lib/signmaker/generate";
import StlPreview from "./StlPreview";

export interface SignEditorInitial {
  modelId?: ModelId;
  lines?: CreatorLine[];
  fontKey?: string;
  name?: string;
}

const DEFAULT_LINES: CreatorLine[] = [
  { text: "", size: 55 },
  { text: "כהן", size: 100 },
  { text: "", size: 45 },
];

function paramsFor(modelId: ModelId, userScale: number, depth: number, textOffsetY: number): SignParams {
  const p = MODEL_PRESETS[modelId];
  return { depth, svgScale: 0.4, zOffset: p.zOffset, baseOffsetX: p.baseOffsetX, baseOffsetY: p.baseOffsetY, textOffsetY, userScale };
}

export default function SignEditor({ initial }: { initial?: SignEditorInitial }) {
  const [modelId, setModelId] = useState<ModelId>(initial?.modelId ?? "classic");
  const [lines, setLines] = useState<CreatorLine[]>(initial?.lines?.length ? padLines(initial.lines) : DEFAULT_LINES);
  const [fontKey, setFontKey] = useState(initial?.fontKey ?? FONTS[0].key);
  const [name, setName] = useState(initial?.name ?? "");
  const [userScale, setUserScale] = useState(1);
  const [lineSpacing, setLineSpacing] = useState(70);
  const preset = MODEL_PRESETS[modelId];
  const [depth, setDepth] = useState(preset.depth);
  const [textOffsetY, setTextOffsetY] = useState(preset.textOffsetY);

  const [svgContent, setSvgContent] = useState("");
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build the outlined SVG (debounced) for preview + generation.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const def = FONTS.find((f) => f.key === fontKey) ?? FONTS[0];
      try {
        const font = await loadFont(def.file);
        const svg = buildSvg(font, { lines, fontKey, letterSpacing: 0, lineSpacing });
        setSvgContent(svg);
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        lastUrl.current = url;
        setSvgUrl(url);
      } catch (e) {
        setError(String(e));
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, fontKey, lineSpacing]);

  const params = paramsFor(modelId, userScale, depth, textOffsetY);

  function selectModel(id: ModelId) {
    setModelId(id);
    setDepth(MODEL_PRESETS[id].depth);
    setTextOffsetY(MODEL_PRESETS[id].textOffsetY);
  }

  function setLine(i: number, patch: Partial<CreatorLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function download() {
    if (!svgContent) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await generateStl({ modelId, svgContent, params });
      const fname = (name.trim() || lines.map((l) => l.text.trim()).filter(Boolean).join(" ") || "sign").trim();
      downloadStl(bytes, fname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה ביצירת STL");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2" dir="rtl">
      {/* Controls */}
      <div className="space-y-4">
        {/* Model */}
        <div>
          <label className="label">דגם</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {MODEL_IDS.map((id) => (
              <button
                key={id}
                onClick={() => selectModel(id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  modelId === id ? "border-gold bg-gold/10 text-gold" : "border-cream-dark hover:border-gold/50"
                }`}
              >
                {MODEL_PRESETS[id].nameHe}
              </button>
            ))}
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <label className="label">שורות טקסט</label>
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 text-center text-xs text-muted">{i + 1}</span>
              <input
                value={line.text}
                onChange={(e) => setLine(i, { text: e.target.value })}
                placeholder={["שורה עליונה", "שורה ראשית", "שורה תחתונה"][i]}
                className="input flex-1"
              />
              <input
                type="range"
                min={24}
                max={140}
                step={2}
                value={line.size}
                onChange={(e) => setLine(i, { size: parseInt(e.target.value) })}
                className="w-20 accent-gold"
              />
            </div>
          ))}
        </div>

        {/* Font */}
        <div>
          <label className="label">גופן</label>
          <select value={fontKey} onChange={(e) => setFontKey(e.target.value)} className="input mt-1 w-full">
            {FONTS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Slider label="קנה מידה" value={userScale} min={0.3} max={2.5} step={0.05} onChange={setUserScale} />
          <Slider label="ריווח שורות" value={lineSpacing} min={0} max={80} step={2} onChange={setLineSpacing} />
          <Slider label="מיקום אנכי" value={textOffsetY} min={-30} max={30} step={1} onChange={setTextOffsetY} />
          <Slider label='עומק חיתוך מ"מ' value={depth} min={0.5} max={10} step={0.1} onChange={setDepth} />
        </div>

        <div>
          <label className="label">שם קובץ</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="כהן" className="input mt-1 w-full" />
        </div>

        <button
          onClick={download}
          disabled={busy}
          className="btn-primary w-full disabled:opacity-50"
        >
          {busy ? "מייצר STL…" : "הורדת STL"}
        </button>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <div className="aspect-square w-full overflow-hidden rounded-xl border border-cream-dark bg-[#F8F7FC]">
          <StlPreview baseUrl={`/signmaker/${modelId}.stl`} svgUrl={svgUrl} params={params} className="h-full w-full" />
        </div>
        <div className="flex min-h-20 items-center justify-center rounded-xl border border-cream-dark bg-white p-4">
          {svgContent ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`} alt="preview" className="max-h-20 w-auto max-w-full" />
          ) : (
            <span className="text-xs text-muted">…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function padLines(lines: CreatorLine[]): CreatorLine[] {
  const out = [...lines];
  while (out.length < 3) out.push({ text: "", size: 45 });
  return out.slice(0, 3);
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between font-medium">
        {label}
        <span className="text-muted tabular-nums">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-1 w-full accent-gold" />
    </label>
  );
}
