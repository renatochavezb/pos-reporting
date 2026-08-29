"use client";

import { useState } from "react";

const pesos = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default function TablaPrecios({ filas, resumen }) {
  const [metric, setMetric] = useState("costo"); // 'costo' | 'publico'
  const val = (celda) => (metric === "costo" ? celda?.costo : celda?.publico);

  const hayPublico = resumen.chPub > 0 || resumen.jzPub > 0;

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="eyebrow">{metric === "costo" ? "Costos por región" : "Precio público por región"}</p>
        <div className="flex gap-2">
          {[["costo", "Costos"], ["publico", "Precio público"]].map(([k, txt]) => (
            <button
              key={k}
              onClick={() => setMetric(k)}
              className={`px-4 py-1.5 rounded-full font-label text-[12px] transition-colors ${
                metric === k
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
              }`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {metric === "publico" && !hayPublico && (
        <div className="mx-5 mb-3 rounded-xl border border-dashed border-[var(--outline-variant)] px-4 py-3 text-sm text-[var(--on-surface-variant)]">
          Aún no hay precios públicos cargados. Sube la lista con la opción <b>Precio público</b> arriba.
        </div>
      )}

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="bg-[var(--surface-container-low)] sticky top-0">
            <tr className="font-label text-[11px] uppercase tracking-wider text-[var(--on-surface-variant)]">
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Tamaño</th>
              <th className="px-4 py-3 font-medium text-right">Chihuahua</th>
              <th className="px-4 py-3 font-medium text-right">Juárez</th>
            </tr>
          </thead>
          <tbody className="text-sm text-[var(--on-surface)]">
            {filas.map((f, i) => {
              const ch = val(f.CHIHUAHUA);
              const jz = val(f.JUAREZ);
              const iguales = ch != null && ch === jz;
              return (
                <tr key={i} className="border-t border-[var(--outline-variant)]/60 hover:bg-[var(--surface-container-low)]/50">
                  <td className="px-4 py-2.5">{f.producto}</td>
                  <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{f.tamano === "GD" ? "Grande" : "Chico"}</td>
                  <td className="px-4 py-2.5 text-right tnum">{pesos(ch)}</td>
                  <td className={`px-4 py-2.5 text-right tnum ${iguales ? "text-[var(--muted-soft)]" : ""}`}>{pesos(jz)}</td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Aún no hay precios cargados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
