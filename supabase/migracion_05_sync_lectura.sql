-- Permitir leer el estado de sincronizacion (ultima actualizacion) a usuarios autenticados.
grant select on sync_estado to authenticated;
drop policy if exists "sync_lectura_auth" on sync_estado;
create policy "sync_lectura_auth" on sync_estado
  for select to authenticated using (true);
