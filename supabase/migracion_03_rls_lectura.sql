-- Migracion 03: lectura de merma para usuarios autenticados.
-- Por ahora todos los logueados ven toda la merma (piloto 1 sucursal).
-- Despues se cambia el USING para filtrar por la sucursal del usuario.

grant select on merma to authenticated;

drop policy if exists "merma_lectura_auth" on merma;
create policy "merma_lectura_auth" on merma
  for select to authenticated using (true);

-- las vistas respetan la RLS del usuario que consulta (no la saltan)
alter view v_merma_diaria          set (security_invoker = on);
alter view v_merma_por_producto    set (security_invoker = on);
alter view v_merma_por_motivo      set (security_invoker = on);
alter view v_merma_costo_sospechoso set (security_invoker = on);

grant select on v_merma_diaria, v_merma_por_producto,
                v_merma_por_motivo, v_merma_costo_sospechoso
  to authenticated;
