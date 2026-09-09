import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const prior = document.activeElement; const dialog = ref.current!; dialog.showModal(); return () => { dialog.close(); if (prior instanceof HTMLElement) prior.focus(); }; }, []);
  return <dialog className="mp-dialog td-app" ref={ref} aria-labelledby="mp-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}><div className="mp-dialog-heading"><h2 id="mp-dialog-title">{title}</h2><button className="td-icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}
