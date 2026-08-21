"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const fechaCorta = (iso) =>
  !iso ? null : new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));

export default function SubirPrecios({ ultimaCarga }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);

  const alElegir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    const t = toast.loading("Subiendo lista de precios…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/precios/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al subir");
      toast.success(`Lista actualizada: ${data.filas} precios`, { id: t });
      router.refresh();
    } catch (err) {
      toast.error(err.message, { id: t });
    } finally {
      setCargando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fecha = fechaCorta(ultimaCarga?.cargado_en);

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="eyebrow">Lista de precios</p>
        <p className="text-sm text-[var(--on-surface-variant)] mt-1">
          {fecha ? <>Última carga: <span className="text-[var(--on-surface)]">{fecha}</span> · {ultimaCarga?.filas} precios</> : "Aún no cargas ninguna lista"}
        </p>
      </div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={alElegir} disabled={cargando} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={cargando}
        className="shrink-0 rounded-full px-4 py-2 font-label text-[12px] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-container)] transition-colors disabled:opacity-60"
      >
        {cargando ? "Subiendo…" : "Subir lista"}
      </button>
    </div>
  );
}
