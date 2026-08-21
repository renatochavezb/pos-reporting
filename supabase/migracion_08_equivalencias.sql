-- Mapa POS -> lista de precios (persistente). Se aplica a cada lista nueva.
create table if not exists equivalencias (
  insumo_norm     text primary key,   -- nombre del insumo del POS, normalizado
  insumo_ejemplo  text,               -- ejemplo tal cual aparece en el POS
  producto_norm   text,               -- llave del producto en 'precios' (null = sin equivalencia)
  tamano          text,               -- CH | GD
  actualizado_en  timestamptz not null default now()
);
alter table equivalencias enable row level security;
grant select, insert, update, delete on equivalencias to authenticated;
drop policy if exists equiv_todo_auth on equivalencias;
create policy equiv_todo_auth on equivalencias for all to authenticated using (true) with check (true);
