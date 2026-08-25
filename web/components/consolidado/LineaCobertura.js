// Reemplaza, solo en modo cadena, la línea "Actualizado {fecha} · N movimientos" que sigue
// existiendo tal cual en la vista de una sucursal. Dice cuántas de cuántas sucursales
// aportan al total que se ve arriba, y avisa si hay sucursales sin sincronizar o sin región
// -- sin que ninguno de los dos avisos invente un denominador que no se pueda sostener.
export default function LineaCobertura({ n, m, cobertura }) {
  const filas = cobertura || [];
  // Solo cuentan las sucursales relevantes para el total: las del padrón y las que ya
  // mandan datos (una sucursal fuera del padrón pero con datos también debe poder avisar).
  const relevantes = filas.filter((r) => r.en_padron || r.con_datos);
  const sinSincronizar = relevantes.filter(
    (r) => r.estatus_sync === "error" || r.sin_corrida_reciente || r.nunca_sincronizada
  ).length;
  const sinRegion = relevantes.filter((r) => !r.tiene_region).length;

  const texto =
    m != null
      ? `${n ?? 0} de ${m} sucursales aportan a este total`
      : `${n ?? 0} sucursales aportan a este total (padrón no configurado)`;

  return (
    <div className="mt-4">
      <p className="text-sm text-[var(--on-surface-variant)]">{texto}</p>
      {(sinSincronizar > 0 || sinRegion > 0) && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {sinSincronizar > 0 && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-[var(--primary-container)] text-[var(--on-primary-container)]">
              {sinSincronizar} sin sincronizar
            </span>
          )}
          {sinRegion > 0 && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-[var(--primary-container)] text-[var(--on-primary-container)]">
              {sinRegion} sin región
            </span>
          )}
        </div>
      )}
    </div>
  );
}
