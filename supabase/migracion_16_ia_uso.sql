-- Registro del uso (y costo) de la IA para procesar bitácoras.
create table if not exists ia_uso (
  id            bigserial primary key,
  creado_en     timestamptz default now(),
  sucursal      text,
  modelo        text,
  input_tokens  int,
  output_tokens int,
  costo_usd     numeric
);
alter table ia_uso enable row level security;
grant select, insert on ia_uso to authenticated;
grant usage, select on sequence ia_uso_id_seq to authenticated;
drop policy if exists ia_uso_sel on ia_uso;
create policy ia_uso_sel on ia_uso for select to authenticated using (true);
drop policy if exists ia_uso_ins on ia_uso;
create policy ia_uso_ins on ia_uso for insert to authenticated with check (true);
