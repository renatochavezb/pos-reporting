# Crear el acceso de reportes — instrucciones para la sucursal

Esto se hace **una sola vez**, en la **PC de la sucursal** donde está el
servidor del POS (la de la caja principal / servidor). Toma 2 minutos.

Es exactamente lo mismo que ya hizo la persona que "entró sin contraseña":
abrir SSMS con la sesión de Windows. La diferencia es que además vamos a
dejar creada una cuenta de **solo lectura** para poder sacar los reportes
desde otra PC, sin volver a la sucursal.

No se borra ni se cambia nada del POS. La cuenta que se crea **solo puede
leer**.

## Pasos

1. En la PC del servidor, abrir **SQL Server Management Studio (SSMS)**.
   (Si no está instalado ahí, se puede hacer desde el propio SSMS de esa
   máquina, o instalarlo gratis. Avísame si no lo tienen y lo resolvemos.)

2. En la ventana de conexión:
   - **Server name:** el mismo servidor del POS (normalmente `.` o
     `localhost`, o el nombre de esa PC).
   - **Authentication:** **Windows Authentication** ← así, sin escribir
     contraseña.
   - Clic en **Connect**.

3. Abrir el archivo **`CREAR_USUARIO_REPORTES.sql`** (File → Open → File),
   o copiar y pegar su contenido en una ventana nueva de consulta.

4. **Cambiar una sola línea:** hasta arriba, donde dice
   `@pass = N'DulceNov_Reportes_2026!'`, poner una contraseña real.
   Anótala; la vamos a necesitar para conectarnos.

5. Presionar **F5** (o el botón **Execute**).
   Abajo, en la pestaña **Messages**, debe salir:
   ```
   1) Login reportes_ro CREADO.
   2) Usuario reportes_ro con SOLO LECTURA en la base SeattlePOS.
   === LISTO. Datos para la conexion remota: ===
   ```

6. Cerrar SSMS. **No hay que reiniciar nada.**

## Después

Con la contraseña que pusiste en el paso 4, ya nos conectamos desde la
otra PC por Hamachi. No hay que volver a la sucursal.

Si algo sale en rojo en el paso 5, manda la foto del mensaje y lo vemos.
