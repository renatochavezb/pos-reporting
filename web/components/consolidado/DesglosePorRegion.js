import { pesos, piezas, regionTexto } from "@/libs/formato";

// Pesos y piezas por región de `v_consolidado_por_region`, incluida la región nula como su
// propio grupo -- nunca fundida en una región real. Es "todo el periodo" (igual que la
// Clasificación por motivo de más abajo), no solo la semana en curso: la vista no lleva
// filtro de fecha. `pesos()` ya devuelve "—" para la región nula: sus filas siempre traen
// `importe_costo` nulo porque sin región no hay con qué unir `precios`.
export default function DesglosePorRegion({ regiones }) {
  const filas = [...(regiones || [])].sort((a, b) => {
    if ((a.region == null) !== (b.region == null)) return a.region == null ? 1 : -1;
    return regionTexto(a.region).localeCompare(regionTexto(b.region));
  });

  const totalPiezas = filas.reduce((acc, r) => acc + Number(r.piezas || 0), 0);
  const totalPesos = filas.reduce((acc, r) => acc + Number(r.pesos || 0), 0);

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="eyebrow">Desglose por región · todo el periodo</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="font-label text-[11px] uppercase tracking-wider text-[var(--on-surface-variant)]">
              <th className="px-4 py-2 font-medium">Región</th>
              <th className="px-4 py-2 font-medium text-right">Sucursales</th>
              <th className="px-4 py-2 font-medium text-right">Piezas</th>
              <th className="px-4 py-2 font-medium text-right">Pesos</th>
            </tr>
          </thead>
          <tbody className="text-sm text-[var(--on-surface)]">
            {filas.map((r) => (
              <tr key={r.region ?? "sin-region"} className="border-t border-[var(--outline-variant)]/60">
                <td className="px-4 py-2.5 font-medium">
                  {regionTexto(r.region)}
                  {r.costos_provisionales && (
                    <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-[var(--primary-container)] text-[var(--on-primary-container)]">
                      costos provisionales
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tnum">{r.n_sucursales}</td>
                <td className="px-4 py-2.5 text-right tnum">{piezas(r.piezas)} pz</td>
                <td className="px-4 py-2.5 text-right tnum">{pesos(r.pesos)}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-[var(--on-surface-variant)]">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--outline-variant)] font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right tnum">{piezas(totalPiezas)} pz</td>
                <td className="px-4 py-3 text-right tnum">{pesos(totalPesos)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
