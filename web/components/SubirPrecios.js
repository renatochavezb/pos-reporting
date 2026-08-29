"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const fechaCorta = (iso) =>
  !iso ? null : new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));

const REGIONES = [
  { k: "AMBAS", txt: "Ambas" },
  { k: "CHIHUAHUA", txt: "Chihuahua" },
  { k: "JUAREZ", txt: "Juárez" },
];

const TIPOS = [
  { k: "costos", txt: "Costos" },
  { k: "publico", txt: "Precio público" },
];

export default function SubirPrecios({ ultimaCarga }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [region, setRegion] = useState("AMBAS");
  const [tipo, setTipo] = useState("costos");

  const alElegir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    const t = toast.loading(`Subiendo lista de ${tipo === "publico" ? "precio público" : "costos"} (${region.toLowerCase()})…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("region", region);
      fd.append("tipo", tipo);
      const r = await fetch("/api/precios/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al subir");
      toast.success(`Lista de ${tipo === "publico" ? "precio público" : "costos"} actualizada: ${data.filas} precios`, { id: t });
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
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] p-6">
      <p className="eyebrow mb-1">Cargar lista de precios</p>
      <p className="text-sm text-[var(--on-surface-variant)] mb-5">
        {fecha ? <>Última carga: <span className="text-[var(--on-surface)]">{fecha}</span> · {ultimaCarga?.filas} precios</> : "Aún no cargas ninguna lista"}
      </p>

      <p className="text-xs text-[var(--on-surface-variant)] mb-2">¿Qué lista es este archivo?</p>
      <div className="flex gap-2 mb-4">
        {TIPOS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTipo(t.k)}
            className={`px-4 py-1.5 rounded-full font-label text-[12px] transition-colors ${
              tipo === t.k
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
            }`}
          >
            {t.txt}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--on-surface-variant)] mb-2">¿Para qué región es este archivo?</p>
      <div className="flex gap-2 mb-5">
        {REGIONES.map((r) => (
          <button
            key={r.k}
            onClick={() => setRegion(r.k)}
            className={`px-4 py-1.5 rounded-full font-label text-[12px] transition-colors ${
              region === r.k
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
            }`}
          >
            {r.txt}
          </button>
        ))}
      </div>

      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={alElegir} disabled={cargando} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={cargando}
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-label text-[13px] bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 transition disabled:opacity-60"
      >
        {cargando ? (
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 7.5 12 3m0 0L7.5 7.5M12 3v12" />
          </svg>
        )}
        {cargando ? "Subiendo…" : `Subir ${tipo === "publico" ? "precio público" : "costos"}${region !== "AMBAS" ? " · " + (region === "JUAREZ" ? "Juárez" : "Chihuahua") : ""}`}
      </button>

      <p className="text-xs text-[var(--on-surface-variant)] mt-4">
        <b>Costos</b> y <b>Precio público</b> son dos listas independientes: subir una <b>no borra</b> la otra.
        <br /><b>Ambas</b>: archivo con las 2 columnas (Chihuahua y Juárez). <b>Chihuahua</b> o <b>Juárez</b>: solo esa región.
      </p>
    </div>
  );
}
