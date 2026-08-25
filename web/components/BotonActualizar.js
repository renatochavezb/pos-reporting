"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function BotonActualizar({ sucursal, rotulo }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  const actualizar = async () => {
    if (cargando) return;
    setCargando(true);
    const t = toast.loading(`Leyendo ${sucursal || "la sucursal"}…`);
    try {
      const r = await fetch("/api/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sucursal }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");
      toast.success("Datos actualizados", { id: t });
    } catch (e) {
      toast.error("No se pudo actualizar: " + e.message, { id: t });
    } finally {
      // Se refresca en los dos caminos (éxito y error): si la corrida expira o falla, la
      // pantalla debe mostrar el resultado parcial que sí alcanzó a guardarse (F21/P5), en
      // vez de quedarse con datos viejos. El toast de error se conserva tal cual.
      setCargando(false);
      router.refresh();
    }
  };

  return (
    <button
      onClick={actualizar}
      disabled={cargando}
      title={rotulo || `Actualizar ${sucursal || ""}`}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium border border-[var(--outline-variant)] text-[var(--primary)] bg-[var(--surface-container-lowest)] hover:bg-[var(--primary-container)] hover:border-[var(--primary-container)] transition-colors disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`}>
        <path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
      </svg>
      {cargando ? "Actualizando…" : rotulo || "Actualizar"}
    </button>
  );
}
