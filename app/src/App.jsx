import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuActivity, LuCalendarDays, LuFastForward, LuFlaskConical, LuGlassWater, LuInfo, LuListChecks, LuMonitorDown,
  LuPlay, LuPlugZap, LuSlidersHorizontal, LuSquare, LuTerminal, LuUnplug,
} from "react-icons/lu";
import Escena from "./componentes/Escena.jsx";
import PanelEstado from "./componentes/PanelEstado.jsx";
import Instrumentos from "./componentes/Instrumentos.jsx";
import EnVivo from "./componentes/EnVivo.jsx";
import Historial from "./componentes/Historial.jsx";
import Eventos from "./componentes/Eventos.jsx";
import Ajustes from "./componentes/Ajustes.jsx";
import Calibracion from "./componentes/Calibracion.jsx";
import Consola from "./componentes/Consola.jsx";
import { soportaSerie, useConexion } from "./hooks/useConexion.js";
import { useInstalar } from "./hooks/useInstalar.js";
import { Almacen, RETENCION_LECTURAS_DIAS, RETENCION_MINUTOS_DIAS } from "./lib/almacen.js";
import { Registro, SEGUNDOS_POR_MUESTRA } from "./lib/registro.js";
import { CAUDAL_L_POR_S, comandoHoraActual, interpretarLinea, textoConfirmacion } from "./lib/protocolo.js";
import { generarHistorialDemo } from "./lib/simulador.js";

const PESTANAS = [
  ["vivo", "En vivo", LuActivity], ["historial", "Historial", LuCalendarDays], ["eventos", "Eventos", LuListChecks],
  ["ajustes", "Ajustes", LuSlidersHorizontal], ["calibracion", "Calibración", LuFlaskConical], ["consola", "Consola", LuTerminal],
];

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#1E2D24" />
      <path d="M8 31 V18 L20 9 L32 18 V31" fill="none" stroke="#C59A55" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M20 30 C20 25 20 22 20 19" stroke="#7FC198" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 25 C15 25 13 21 13 19 C17 19 20 21 20 25 Z M20 22 C25 22 27 18 27 16 C23 16 20 18 20 22 Z" fill="#7FC198" />
    </svg>
  );
}

let idLinea = 0;

export default function App() {
  const [pestana, setPestana] = useState("vivo");
  const [cfg, setCfg] = useState(null);
  const [ultima, setUltima] = useState(null);
  const [vivo, setVivo] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [nuevos, setNuevos] = useState(() => new Set());
  const [consola, setConsola] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [version, setVersion] = useState(0);
  const [latido, setLatido] = useState(false);
  const [aguaHoy, setAguaHoy] = useState(null);
  const [uso, setUso] = useState(null);
  const aireDesde = useRef(null);
  const sincronizado = useRef(false);

  const almacenes = useMemo(() => ({ real: new Almacen("invernadero"), demo: new Almacen("invernadero-demo") }), []);
  const [almacen, setAlmacen] = useState(almacenes.real);
  const registro = useRef(null);

  const avisar = useCallback((texto, error = false) => {
    const id = ++idLinea;
    setAvisos((a) => [...a.slice(-2), { id, texto, error }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3600);
  }, []);

  const alConsola = useCallback((texto, clase = "") => {
    setConsola((c) => [...c.slice(-299), { id: ++idLinea, texto, clase }]);
  }, []);

  // Registro ligado al almacén activo (real o demostración)
  useEffect(() => {
    let vigente = true;
    almacen.abrir().then(async () => {
      if (!vigente) return;
      registro.current = new Registro(almacen, (v, evs) => {
        setVivo([...v]);
        if (evs.length) {
          setEventos((e) => [...evs.slice().reverse(), ...e].slice(0, 300));
          setNuevos(new Set(evs));
        }
      });
      setEventos(await almacen.ultimosEventos(300));
      setVersion((x) => x + 1);
    });
    return () => { vigente = false; registro.current?.reiniciar(); registro.current = null; };
  }, [almacen]);

  // Cada minuto: recarga del historial, agua de hoy y uso del disco
  useEffect(() => {
    const id = setInterval(() => setVersion((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    almacen.rango("minutos", hoy.getTime(), Date.now()).then((m) => {
      if (!m.length) { setAguaHoy(null); return; }
      setAguaHoy(m.reduce((a, x) => a + x.bomba, 0) * SEGUNDOS_POR_MUESTRA * CAUDAL_L_POR_S);
    });
    Almacen.estimarUso().then(setUso);
  }, [almacen, version]);

  const conexion = useConexion({
    alRecibirLinea: (linea) => {
      const msg = interpretarLinea(linea);
      if (!msg) return;
      if (msg.tipo === "tel") {
        if (!registro.current) return;
        const l = registro.current.agregar(msg);
        setUltima((anterior) => {
          if (!anterior || anterior.aire !== l.aire) aireDesde.current = l.t;
          return l;
        });
        setLatido((x) => !x);
        if (!msg.hora_sync && !sincronizado.current) { sincronizado.current = true; enviar(comandoHoraActual(), false); }
        return;
      }
      if (msg.tipo === "cfg") { setCfg(msg); alConsola(linea.trim(), "ok"); return; }
      if (msg.tipo === "ok") { alConsola(linea.trim(), "ok"); avisar(textoConfirmacion(msg.cmd)); return; }
      if (msg.tipo === "error") {
        alConsola(linea.trim(), "error"); avisar(msg.msg, true);
        registro.current?.anotar("error", msg.msg, "alarma");
        return;
      }
      alConsola(msg.texto, msg.texto.startsWith("#") ? "info" : "");
    },
    alCambiarModo: (m, info) => {
      if (m === "desconectado") {
        sincronizado.current = false;
        registro.current?.anotar("conexion", info?.perdida ? "Se perdió la conexión USB" : "Desconectado", info?.perdida ? "alarma" : "neutro");
        if (info?.perdida) avisar("Se perdió la conexión con el Arduino", true);
      }
    },
  });
  const { modo } = conexion;

  const enviar = useCallback(async (texto, anotar = true) => {
    const ok = await conexion.enviar(texto);
    if (!ok) return;
    alConsola("> " + texto, "tx");
    if (anotar) registro.current?.anotar("comando", texto, "neutro");
  }, [conexion, alConsola]);

  const conectarUsb = async () => {
    setAlmacen(almacenes.real);
    const r = await conexion.conectar();
    if (r.error === "ocupado") avisar("El puerto está ocupado. Cierra el Monitor Serie del Arduino IDE e intenta de nuevo.", true);
    if (r.ok) {
      setCfg(null); setUltima(null);
      alConsola("# Conectado por USB. El Arduino se reinicia al abrir el puerto.", "info");
      setTimeout(() => registro.current?.anotar("conexion", "Arduino conectado por USB", "ok"), 500);
    }
  };

  const iniciarDemo = async () => {
    setCfg(null); setUltima(null);
    const demo = almacenes.demo;
    await demo.abrir();
    if ((await demo.contar("minutos")) < 600) {
      const { minutos, eventos: evs } = generarHistorialDemo(3);
      await demo.borrarTodo();
      await demo.guardar("minutos", minutos);
      await demo.guardar("eventos", evs);
    }
    setAlmacen(demo);
    setTimeout(() => conexion.iniciarDemo(), 50);
  };

  const activo = modo !== "desconectado";
  const t = ultima;
  const { puedeInstalar, instalar } = useInstalar();

  return (
    <div className="app">
      <header className="encabezado">
        <div className="marca">
          <Logo />
          <div>
            <h1>Invernadero piloto</h1>
            <p>Centro de monitoreo del Arduino Uno</p>
          </div>
        </div>
        <div className="conexion">
          <span className="pastilla" data-modo={modo} role="status">
            <i />{{ desconectado: "Sin conexión", usb: "Arduino conectado por USB", demo: "Demostración" }[modo]}
          </span>
          {modo === "desconectado" && (
            <>
              <button className="boton" type="button" onClick={conectarUsb} disabled={!soportaSerie}><LuPlugZap /> Conectar Arduino</button>
              <button className="boton sec" type="button" onClick={iniciarDemo}><LuPlay /> Demostración</button>
            </>
          )}
          {modo === "usb" && <button className="boton sec" type="button" onClick={conexion.desconectar}><LuUnplug /> Desconectar</button>}
          {modo === "demo" && (
            <>
              <div className="segmentado" role="group" aria-label="Velocidad de la demostración">
                {[1, 20].map((v) => (
                  <button key={v} type="button" aria-pressed={conexion.velocidadDemo === v} onClick={() => conexion.setVelocidadDemo(v)}>
                    {v === 1 ? "Tiempo real" : <><LuFastForward style={{ verticalAlign: "-2px" }} /> ×20</>}
                  </button>
                ))}
              </div>
              <button className="boton sec" type="button" onClick={conexion.rellenarDemo}><LuGlassWater /> Rellenar tanque</button>
              <button className="boton sec" type="button" onClick={conexion.detenerDemo}><LuSquare /> Detener</button>
            </>
          )}
          {puedeInstalar && <button className="boton sec" type="button" onClick={instalar}><LuMonitorDown /> Instalar aplicación</button>}
        </div>
      </header>

      {!soportaSerie && (
        <p className="aviso"><LuInfo /> Este navegador no puede comunicarse por USB. Abre la aplicación en Google Chrome o Microsoft Edge
          de escritorio. La demostración funciona en cualquier navegador.</p>
      )}

      <section className="principal" data-alarma={+(t?.alarma === 1)}>
        <Escena t={t} latido={latido} />
        <PanelEstado t={t} modo={modo} enviar={enviar} />
      </section>

      <Instrumentos t={t} cfg={cfg} aireDesde={aireDesde.current} aguaHoy={aguaHoy} />

      <section className="panel">
        <div className="pestanas" role="tablist">
          {PESTANAS.map(([id, txt, Icono]) => (
            <button key={id} role="tab" type="button" aria-selected={pestana === id} onClick={() => setPestana(id)}><Icono /> {txt}</button>
          ))}
        </div>
        <div className="contenido" role="tabpanel" key={pestana}>
          {pestana === "vivo" && <EnVivo vivo={vivo} cfg={cfg} />}
          {pestana === "historial" && <Historial almacen={almacen} version={version} />}
          {pestana === "eventos" && <Eventos eventos={eventos} nuevos={nuevos} />}
          {pestana === "ajustes" && <Ajustes cfg={cfg} activo={activo} enviar={enviar} />}
          {pestana === "calibracion" && <Calibracion t={t} cfg={cfg} activo={activo} enviar={enviar} />}
          {pestana === "consola" && <Consola lineas={consola} activo={activo} enviar={enviar} />}
        </div>
      </section>

      <footer className="pie-app">
        <span>Aplicación {__VERSION__}{cfg?.version ? `, firmware ${cfg.version}` : ""}</span>
        <span>Historial guardado en este computador: lecturas de {RETENCION_LECTURAS_DIAS} días y resúmenes de {RETENCION_MINUTOS_DIAS} días</span>
        {uso && <span>Espacio usado: {(uso.usado / 1048576).toFixed(1)} MB</span>}
        {modo === "demo" && <span>Los datos de la demostración se guardan aparte de los reales</span>}
      </footer>

      <div className="avisos" aria-live="polite">
        {avisos.map((a) => <div key={a.id} className={`toast${a.error ? " error" : ""}`}>{a.texto}</div>)}
      </div>
    </div>
  );
}
