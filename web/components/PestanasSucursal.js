import Link from "next/link";
import { CENTINELA } from "@/libs/consolidado";

// Fila de pestañas: "Toda la cadena" (centinela) siempre primero, luego una por sucursal
// con datos. El texto visible es siempre el nombre para mostrar (`nombre_display`); la URL
// siempre lleva el nombre canónico, para no romper enlaces ya guardados.
export default function PestanasSucursal({ sucursales, mapaDisplay, actual }) {
  const pestanas = [
    { canonico: CENTINELA, display: "Toda la cadena" },
    ...(sucursales || []).map((s) => ({ canonico: s, display: mapaDisplay?.[s] || s })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mt-2">
      {pestanas.map((p) => (
        <Link
          key={p.canonico}
          href={`/dashboard?sucursal=${encodeURIComponent(p.canonico)}`}
          className={`px-4 py-1.5 rounded-full font-label text-[12px] whitespace-nowrap transition-colors ${
            p.canonico === actual
              ? "bg-[var(--primary)] text-[var(--on-primary)]"
              : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
          }`}
        >
          {p.display}
        </Link>
      ))}
    </div>
  );
}
