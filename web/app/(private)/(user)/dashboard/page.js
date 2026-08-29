import { createClient } from "@/libs/supabase/server";
import ButtonAccount from "@/components/ButtonAccount";
import Sidebar from "@/components/Sidebar";
import DashboardCiudades from "@/components/DashboardCiudades";

export const dynamic = "force-dynamic";

export default async function DashboardMerma() {
  const supabase = await createClient();

  const [{ data: bit }, { data: regs }] = await Promise.all([
    supabase.from("bitacora_merma").select("sucursal,fecha,cantidad,motivo_tipo,importe_costo,precio_publico"),
    supabase.from("sucursal_region").select("sucursal,region"),
  ]);

  const regionDe = Object.fromEntries((regs || []).map((r) => [r.sucursal, r.region]));

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1100px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Reportes internos</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">Merma por ciudad</h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              <p className="text-sm text-[var(--on-surface-variant)] mt-4">
                Totales según la <b>bitácora de sucursal</b> (lo anotado a mano). Elige una semana o un rango; clic en una sucursal para ver el detalle.
              </p>
            </div>
            <ButtonAccount />
          </div>

          <DashboardCiudades rows={bit || []} regionDe={regionDe} />

          <p className="text-xs text-[var(--on-surface-variant)] border-t border-[var(--outline-variant)] pt-4">
            El detalle por semana, día y producto de cada sucursal está en <b>Merma NVO</b>.
          </p>
        </div>
      </main>
    </div>
  );
}
