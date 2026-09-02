-- Diccionario de alias de bitácora: "lo que escriben" -> producto del catálogo.
-- Editable por el admin desde Ajustes; lo usa la transcripción para no confundir.
create table if not exists alias_bitacora (
  id            bigserial primary key,
  texto         text not null,        -- lo que se escribe (se compara normalizado)
  producto_norm text not null,        -- producto del catálogo al que mapea
  tamano        text,                 -- 'GD' | 'CH' | null (cualquiera)
  region        text,                 -- 'CHIHUAHUA' | 'JUAREZ' | null (ambas)
  creado_en     timestamptz default now()
);
create unique index if not exists alias_bitacora_uq on alias_bitacora (lower(texto), coalesce(region, ''));

alter table alias_bitacora enable row level security;
grant select, insert, update, delete on alias_bitacora to authenticated;
grant usage, select on sequence alias_bitacora_id_seq to authenticated;

-- Todos los autenticados pueden LEER (la transcripción los necesita).
drop policy if exists alias_lectura on alias_bitacora;
create policy alias_lectura on alias_bitacora for select to authenticated using (true);
-- Solo el admin puede escribir.
drop policy if exists alias_admin_write on alias_bitacora;
create policy alias_admin_write on alias_bitacora for all to authenticated
  using (auth.jwt() ->> 'email' = 'renato.chavezb@gmail.com')
  with check (auth.jwt() ->> 'email' = 'renato.chavezb@gmail.com');
