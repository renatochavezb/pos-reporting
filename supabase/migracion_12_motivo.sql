alter table merma add column if not exists motivo_tipo text;   -- caducidad | daño | cortesia | otro
alter table merma add column if not exists fecha_merma  date;  -- fecha real (del comentario si viene, si no la de captura)
