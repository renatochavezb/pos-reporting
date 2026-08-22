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
      <Popover.Button className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container-low)] transition-colors outline-none">
        <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center text-sm font-semibold">
          {inicial}
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[var(--on-surface-variant)]">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
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
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd" />
            </svg>
            Cerrar sesión
          </button>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
