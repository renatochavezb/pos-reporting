-- Reversa del módulo dulce-noviembre-consolidado.
-- Esto NO es una migración: no se aplica con aplicar_sql.mjs. Es el archivo que Renato corre en
-- el SQL Editor de Supabase, a mano, si hay que dar marcha atrás al módulo.
--
-- LA REVERSA DEL MÓDULO ES: revertir el código (borrar la rama o revertir el merge) + correr
-- este archivo. No hace falta nada más.
--
-- ¿Por qué migracion_14_merma_costeada_campos.sql NO se revierte?
-- Esa migración solo agregó `insumo_norm` y `costo_confiable` al final de `merma_costeada` con
-- `create or replace view`. `create or replace view` no permite QUITAR columnas: la única forma
-- de dejar la vista exactamente como estaba antes sería `drop view merma_costeada cascade`.
-- Ese cascade tumbaría las cuatro vistas que dependen de `merma_costeada`
-- (`v_merma_diaria`, `v_merma_semanal`, `v_merma_por_producto`, `v_merma_por_tipo`) -- es decir,
-- el tablero por sucursal completo -- y habría que recrear las cinco vistas junto con sus
-- `grant` y su `security_invoker`, con una ventana en la que el tablero está roto.
-- Es más riesgoso revertir esa migración que dejarla, y dejarla no cuesta nada: dos columnas al
-- final de una vista son inertes para un tablero que nombra sus columnas explícitamente y nunca
-- hace `select *`. Por eso `migracion_14` se queda, a propósito, y esta reversa no la toca.
--
-- Ninguna migración de este módulo hizo `delete`, `update` ni `alter` sobre `merma`, `precios`,
-- `equivalencias`, `sucursal_region` ni `sync_estado`. Por lo tanto esta reversa tampoco toca
-- esas tablas: no hay riesgo de pérdida de datos en ningún punto de este archivo.
--
-- Los `drop` de abajo van SIN `cascade`, a propósito: si alguno falla por dependencia, es señal
-- de que quedó algo vivo colgado de esa vista o tabla y hay que revisarlo a mano, no forzarlo
-- con cascade.

-- =====================================================================
-- 1. Las diez vistas v_consolidado_*, en orden inverso a sus dependencias: primero las que
--    dependen de otras (v_consolidado_por_region y v_consolidado_cobertura dependen de
--    v_consolidado_regiones_espejo), y esa al final.
-- =====================================================================
drop view if exists v_consolidado_cobertura;
drop view if exists v_consolidado_por_region;
drop view if exists v_consolidado_costo_sospechoso;
drop view if exists v_consolidado_insumos_hueco;
drop view if exists v_consolidado_por_tipo;
drop view if exists v_consolidado_por_producto;
drop view if exists v_consolidado_aporte_semanal;
drop view if exists v_consolidado_semanal;
drop view if exists v_consolidado_diaria;
drop view if exists v_consolidado_regiones_espejo;

-- =====================================================================
-- 2. Las tres tablas del catálogo. Sin cascade.
-- =====================================================================
drop table if exists sucursales, regiones, configuracion;

-- =====================================================================
-- migracion_14_merma_costeada_campos.sql se queda, a propósito (ver encabezado de este
-- archivo). Ninguna migración de este módulo hizo delete, update ni alter sobre merma, precios,
-- equivalencias, sucursal_region ni sync_estado, así que no hay riesgo de pérdida de datos.
-- =====================================================================

notify pgrst, 'reload schema';
