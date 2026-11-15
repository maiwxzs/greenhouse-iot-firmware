import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuActivity, LuCalendarDays, LuFastForward, LuFlaskConical, LuGlassWater, LuHouse, LuInfo, LuListChecks,
  LuPlay, LuPlugZap, LuSlidersHorizontal, LuSquare, LuTerminal, LuUnplug,
} from "react-icons/lu";
import Inicio from "./componentes/Inicio.jsx";
import EnVivo from "./componentes/EnVivo.jsx";
import Historial from "./componentes/Historial.jsx";
import Eventos from "./componentes/Eventos.jsx";
import Ajustes from "./componentes/Ajustes.jsx";
import Calibracion from "./componentes/Calibracion.jsx";
import Consola from "./componentes/Consola.jsx";
import SelectorPuerto from "./componentes/SelectorPuerto.jsx";
import { soportaSerie, useConexion } from "./hooks/useConexion.js";
import { Almacen, RETENCION_LECTURAS_DIAS, RETENCION_MINUTOS_DIAS } from "./lib/almacen.js";
import { Registro, SEGUNDOS_POR_MUESTRA } from "./lib/registro.js";
import { CAUDAL_L_POR_S, comandoHoraActual, interpretarLinea, textoConfirmacion } from "./lib/protocolo.js";
import { generarHistorialDemo } from "./lib/simulador.js";

const VISTAS = [
  ["inicio", "Invernadero", LuHouse], ["graficas", "Gráficas", LuActivity], ["historial", "Historial", LuCalendarDays],
  ["eventos", "Eventos", LuListChecks], ["ajustes", "Ajustes", LuSlidersHorizontal], ["calibracion", "Calibración", LuFlaskConical],
  ["consola", "Consola", LuTerminal],
];

const PROVOCAR = [["calor", "Calor"], ["critico", "Calor extremo"], ["frio", "Enfriar"], ["seco", "Secar el suelo"], ["humedo", "Aire húmedo"], ["vaciar", "Vaciar el tanque"]];

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="13" fill="#18241D" />
      <path d="M11 52V27L32 12L53 27V52Z" fill="#CFE6F0" fillOpacity=".14" stroke="#E2C48E" strokeWidth="3.6" strokeLinejoin="round" />
      <path d="M32 49C32 42 32 37 32 31" stroke="#7FD39B" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M32 42C25 42 22 36 22 33C28 33 32 36 32 42ZM32 37C39 37 42 31 42 28C36 28 32 31 32 37Z" fill="#7FD39B" />
      <rect x="9" y="50" width="46" height="4" rx="1" fill="#C8A97E" />
    </svg>
  );
}

let idLinea = 0;

export default function App() {
  const [vista, setVista] = useState("inicio");
  const [cfg, setCfg] = useState(null);
  const [ultima, setUltima] = useState(null);
  const [vivo, setVivo] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [nuevos, setNuevos] = useState(() => new Set());
  const [consola, setConsola] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [version, setVersion] = useState(0);
  const [latido, setLatido] = useState(0);
  const [envio, setEnvio] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState(null);
  const [foco, setFoco] = useState(null);
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

  // La pantalla de la caja alterna sus dos páginas cada 4 s, como el firmware
  useEffect(() => {
    const id = setInterval(() => setPagina((p) => 1 - p), 4000);
    return () => clearInterval(id);
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

  // Cada minuto: recarga del historial, agua de hoy y espacio en disco
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
          if (!anterior || anterior.aire_alta !== l.aire_alta) aireDesde.current = l.t;
          return l;
        });
        setLatido((x) => x + 1);
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
        setUltima(null);
        registro.current?.anotar("conexion", info?.perdida ? "Se perdió la conexión USB" : "Desconectado", info?.perdida ? "alarma" : "neutro");
        if (info?.perdida) avisar("Se perdió la conexión con el Arduino", true);
      }
    },
  });
  const { modo } = conexion;

  const enviar = useCallback(async (texto, anotar = true) => {
    const ok = await conexion.enviar(texto);
    if (!ok) return;
    setEnvio((x) => x + 1);
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
  const acciones = { conectar: conectarUsb, demo: iniciarDemo, rellenar: conexion.rellenarDemo };

  return (
    <div className="app" data-alarma={+(t?.alarma === 1)}>
      <nav className="riel" aria-label="Secciones">
        <div className="marca">
          <Logo />
          <div>
            <strong>Invernadero IoT</strong>
            <span>Centro de control</span>
          </div>
        </div>
        <ul className="secciones">
          {VISTAS.map(([id, txt, Icono]) => (
            <li key={id}>
              <button type="button" aria-current={vista === id ? "page" : undefined} onClick={() => setVista(id)}>
                <Icono /> {txt}
              </button>
            </li>
          ))}
        </ul>
        <div className="conexion" data-modo={modo}>
          <p className="conexion-estado" role="status"><i />{{ desconectado: "Sin conexión", usb: "Arduino por USB", demo: "Demostración" }[modo]}</p>
          {modo === "desconectado" && (
            <>
              <button className="boton" type="button" onClick={conectarUsb} disabled={!soportaSerie}><LuPlugZap /> Conectar</button>
              <button className="boton sec" type="button" onClick={iniciarDemo}><LuPlay /> Demostración</button>
            </>
          )}
          {modo === "usb" && <button className="boton sec" type="button" onClick={conexion.desconectar}><LuUnplug /> Desconectar</button>}
          {modo === "demo" && <button className="boton sec" type="button" onClick={conexion.detenerDemo}><LuSquare /> Terminar demostración</button>}
        </div>
        <p className="riel-pie">
          Versión {__VERSION__}{cfg?.version ? ` · firmware ${cfg.version}` : ""}
          {uso && <><br />{(uso.usado / 1048576).toFixed(1)} MB de historial en este equipo</>}
        </p>
      </nav>

      <main className="vista">
        {modo === "demo" && (
          <div className="banda-demo" role="toolbar" aria-label="Controles de la demostración">
            <span>Demostración</span>
            <div className="segmentado" role="group" aria-label="Velocidad">
              {[1, 20].map((v) => (
                <button key={v} type="button" aria-pressed={conexion.velocidadDemo === v} onClick={() => conexion.setVelocidadDemo(v)}>
                  {v === 1 ? "Tiempo real" : <><LuFastForward /> ×20</>}
                </button>
              ))}
            </div>
            <span className="separador" />
            <span>Provocar:</span>
            {PROVOCAR.map(([id, txt]) => <button key={id} type="button" className="boton chico sec" onClick={() => conexion.provocarDemo(id)}>{txt}</button>)}
            <button type="button" className="boton chico sec" onClick={conexion.rellenarDemo}><LuGlassWater /> Rellenar</button>
          </div>
        )}
        {!soportaSerie && (
          <p className="aviso"><LuInfo /> Este entorno no puede comunicarse por USB. La demostración funciona igual.</p>
        )}

        {vista === "inicio" ? (
          <Inicio eventos={eventos} verEventos={() => setVista("eventos")} t={t} cfg={cfg} vivo={vivo} modo={modo} latido={latido} envio={envio} pagina={pagina}
            sel={sel} setSel={setSel} foco={foco} setFoco={setFoco} enviar={enviar} acciones={acciones}
            aireDesde={aireDesde.current} aguaHoy={aguaHoy} soportaSerie={soportaSerie} />
        ) : (
          <section className="hoja" key={vista}>
            <h1>{VISTAS.find((v) => v[0] === vista)[1]}</h1>
            {vista === "graficas" && <EnVivo vivo={vivo} cfg={cfg} />}
            {vista === "historial" && <Historial almacen={almacen} version={version} />}
            {vista === "eventos" && <Eventos eventos={eventos} nuevos={nuevos} />}
            {vista === "ajustes" && <Ajustes cfg={cfg} activo={activo} enviar={enviar} />}
            {vista === "calibracion" && <Calibracion t={t} cfg={cfg} activo={activo} enviar={enviar} />}
            {vista === "consola" && <Consola lineas={consola} activo={activo} enviar={enviar} />}
            <p className="nota-hoja">
              Historial guardado en este equipo: lecturas de {RETENCION_LECTURAS_DIAS} días y resúmenes de {RETENCION_MINUTOS_DIAS} días.
              {modo === "demo" && " Los datos de la demostración se guardan aparte de los reales."}
            </p>
          </section>
        )}
      </main>

      <SelectorPuerto />

      <div className="avisos" aria-live="polite">
        {avisos.map((a) => <div key={a.id} className={`toast${a.error ? " error" : ""}`}>{a.texto}</div>)}
      </div>
    </div>
  );
}
