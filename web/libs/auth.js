import { createClient } from "@/libs/supabase/server";

// Mantiene la MISMA interfaz que usaba NextAuth: auth() -> { user } | null.
// Asi las rutas y layouts del servidor que hacen `const session = await auth()`
// siguen funcionando sin cambios. Por dentro ahora es Supabase.
export async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user } : null;
}
