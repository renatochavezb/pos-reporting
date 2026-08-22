"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function BotonActualizar({ sucursal }) {
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
      router.refresh();
    } catch (e) {
      toast.error("No se pudo actualizar: " + e.message, { id: t });
    } finally {
      setCargando(false);
    }
  };

  return (
    <button
      onClick={actualizar}
      disabled={cargando}
      title={`Actualizar ${sucursal || ""}`}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-label text-[12px] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-container)] transition-colors disabled:opacity-60"
    >
      <span className={`material-symbols-outlined text-[18px] ${cargando ? "animate-spin" : ""}`}>
        {cargando ? "progress_activity" : "refresh"}
      </span>
      {cargando ? "Actualizando…" : "Actualizar"}
    </button>
  );
}
