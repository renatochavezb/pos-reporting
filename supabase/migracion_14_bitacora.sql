-- Bitácora manual: lo que el personal anota a mano en la sucursal.
-- Misma forma que merma_costeada para poder mostrarla en la MISMA vista.
create table if not exists bitacora_merma (
  id            bigserial primary key,
  sucursal      text not null,
  fecha         date not null,          -- día real (caducidad/daño) que dice la bitácora
  insumo        text not null,
  cantidad      numeric not null default 1,
  motivo_tipo   text,                   -- caducidad | daño
  importe_costo numeric,                -- costo total del renglón
  precio_publico numeric,               -- precio público unitario
  origen        text default 'bitacora',
  creado_en     timestamptz default now()
);
alter table bitacora_merma enable row level security;
grant select on bitacora_merma to authenticated;
drop policy if exists bitacora_lectura on bitacora_merma;
create policy bitacora_lectura on bitacora_merma for select to authenticated using (true);
