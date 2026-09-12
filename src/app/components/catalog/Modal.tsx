import { useEffect, useId, useRef, type ReactNode } from 'react';
export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[min(96vw,850px)] max-h-[90vh] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50">
    <div className="flex justify-between items-center p-5 border-b"><h2 id={titleId} className="font-semibold text-lg text-slate-900">{title}</h2><button aria-label="Close dialog" disabled={busy} onClick={onClose} className="px-3 py-1 rounded hover:bg-slate-100 disabled:opacity-40">✕</button></div>
    {children}
  </dialog>;
}
