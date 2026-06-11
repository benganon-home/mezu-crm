"use client";

import SignEditor, { type SignEditorInitial } from "./SignEditor";

export default function SignModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: SignEditorInitial;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <div className="surface relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy dark:text-cream">יצירת שלט STL</h2>
          <button onClick={onClose} className="btn-ghost text-sm">
            סגירה
          </button>
        </div>
        <SignEditor initial={initial} />
      </div>
    </div>
  );
}
