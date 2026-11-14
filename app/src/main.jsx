import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./estilos.css";

createRoot(document.getElementById("raiz")).render(<StrictMode><App /></StrictMode>);

// Funcionamiento sin conexión e instalación como aplicación (solo servida por http/https)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
