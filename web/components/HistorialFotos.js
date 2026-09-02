"use client";

import { useState } from "react";

const fCorta = (iso) => { try { return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00")); } catch { return iso; } };

export default function HistorialFotos({ fotos }) {
  const [zoom, setZoom] = useState(null);

  if (!fotos?.length) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Aún no hay fotos subidas de esta sucursal.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
        {fotos.map((f) => (
          <div key={f.id} className="rounded-xl overflow-hidden border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
            {f.url ? (
              <img src={f.url} alt="" className="w-full h-24 object-cover cursor-zoom-in" onClick={() => setZoom(f.url)} />
            ) : (
              <div className="w-full h-24 grid place-items-center text-[11px] text-[var(--on-surface-variant)]">sin vista</div>
            )}
            <p className="text-[11px] text-center text-[var(--on-surface-variant)] py-1">{fCorta(f.fecha)}</p>
          </div>
        ))}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  );
}
