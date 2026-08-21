-- columna normalizada del insumo (para cruzar con equivalencias) y precio de venta
alter table merma   add column if not exists insumo_norm text;
alter table precios add column if not exists precio_venta numeric(18,2);
