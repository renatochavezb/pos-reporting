-- Lista de precios propia (se sube desde el dashboard).
-- clave = codigo del insumo si viene en el archivo; si no, el nombre normalizado.
create table if not exists precios (
  clave           text primary key,
  no_insumo       text,
  nombre          text,
  costo_compra    numeric(18,2),   -- costo de compra
  precio_venta    numeric(18,2),   -- precio de venta al publico
  actualizado_en  timestamptz not null default now()
);

-- registro de cada carga de archivo (para mostrar "ultima carga")
create table if not exists precios_cargas (
  id          bigint generated always as identity primary key,
  archivo     text,
  filas       integer,
  cargado_en  timestamptz not null default now(),
  cargado_por text
);

alter table precios        enable row level security;
alter table precios_cargas enable row level security;

-- usuarios autenticados pueden leer y administrar la lista de precios
grant select, insert, update, delete on precios to authenticated;
grant select, insert on precios_cargas to authenticated;
grant usage, select on sequence precios_cargas_id_seq to authenticated;

drop policy if exists precios_todo_auth on precios;
create policy precios_todo_auth on precios
  for all to authenticated using (true) with check (true);

drop policy if exists cargas_lectura_auth on precios_cargas;
create policy cargas_lectura_auth on precios_cargas
  for select to authenticated using (true);
drop policy if exists cargas_insert_auth on precios_cargas;
create policy cargas_insert_auth on precios_cargas
  for insert to authenticated with check (true);
