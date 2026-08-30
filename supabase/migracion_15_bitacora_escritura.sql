-- Permitir que la app (usuario autenticado) escriba la bitácora transcrita.
grant insert, delete, update on bitacora_merma to authenticated;
grant usage, select on sequence bitacora_merma_id_seq to authenticated;
drop policy if exists bitacora_insert on bitacora_merma;
create policy bitacora_insert on bitacora_merma for insert to authenticated with check (true);
drop policy if exists bitacora_delete on bitacora_merma;
create policy bitacora_delete on bitacora_merma for delete to authenticated using (true);
