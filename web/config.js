const config = {
  appName: "Dulce Noviembre — Reportes",
  appDescription: "Reportes de ventas y merma de Dulce Noviembre.",
  domainName: "localhost",
  colors: {
    theme: "dark",
    main: "#FF671D",
  },
  auth: {
    // La landing (app/page.js) ES la pantalla de login.
    loginUrl: "/",
    callbackUrl: "/dashboard",
  },
};

export default config;
