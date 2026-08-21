"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/libs/supabase/client";
import config from "@/config";

// Boton simple: si hay sesion, muestra el correo y lleva al dashboard;
// si no, lleva a la pantalla de login.
const ButtonSignin = ({ text = "Iniciar sesión", extraStyle }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  if (user) {
    return (
      <Link href={config.auth.callbackUrl} className={`btn ${extraStyle || ""}`}>
        <span className="w-6 h-6 bg-base-300 flex justify-center items-center rounded-full shrink-0">
          {(user.email?.[0] || "U").toUpperCase()}
        </span>
        {user.email}
      </Link>
    );
  }

  return (
    <Link href={config.auth.loginUrl} className={`btn ${extraStyle || ""}`}>
      {text}
    </Link>
  );
};

export default ButtonSignin;
