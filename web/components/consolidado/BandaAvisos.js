// Estilos por tipo de aviso, usando solo variables que ya existe en el proyecto: error ->
// var(--error); advertencia -> on-primary-container sobre primary-container (mismo par que
// LineaCobertura); acción -> var(--primary) (el mismo color que ya usa el aviso "Sin precio en
// tu lista" en dashboard/page.js); informativo -> var(--on-surface-variant).
const ESTILO = {
  error: { rotulo: "Atención", pill: "text-[var(--error)] border border-[var(--error)]/40" },
  advertencia: {
    rotulo: "Advertencia",
    pill: "bg-[var(--primary-container)] text-[var(--on-primary-container)]",
  },
  accion: { rotulo: "Acción", pill: "text-[var(--primary)] border border-[var(--primary)]/40" },
  informativo: {
    rotulo: "Info",
    pill: "text-[var(--on-surface-variant)] border border-[var(--outline-variant)]",
  },
};

// Banda de avisos del consolidado. Cada aviso llega ya armado por `construirAvisos` a partir
// de datos reales -- este componente solo ordena (ya viene ordenado por gravedad) y pinta lo
// que recibió. No decide nada de negocio ni nombra sucursales por su cuenta.
export default function BandaAvisos({ avisos }) {
  const filas = avisos || [];
  if (filas.length === 0) return null;

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] px-5 py-4 flex flex-col gap-3">
      <p className="eyebrow">Avisos de conciliación</p>
      {filas.map((a, i) => {
        const estilo = ESTILO[a.tipo] || ESTILO.informativo;
        return (
          <div key={i} className="flex items-start gap-3">
            <span
              className={`shrink-0 font-label text-[11px] uppercase tracking-wider rounded-full px-2 py-0.5 ${estilo.pill}`}
            >
              {estilo.rotulo}
            </span>
            <p className="text-sm text-[var(--on-surface)]">
              {a.texto}
              {a.href && (
                <>
                  {" "}
                  <a href={a.href} className="text-[var(--primary)] underline">
                    Ir a Precios
                  </a>
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
