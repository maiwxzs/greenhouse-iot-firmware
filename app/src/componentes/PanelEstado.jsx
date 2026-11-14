import { LuBellOff, LuClock, LuShowerHead } from "react-icons/lu";
import { textoEstado } from "../lib/protocolo.js";

export default function PanelEstado({ t, modo, enviar }) {
  const e = t ? textoEstado(t.estado) : modo === "desconectado"
    ? { titulo: "Sin conexión", detalle: "Conecta el Arduino por USB o abre la demostración para ver el invernadero en funcionamiento.", tono: "neutro" }
    : { titulo: "Conectando…", detalle: "El Arduino se reinicia al abrir el puerto; las lecturas llegan en unos segundos.", tono: "neutro" };
  const activo = modo !== "desconectado";
  return (
    <div className="estado">
      <span className="etiqueta">Estado del invernadero</span>
      <h2 data-tono={e.tono} aria-live="polite">{e.titulo}</h2>
      <p className="detalle">{e.detalle}{t?.alarma === 2 ? " La alarma está silenciada." : ""}</p>
      {t && (
        <div className="reloj">
          <LuClock aria-hidden="true" />
          <b>{t.hora?.slice(0, 5)}</b>
          <small>{t.hora_sync ? "hora del invernadero, sincronizada" : "reloj sin sincronizar"}</small>
        </div>
      )}
      <div className="acciones">
        <button className="boton agua" type="button" disabled={!activo || t?.agua === 0} onClick={() => enviar("RIEGO")}>
          <LuShowerHead /> Regar ahora
        </button>
        <button className="boton sec" type="button" disabled={!activo || t?.alarma !== 1} onClick={() => enviar("SILENCIO")}>
          <LuBellOff /> Silenciar alarma
        </button>
      </div>
    </div>
  );
}
