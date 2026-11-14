// Instalación como aplicación de escritorio (PWA): Chrome y Edge muestran
// su propio diálogo y la aplicación queda con ícono y ventana propios.
import { useEffect, useState } from "react";

export function useInstalar() {
  const [aviso, setAviso] = useState(null);
  const [instalada, setInstalada] = useState(
    typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches,
  );

  useEffect(() => {
    const antes = (e) => { e.preventDefault(); setAviso(e); };
    const listo = () => { setInstalada(true); setAviso(null); };
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", listo);
    return () => {
      window.removeEventListener("beforeinstallprompt", antes);
      window.removeEventListener("appinstalled", listo);
    };
  }, []);

  const instalar = async () => {
    if (!aviso) return;
    aviso.prompt();
    await aviso.userChoice;
    setAviso(null);
  };

  return { puedeInstalar: !!aviso && !instalada, instalada, instalar };
}
