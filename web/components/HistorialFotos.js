const fmtFecha = (iso) => { try { return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short" }).format(new Date(iso)); } catch { return "—"; } };
const fmtHora = (iso) => { try { return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)); } catch { return "—"; } };
const usuario = (email) => { if (!email) return "—"; const s = email.split("@")[0]; return s.replace(/\b\w/g, (c) => c.toUpperCase()); };

// Un check verde o una tacha gris según el estado.
function Estado({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${ok ? "text-[var(--primary)]" : "text-[var(--muted-soft)]"}`} title={label}>
      {ok ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M6 6l12 12M18 6 6 18" /></svg>
      )}
      {label}
    </span>
  );
}

export default function HistorialFotos({ fotos }) {
  if (!fotos?.length) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Aún no hay fotos subidas de esta sucursal.</p>;
  }

  return (
    <div className="overflow-x-auto max-h-[360px] overflow-y-auto -mx-1">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-[var(--surface-container-lowest)]">
          <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
            <th className="px-2 py-2 font-medium">Fecha</th>
            <th className="px-2 py-2 font-medium">Hora</th>
            <th className="px-2 py-2 font-medium">Usuario</th>
            <th className="px-2 py-2 font-medium">Estatus</th>
          </tr>
        </thead>
        <tbody className="text-[var(--on-surface)]">
          {fotos.map((f) => {
            const subida = true;
            const leida = !!f.leida;
            const guardada = (f.renglones ?? 0) > 0;
            return (
              <tr key={f.id} className="border-t border-[var(--outline-variant)]/60 align-top">
                <td className="px-2 py-2 whitespace-nowrap">{fmtFecha(f.creado_en)}</td>
                <td className="px-2 py-2 whitespace-nowrap text-[var(--on-surface-variant)]">{fmtHora(f.creado_en)}</td>
                <td className="px-2 py-2">{usuario(f.subido_por)}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-0.5">
                    <Estado ok={subida} label="Subida" />
                    <Estado ok={leida} label="Leída" />
                    <Estado ok={guardada} label={guardada ? `Guardada (${f.renglones})` : "Guardada"} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
