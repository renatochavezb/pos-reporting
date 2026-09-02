const fmtFecha = (iso) => { try { return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)); } catch { return "—"; } };
const fmtHora = (iso) => { try { return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)); } catch { return "—"; } };
const usuario = (email) => { if (!email) return "—"; const s = email.split("@")[0]; return s.replace(/\b\w/g, (c) => c.toUpperCase()); };

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
          </tr>
        </thead>
        <tbody className="text-[var(--on-surface)]">
          {fotos.map((f) => (
            <tr key={f.id} className="border-t border-[var(--outline-variant)]/60">
              <td className="px-2 py-2 whitespace-nowrap">{fmtFecha(f.creado_en)}</td>
              <td className="px-2 py-2 whitespace-nowrap text-[var(--on-surface-variant)]">{fmtHora(f.creado_en)}</td>
              <td className="px-2 py-2">{usuario(f.subido_por)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
