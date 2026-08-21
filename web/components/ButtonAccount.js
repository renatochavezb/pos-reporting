"use client";

import { useEffect, useState } from "react";
import { Popover, Transition } from "@headlessui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";

export default function ButtonAccount() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const s = createClient();
    s.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const salir = async () => {
    const s = createClient();
    await s.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!user) return null;
  const inicial = (user.email?.[0] || "U").toUpperCase();

  return (
    <Popover className="relative">
      <Popover.Button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)] transition-colors outline-none">
        <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center font-label text-sm">
          {inicial}
        </span>
        <span className="material-symbols-outlined text-[var(--on-surface-variant)] text-[20px]">expand_more</span>
      </Popover.Button>
      <Transition
        enter="transition duration-100 ease-out" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
        leave="transition duration-75 ease-in" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
      >
        <Popover.Panel className="absolute right-0 mt-2 w-60 rounded-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] ambient-shadow-md p-2 z-50">
          <div className="px-3 py-2 border-b border-[var(--outline-variant)] mb-1">
            <p className="text-xs text-[var(--on-surface-variant)]">Sesión</p>
            <p className="text-sm font-medium text-[var(--on-surface)] truncate">{user.email}</p>
          </div>
          <button
            onClick={salir}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Cerrar sesión
          </button>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
