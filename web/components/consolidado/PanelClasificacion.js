import { piezas } from "@/libs/formato";

// Hito 6 (F17/D10) — panel de clasificación por motivo, SOLO para el consolidado. El panel de
// la vista individual (en dashboard/page.js) no se toca: sigue mostrando fijas caducidad/daño/
// sin clasificar, que es correcto ahí porque una sola sucursal casi nunca tiene cortesía u otro
// todavía. Este panel, en cambio, muestra TODAS las clases presentes en `v_consolidado_por_tipo`
// -- incluidas "cortesía" y "otro", que `clasificarMotivo` sí produce (ver contexto/negocio.md)
// y que el panel viejo escondía por tener una lista fija de 3.
//
// Regla de la suma: se renderiza una tarjeta por cada fila con piezas != 0 (una fila con 0
// piezas, si llegara a existir, se omite sin afectar el total porque aporta 0). No se filtra
// por un catálogo fijo de nombres de clase: así la suma de las tarjetas visibles es SIEMPRE
// exactamente igual a la suma de todas las filas de `tipos`, incluso si algún día aparece una
// quinta o sexta clase que hoy no tiene icono propio (cae al icono genérico "•").
const ICONOS = {
  caducidad: "⏳",
  daño: "💥",
  cortesía: "🎁",
  otro: "📦",
  "sin clasificar": "❓",
};

export default function PanelClasificacion({ tipos, cobertura }) {
  const filas = (tipos || []).filter((t) => Number(t.piezas || 0) !== 0);
  const nSucursales = (cobertura || []).filter((c) => c.con_datos).length;

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-4">
      <p className="eyebrow mb-1">Clasificación de la merma · todo el periodo</p>
      <p className="text-xs text-[var(--on-surface-variant)] mb-3">
        Con datos de {nSucursales} sucursal{nSucursales === 1 ? "" : "es"}.
      </p>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {filas.map((t) => (
          <div key={t.tipo} className="flex items-center gap-3">
            <span className="text-xl">{ICONOS[t.tipo] || "•"}</span>
            <div>
              <p className="eyebrow">{t.tipo}</p>
              <p className="font-headline text-2xl text-[var(--on-surface)] leading-none mt-1">
                {piezas(t.piezas)} <span className="text-sm text-[var(--on-surface-variant)]">pz</span>
              </p>
            </div>
          </div>
        ))}
        {filas.length === 0 && <p className="text-sm text-[var(--on-surface-variant)]">Sin datos</p>}
      </div>
      <p className="text-xs text-[var(--on-surface-variant)] mt-4">
        Se toma del comentario del POS. Si trae fecha (ej. &quot;DAÑO 21/08/2026&quot;), la merma se asigna a ese día.
      </p>
    </div>
  );
}
