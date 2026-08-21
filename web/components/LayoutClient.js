"use client";

import NextTopLoader from "nextjs-toploader";
import { Toaster } from "react-hot-toast";
import { Tooltip } from "react-tooltip";
import config from "@/config";

// Envoltorios de cliente:
// 1. NextTopLoader: barra de progreso al navegar.
// 2. Toaster: mensajes de exito/error con toast().
// 3. Tooltip: tooltips en elementos con data-tooltip-id="tooltip".
const ClientLayout = ({ children }) => {
  return (
    <>
      <NextTopLoader color={config.colors.main} showSpinner={false} />
      {children}
      <Toaster toastOptions={{ duration: 3000 }} />
      <Tooltip id="tooltip" className="z-[60] !opacity-100 max-w-sm shadow-lg" />
    </>
  );
};

export default ClientLayout;
