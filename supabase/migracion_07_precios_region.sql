-- Rediseño de precios: por REGION (Chihuahua/Juarez) x PRODUCTO x TAMANO.
-- Son COSTOS de compra. Producto identificado por nombre (no hay codigo).
drop table if exists precios cascade;
create table precios (
  region          text not null,          -- CHIHUAHUA | JUAREZ
  producto        text not null,          -- nombre tal cual del archivo
  producto_norm   text not null,          -- normalizado (para cruzar con la merma)
  tamano          text not null,          -- CH | GD
  costo           numeric(18,2),
  actualizado_en  timestamptz not null default now(),
  primary key (region, producto_norm, tamano)
);
create index if not exists ix_precios_norm on precios (producto_norm);

alter table precios enable row level security;
grant select, insert, update, delete on precios to authenticated;
drop policy if exists precios_todo_auth on precios;
create policy precios_todo_auth on precios for all to authenticated using (true) with check (true);

-- mapa sucursal -> region (Juarez: Misiones/JUAREZ 3, Torres, Lopez, Valle; resto Chihuahua)
create table if not exists sucursal_region (
  sucursal text primary key,
  region   text not null
);
alter table sucursal_region enable row level security;
grant select on sucursal_region to authenticated;
drop policy if exists sucreg_lectura on sucursal_region;
create policy sucreg_lectura on sucursal_region for select to authenticated using (true);

insert into sucursal_region (sucursal, region) values
  ('FUENTES MARES','CHIHUAHUA'),
  ('JUAREZ 3','JUAREZ')
on conflict (sucursal) do update set region = excluded.region;
