-- Usuarios por sucursal + almacenamiento de fotos de bitácora.

-- 1) Accesos de sucursales (copia legible de usuario/contraseña).
--    Solo el administrador puede leerla (RLS por correo). Las escrituras
--    se hacen con la service_role key (que salta RLS) o desde scripts.
create table if not exists sucursal_accesos (
  sucursal        text primary key,
  usuario         text not null,          -- lo que teclea el encargado (slug del nombre)
  email           text not null,          -- correo interno real (invisible para el encargado)
  password_plano  text not null,          -- copia legible para mostrar en Ajustes
  actualizado_en  timestamptz default now()
);
alter table sucursal_accesos enable row level security;
grant select on sucursal_accesos to authenticated;
drop policy if exists accesos_admin_read on sucursal_accesos;
create policy accesos_admin_read on sucursal_accesos for select to authenticated
  using (auth.jwt() ->> 'email' = 'renato.chavezb@gmail.com');

-- 2) Fotos de bitácora subidas (ligadas a sucursal + fecha).
create table if not exists bitacora_fotos (
  id            bigserial primary key,
  sucursal      text not null,
  fecha         date not null,
  storage_path  text not null,            -- ruta dentro del bucket 'bitacoras'
  subido_por    text,
  creado_en     timestamptz default now()
);
alter table bitacora_fotos enable row level security;
grant select, insert on bitacora_fotos to authenticated;
grant usage, select on sequence bitacora_fotos_id_seq to authenticated;
drop policy if exists fotos_lectura on bitacora_fotos;
create policy fotos_lectura on bitacora_fotos for select to authenticated using (true);
drop policy if exists fotos_insert on bitacora_fotos;
create policy fotos_insert on bitacora_fotos for insert to authenticated with check (true);

-- 3) Bucket privado para las fotos + permisos para usuarios autenticados.
insert into storage.buckets (id, name, public)
  values ('bitacoras', 'bitacoras', false)
  on conflict (id) do nothing;
drop policy if exists bitacoras_insert on storage.objects;
create policy bitacoras_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'bitacoras');
drop policy if exists bitacoras_select on storage.objects;
create policy bitacoras_select on storage.objects for select to authenticated
  using (bucket_id = 'bitacoras');
