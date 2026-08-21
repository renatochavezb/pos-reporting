-- Sucursales que SÍ tienen datos de merma (para el selector del dashboard).
create or replace view v_sucursales_merma
with (security_invoker = on) as
select distinct sucursal from merma order by sucursal;
grant select on v_sucursales_merma to authenticated;

-- limpiar entradas basura de sync_estado (nombres de alias por errores de conexión)
delete from sync_estado
where tabla = 'merma'
  and sucursal not in (select sucursal from merma);
