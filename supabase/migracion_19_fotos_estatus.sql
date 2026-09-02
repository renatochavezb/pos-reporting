-- Estatus de cada foto de bitácora: leída (transcrita) y renglones guardados.
alter table bitacora_fotos add column if not exists leida boolean;
alter table bitacora_fotos add column if not exists renglones int;
