import { pesos, piezas, fechaHora, regionTexto } from "@/libs/formato";

// La tabla que vuelve auditable el número del héroe: una fila por sucursal del padrón (y
// también las que ya mandan datos aunque no estén en el padrón todavía, F18), con el periodo
// exacto de la semana en curso -- el mismo que usa el héroe.
//
// La columna de pesos usa SIEMPRE `pesos` (2 decimales), NUNCA `pesos0`: con enteros
// redondeados la columna puede no sumar el total visible por unos pesos y el módulo parecería
// descuadrado sin estarlo. El indicador de cuadre al pie compara CENTAVOS ENTEROS contra el
// héroe de la semana en curso (Math.round(x * 100)), nunca floats.
export default function AportePorSucursal({ cobertura, aporte, heroPesos, heroPiezas }) {
  const filas = cobertura || [];
  const mapaAporte = new Map((aporte || []).map((a) => [a.sucursal, a]));

  const rows = filas.map((c) => {
    const a = mapaAporte.get(c.sucursal) || null;
    const sinDatos = a == null;
    const piezasPeriodo = Number(a?.piezas || 0);
    const pesosPeriodo = a && a.pesos != null ? Number(a.pesos) : null;
    // Rule 4: piezas > 0 y pesos nulos -> "no valorizada" (no confundir con "sin datos": aquí
    // sí hubo movimiento en el periodo, pero ninguno se pudo costear).
    const noValorizada = !sinDatos && piezasPeriodo > 0 && pesosPeriodo == null;

    const etiquetas = [];
    if (!c.en_padron) etiquetas.push("fuera del padrón");
    if (c.nunca_sincronizada) etiquetas.push("nunca sincronizada");
    else if (c.estatus_sync === "error" || c.sin_corrida_reciente) etiquetas.push("sync con error");
    if (!c.tiene_region) etiquetas.push("sin región");
    else if (!c.tiene_precios_en_su_region) etiquetas.push("sin precios en su región");
    if (c.costos_provisionales) etiquetas.push("costos provisionales");
    if (sinDatos) etiquetas.push("sin datos en el periodo");
    if (noValorizada) etiquetas.push("no valorizada");

    return {
      sucursal: c.sucursal,
      nombreDisplay: c.nombre_display,
      region: c.region,
      piezasPeriodo,
      pesosPeriodo,
      ultimaCorrida: c.ultima_corrida,
      estatusSync: c.nunca_sincronizada ? "sin sync" : c.estatus_sync || "—",
      etiquetas,
    };
  });

  const sumaPiezas = rows.reduce((acc, r) => acc + r.piezasPeriodo, 0);
  const sumaPesos = rows.reduce((acc, r) => acc + (r.pesosPeriodo || 0), 0);
  const hPesos = Number(heroPesos || 0);
  const hPiezas = Number(heroPiezas || 0);

  const cuadraPesos = Math.round(sumaPesos * 100) === Math.round(hPesos * 100);
  const cuadraPiezas = Math.round(sumaPiezas) === Math.round(hPiezas);

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <p className="eyebrow">Aporte por sucursal · semana en curso</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="font-label text-[11px] uppercase tracking-wider text-[var(--on-surface-variant)]">
              <th className="px-4 py-2 font-medium">Sucursal</th>
              <th className="px-4 py-2 font-medium">Región</th>
              <th className="px-4 py-2 font-medium text-right">Piezas</th>
              <th className="px-4 py-2 font-medium text-right">Pesos</th>
              <th className="px-4 py-2 font-medium text-right">% del total</th>
              <th className="px-4 py-2 font-medium">Última corrida</th>
              <th className="px-4 py-2 font-medium">Estatus</th>
              <th className="px-4 py-2 font-medium">Aviso</th>
            </tr>
          </thead>
          <tbody className="text-sm text-[var(--on-surface)]">
            {rows.map((r) => {
              const pct = r.pesosPeriodo != null && hPesos > 0 ? (r.pesosPeriodo / hPesos) * 100 : null;
              return (
                <tr key={r.sucursal} className="border-t border-[var(--outline-variant)]/60">
                  <td className="px-4 py-2.5 font-medium">{r.nombreDisplay}</td>
                  <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{regionTexto(r.region)}</td>
                  <td className="px-4 py-2.5 text-right tnum">{piezas(r.piezasPeriodo)} pz</td>
                  <td className="px-4 py-2.5 text-right tnum">{pesos(r.pesosPeriodo)}</td>
                  <td className="px-4 py-2.5 text-right tnum text-[var(--on-surface-variant)]">
                    {pct != null ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{fechaHora(r.ultimaCorrida)}</td>
                  <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{r.estatusSync}</td>
                  <td className="px-4 py-2.5">
                    {r.etiquetas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.etiquetas.map((e) => (
                          <span
                            key={e}
                            className="text-xs rounded-full px-2 py-0.5 bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-[var(--on-surface-variant)]">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[var(--outline-variant)] font-semibold">
                <td className="px-4 py-3" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-3 text-right tnum">{piezas(sumaPiezas)} pz</td>
                <td className="px-4 py-3 text-right tnum">{pesos(sumaPesos)}</td>
                <td className="px-4 py-3" colSpan={4}></td>
              </tr>
              <tr>
                <td className="px-4 pb-3 text-xs" colSpan={8}>
                  <span className={cuadraPesos ? "text-[var(--on-surface-variant)]" : "text-[var(--error)]"}>
                    Pesos:{" "}
                    {cuadraPesos
                      ? "✓ cuadra con el total de la semana"
                      : `✗ difiere en ${pesos(Math.abs(sumaPesos - hPesos))}`}
                  </span>
                  <span className="mx-3 text-[var(--on-surface-variant)]">·</span>
                  <span className={cuadraPiezas ? "text-[var(--on-surface-variant)]" : "text-[var(--error)]"}>
                    Piezas:{" "}
                    {cuadraPiezas
                      ? "✓ cuadra con el total de la semana"
                      : `✗ difiere en ${Math.abs(Math.round(sumaPiezas) - Math.round(hPiezas))} pz`}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
