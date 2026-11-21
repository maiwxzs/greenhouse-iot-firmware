import { useEffect, useState } from "react";
import { LuClock, LuSprout, LuThermometer, LuRotateCcw, LuSave } from "react-icons/lu";
import { comandoHoraActual } from "../lib/protocolo.js";

const CAMPOS = [
  { grupo: "temp", nombre: "temp_max", cmd: "TEMP", etiqueta: "Ventilar desde", unidad: "°C", paso: 0.5, ayuda: "Sobre este valor arranca el ventilador." },
  { grupo: "temp", nombre: "temp_crit", cmd: "TEMPCRIT", etiqueta: "Alarma desde", unidad: "°C", paso: 0.5, ayuda: "Debe ser mayor o igual que el anterior." },
  { grupo: "temp", nombre: "temp_hist", cmd: "TEMPHIST", etiqueta: "Histéresis", unidad: "°C", paso: 0.5, ayuda: "Deja de ventilar este valor por debajo." },
  { grupo: "suelo", nombre: "suelo_min", cmd: "SUELOMIN", etiqueta: "Seco por debajo de", unidad: "%", paso: 1, ayuda: "Inicia el riego por pulsos." },
  { grupo: "suelo", nombre: "suelo_max", cmd: "SUELOMAX", etiqueta: "Encharcado por encima de", unidad: "%", paso: 1, ayuda: "Bloquea el riego." },
  { grupo: "suelo", nombre: "hist", cmd: "HIST", etiqueta: "Histéresis", unidad: "%", paso: 1, ayuda: "Margen para salir de seco o encharcado." },
];

export default function Ajustes({ cfg, activo, enviar }) {
  const [valores, setValores] = useState({});
  useEffect(() => {
    if (!cfg) return;
    const v = {};
    CAMPOS.map((c) => c.nombre).forEach((k) => { v[k] = cfg[k]; });
    setValores(v);
  }, [cfg]);

  const cambiados = cfg ? Object.keys(valores).filter((k) => valores[k] !== "" && Number(valores[k]) !== Number(cfg[k])) : [];

  const guardar = async (e) => {
    e.preventDefault();
    const cmds = CAMPOS.filter((c) => cambiados.includes(c.nombre)).map((c) => `${c.cmd} ${Number(valores[c.nombre])}`);
    // máximos primero para no cruzar min > max
    cmds.sort((a, b) => (/MAX|CRIT/.test(b) ? 1 : 0) - (/MAX|CRIT/.test(a) ? 1 : 0));
    for (const c of cmds) { await enviar(c); await new Promise((r) => setTimeout(r, 250)); }
  };

  const campo = (c) => (
    <label key={c.nombre} className="campo">
      {c.etiqueta} ({c.unidad})
      <input type="number" step={c.paso} value={valores[c.nombre] ?? ""} disabled={!activo || !cfg}
        data-cambiado={+cambiados.includes(c.nombre)} onChange={(e) => setValores({ ...valores, [c.nombre]: e.target.value })} />
      <small>{c.ayuda}</small>
    </label>
  );

  return (
    <form onSubmit={guardar} className="rejilla-2">
      <div>
        <fieldset>
          <legend><LuThermometer /> Temperatura</legend>
          <div className="campos">{CAMPOS.filter((c) => c.grupo === "temp").map(campo)}</div>
        </fieldset>
        <fieldset>
          <legend><LuSprout /> Humedad del suelo</legend>
          <div className="campos">{CAMPOS.filter((c) => c.grupo === "suelo").map(campo)}</div>
        </fieldset>
      </div>
      <div>
        <fieldset>
          <legend><LuClock /> Reloj del invernadero</legend>
          <p className="nota" style={{ margin: "0 0 .6rem", color: "var(--tinta-2)", fontSize: ".88rem" }}>
            El Arduino lleva la hora sin módulo RTC. La aplicación la sincroniza al conectar; este botón la vuelve a copiar del computador.
          </p>
          <button className="boton sec chico" type="button" disabled={!activo} onClick={() => enviar(comandoHoraActual())}>
            <LuClock /> Poner en hora
          </button>
        </fieldset>
        <fieldset>
          <legend>Humedad del aire</legend>
          <p className="nota" style={{ margin: 0, color: "var(--tinta-2)", fontSize: ".88rem" }}>
            El umbral se ajusta con el potenciómetro azul del módulo HR202: en sentido horario sube. El LED verde del módulo se enciende
            cuando la humedad lo supera, igual que el LED azul del panel.
          </p>
        </fieldset>
        <p className="nota" style={{ color: "var(--tinta-2)", fontSize: ".88rem" }}>
          Los ajustes se validan y se guardan en la EEPROM del Arduino: se conservan aunque se desconecte.
        </p>
        <div className="fila-botones">
          <button className="boton" type="submit" disabled={!activo || !cambiados.length}><LuSave /> Guardar {cambiados.length ? `(${cambiados.length})` : ""}</button>
          <button className="boton peligro" type="button" disabled={!activo}
            onClick={() => confirm("¿Volver a los valores de fábrica? Se pierden los umbrales y la calibración.") && enviar("FABRICA")}>
            <LuRotateCcw /> Valores de fábrica
          </button>
        </div>
      </div>
    </form>
  );
}
