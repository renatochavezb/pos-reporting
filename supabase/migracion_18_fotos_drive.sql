-- Guardar fotos en Google Drive: además de la ruta de Storage, registramos
-- el id de Drive y el origen para saber de dónde servir la imagen.
alter table bitacora_fotos add column if not exists drive_id text;
alter table bitacora_fotos add column if not exists origen text default 'supabase';
alter table bitacora_fotos alter column storage_path drop not null;
