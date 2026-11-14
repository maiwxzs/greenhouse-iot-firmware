import { useState } from "react";
import { LuBell, LuCircleAlert, LuFan, LuDroplets, LuGlassWater, LuPlugZap, LuSend, LuShowerHead, LuThermometer, LuActivity } from "react-icons/lu";
import { formatoFecha } from "./Grafica.jsx";

const ICONOS = {
  estado: LuActivity, riego: LuShowerHead, ventilador: LuFan, aire: LuDroplets, alarma: LuBell,
  tanque: LuGlassWater, sensor: LuThermometer, conexion: LuPlugZap, comando: LuSend, error: LuCircleAlert,
};
const FILTROS = [["todos", "Todos"], ["estado", "Estados"], ["riego", "Riegos"], ["ventilador", "Ventilador"], ["aire", "Aire"],
  ["alarma", "Alarmas"], ["comando", "Comandos"], ["conexion", "Conexión"]];

export default function Eventos({ eventos, nuevos }) {
  const [filtro, setFiltro] = useState("todos");
  const lista = eventos.filter((e) => filtro === "todos" || e.tipo === filtro || (filtro === "alarma" && ["tanque", "sensor", "error"].includes(e.tipo)));
  return (
    <div>
      <div className="cabecera">
        <div className="filtros" role="group" aria-label="Filtrar eventos">
          {FILTROS.map(([f, txt]) => <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{txt}</button>)}
        </div>
        <span className="nota" style={{ color: "var(--tinta-3)", fontSize: ".82rem" }}>Últimos {eventos.length} eventos, guardados en este computador</span>
      </div>
      {!lista.length ? <p className="vacio">No hay eventos de este tipo todavía.</p> : (
        <ul className="linea-tiempo">
          {lista.map((e) => {
            const Icono = ICONOS[e.tipo] || LuActivity;
            return (
              <li key={`${e.t}-${e.tipo}-${e.texto}`} className={nuevos.has(e) ? "nuevo" : ""}>
                <time dateTime={new Date(e.t).toISOString()}>{formatoFecha(e.t)}</time>
                <span className="icono-evento" data-tono={e.tono}><Icono /></span>
                <span>{e.texto}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
