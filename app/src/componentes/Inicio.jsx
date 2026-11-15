// Vista principal: la maqueta interactiva y, al lado, el tablero con las lecturas y la réplica de la pantalla.
import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, curveStepAfter, line } from "d3-shape";
import { LuBellOff, LuDroplets, LuGlassWater, LuPlay, LuPlugZap, LuX } from "react-icons/lu";
import Escena, { VB } from "../escena/Escena.jsx";
import Lcd, { textoLcd } from "../escena/Lcd.jsx";
import { PIEZAS } from "../escena/piezas.js";
import { P } from "../escena/proyeccion.js";
import { textoEstado } from "../lib/protocolo.js";

const pct = ([x, y]) => ({ left: `${((x - VB.x) / VB.w) * 100}%`, top: `${((y - VB.y) / VB.h) * 100}%` });

// Trazo de los últimos 30 minutos con las referencias de los umbrales
function Traza({ datos, campo, dominio, marcas = [], banda, escalon, color }) {
  const W = 220, H = 40;
  const d = useMemo(() => {
    if (datos.length < 2) return null;
    const t0 = datos[0].t, t1 = datos[datos.length - 1].t;
    const x = scaleLinear().domain([t0, Math.max(t1, t0 + 1)]).range([0, W]);
    const vals = datos.map((l) => l[campo]).filter((v) => typeof v === "number");
    const [a, b] = dominio || [Math.min(...vals, ...marcas) - 1, Math.max(...vals, ...marcas) + 1];
    const y = scaleLinear().domain([a, b]).range([H - 3, 3]);
    return {
      camino: line().defined((l) => typeof l[campo] === "number").x((l) => x(l.t)).y((l) => y(l[campo]))
        .curve(escalon ? curveStepAfter : curveMonotoneX)(datos),
      marcas: marcas.map((m) => y(m)),
      banda: banda ? [y(banda[1]), y(banda[0])] : null,
    };
  }, [datos, campo, dominio, marcas, banda, escalon]);
  return (
    <svg className="traza" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {d?.banda && <rect x="0" width={W} y={d.banda[0]} height={Math.max(0, d.banda[1] - d.banda[0])} className="traza-banda" />}
      {d?.marcas.map((m, i) => <line key={i} x1="0" x2={W} y1={m} y2={m} className="traza-marca" />)}
      {d ? <path d={d.camino} stroke={color} className="traza-linea" /> : <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="traza-vacia" />}
    </svg>
  );
}

function Lectura({ id, titulo, valor, unidad, nota, alerta, foco, setFoco, setSel, children }) {
  return (
    <li className="lectura" data-foco={+(foco === id)} data-alerta={+!!alerta}
      onPointerEnter={() => setFoco(id)} onPointerLeave={() => setFoco(null)}>
      <button type="button" onClick={() => setSel(id)} aria-label={`Ver ${titulo} en la maqueta`}>
        <span className="lectura-titulo">{titulo}</span>
        <span className="lectura-valor num">{valor}{unidad && <small>{unidad}</small>}</span>
        <span className="lectura-nota">{nota}</span>
        {children}
      </button>
    </li>
  );
}

function Ficha({ id, t, cfg, modo, enviar, acciones, cerrar }) {
  const p = PIEZAS[id];
  const [x, y] = P(...p.ancla);
  const izquierda = p.lado ? p.lado === "izquierda" : (x - VB.x) / VB.w > 0.55;
  const arriba = (y - VB.y) / VB.h > 0.62;
  return (
    <div className="ficha" style={pct([x, y])} data-izquierda={+izquierda} data-arriba={+arriba} role="dialog" aria-label={p.nombre}
      onClick={(e) => e.stopPropagation()}>
      <header>
        <h3>{p.nombre}</h3>
        <button type="button" className="cerrar" onClick={cerrar} aria-label="Cerrar ficha"><LuX /></button>
      </header>
      <p className="ficha-valor">{p.valor(t, cfg, modo)}</p>
      <dl>
        <dt>Pieza</dt><dd>{p.modelo}</dd>
        <dt>Conexión</dt><dd>{p.conexion}</dd>
      </dl>
      <p className="ficha-texto">{p.texto}</p>
      {p.accion === "riego" && <button type="button" className="boton agua" disabled={!t} onClick={() => enviar("RIEGO")}><LuDroplets /> Regar ahora</button>}
      {p.accion === "silencio" && t?.alarma === 1 && <button type="button" className="boton alarma" onClick={() => enviar("SILENCIO")}><LuBellOff /> Silenciar 10 min</button>}
      {p.accion === "rellenar" && modo === "demo" && <button type="button" className="boton" onClick={acciones.rellenar}><LuGlassWater /> Rellenar tanque</button>}
    </div>
  );
}

export default function Inicio({ eventos = [], verEventos, t, cfg, vivo, modo, latido, envio, pagina, sel, setSel, foco, setFoco, enviar, acciones, aireDesde, aguaHoy, soportaSerie }) {
  const e = t ? textoEstado(t.estado) : { titulo: modo === "desconectado" ? "Sin conexión" : "Esperando lecturas", detalle: "", tono: "neutro" };
  const datos = useMemo(() => vivo.map((l) => ({ ...l, aire: l.aire_alta, agua_n: l.agua })), [vivo]);
  const filas = textoLcd(t, pagina);
  const minAire = t && aireDesde ? Math.max(0, Math.round((Date.now() - aireDesde) / 60000)) : null;

  return (
    <div className="inicio">
      <div className="escena-marco" style={{ aspectRatio: `${VB.w} / ${VB.h}` }} onClick={() => setSel(null)}>
        <Escena t={t} cfg={cfg} modo={modo} latido={latido} envio={envio} pagina={pagina}
          sel={sel} setSel={setSel} foco={foco} setFoco={setFoco} tapaAbierta={sel === "caja"} />
        {foco && foco !== sel && PIEZAS[foco] && <span className="etiqueta-pieza" style={pct(P(...PIEZAS[foco].ancla))}>{PIEZAS[foco].nombre}</span>}
        {sel && PIEZAS[sel] && <Ficha id={sel} t={t} cfg={cfg} modo={modo} enviar={enviar} acciones={acciones} cerrar={() => setSel(null)} />}
        {modo === "desconectado" && (
          <div className="bienvenida" onClick={(ev) => ev.stopPropagation()}>
            <h2>El invernadero está esperando</h2>
            <p>Conecta el Arduino con el cable USB para ver lo que pasa en la maqueta, o abre la demostración para recorrerla con un Arduino simulado.</p>
            <div className="fila-botones">
              <button type="button" className="boton" onClick={acciones.conectar} disabled={!soportaSerie}><LuPlugZap /> Conectar Arduino</button>
              <button type="button" className="boton sec" onClick={acciones.demo}><LuPlay /> Abrir la demostración</button>
            </div>
          </div>
        )}
        {modo !== "desconectado" && !sel && <p className="pista">Toca una pieza de la maqueta para ver qué es y qué está haciendo.</p>}
      </div>

      <section className="bitacora" aria-label="Últimos eventos">
        <header>
          <h2>Lo último que pasó</h2>
          <button type="button" className="enlace" onClick={verEventos}>Ver todos los eventos</button>
        </header>
        {eventos.length === 0 ? <p className="vacio-tapete">Aquí aparecen los riegos, el ventilador, las alarmas y los comandos a medida que ocurren.</p> : (
          <ol>
            {eventos.slice(0, 6).map((ev, i) => (
              <li key={`${ev.t}-${i}`} data-tono={ev.tono}>
                <time className="num">{new Date(ev.t).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
                <span>{ev.texto}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="tablero" data-tono={e.tono}>
        <header className="estado">
          <span className="estado-hora num">{t?.hora?.slice(0, 5) ?? "--:--"}</span>
          <h2>{e.titulo}</h2>
          <p>{e.detalle}</p>
        </header>

        <ul className="lecturas">
          <Lectura id="temperatura" titulo="Temperatura" valor={typeof t?.temp_c === "number" ? t.temp_c.toFixed(1) : "--"} unidad="°C"
            nota={`Ventila sobre ${cfg?.temp_max ?? 30} °C · alarma en ${cfg?.temp_crit ?? 35} °C`}
            alerta={t && t.temp_c >= (cfg?.temp_crit ?? 35)} foco={foco} setFoco={setFoco} setSel={setSel}>
            <Traza datos={datos} campo="temp_c" marcas={[cfg?.temp_max ?? 30]} color="var(--calor)" />
          </Lectura>
          <Lectura id="suelo" titulo="Humedad del suelo" valor={typeof t?.hum_suelo === "number" ? Math.round(t.hum_suelo) : "--"} unidad="%"
            nota={`Riega bajo ${cfg?.suelo_min ?? 30} % · pausa sobre ${cfg?.suelo_max ?? 85} %`}
            foco={foco} setFoco={setFoco} setSel={setSel}>
            <Traza datos={datos} campo="hum_suelo" dominio={[0, 100]} banda={[cfg?.suelo_min ?? 30, cfg?.suelo_max ?? 85]} color="var(--hoja)" />
          </Lectura>
          <Lectura id="aire" titulo="Humedad del aire" valor={!t ? "--" : t.aire_alta ? "Alta" : "Normal"}
            nota={!t ? "Contacto del módulo HR202" : t.aire_alta ? `Ventilando desde hace ${minAire ?? 0} min` : "Bajo el umbral del módulo HR202"}
            foco={foco} setFoco={setFoco} setSel={setSel}>
            <Traza datos={datos} campo="aire" dominio={[-0.2, 1.2]} escalon color="var(--aire)" />
          </Lectura>
          <Lectura id="tanque" titulo="Tanque y riego" valor={!t ? "--" : t.agua ? "Con agua" : "Vacío"}
            nota={aguaHoy != null ? `Agua usada hoy ≈ ${aguaHoy.toFixed(2)} L · bomba ${t?.bomba_s_hora ?? 0} s en esta hora` : `Bomba ${t?.bomba_s_hora ?? 0} s en esta hora`}
            alerta={t && !t.agua} foco={foco} setFoco={setFoco} setSel={setSel}>
            <Traza datos={datos} campo="bomba" dominio={[-0.2, 1.2]} escalon color="var(--agua)" />
          </Lectura>
        </ul>

        <figure className="replica" data-foco={+(foco === "pantalla")} onPointerEnter={() => setFoco("pantalla")} onPointerLeave={() => setFoco(null)}>
          <Lcd filas={filas} encendida={!!t} titulo="Pantalla del invernadero" />
          <figcaption>Lo que muestra ahora la pantalla de la caja</figcaption>
        </figure>

        <div className="acciones">
          <button type="button" className="boton agua" disabled={!t || !t.agua} onClick={() => enviar("RIEGO")}><LuDroplets /> Regar ahora</button>
          {t?.alarma === 1 && <button type="button" className="boton alarma" onClick={() => enviar("SILENCIO")}><LuBellOff /> Silenciar alarma</button>}
        </div>
      </aside>
    </div>
  );
}
