import { createClient } from "@supabase/supabase-js";

// Cliente administrador de Supabase (usa la SERVICE ROLE key).
// SOLO debe usarse en el servidor (rutas API), NUNCA en el navegador,
// porque la service_role key salta la seguridad (RLS) por completo.
// Devuelve null si falta la llave, para poder mostrar un aviso amable.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
