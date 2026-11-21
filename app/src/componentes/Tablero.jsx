// Tablero en tiempo real
import { useMemo } from "react";
import {
  LuBellOff, LuBellRing, LuDroplets, LuFan, LuGlassWater, LuPlay, LuPlugZap, LuThermometer, LuWaves, LuWind,
} from "react-icons/lu";
import { GraficaTiempo, TiraActuadores } from "./Grafica.jsx";
import Lcd, { textoLcd } from "../escena/Lcd.jsx";
import { textoEstado } from "../lib/protocolo.js";
import { duracion, useAhora, useSuave } from "../lib/tiempo.js";

const CUPO_BOMBA_S = 900;
const VENTANA_MS = 30 * 60 * 1000;
const COL = { calor: "#F0A04B", alarma: "#F2564B", ventilar: "#F08A3C", suelo: "#5CC583", agua: "#4FA3E8", aire: "#8EC5EE", ok: "#5CC583" };

// arco de 240°, 0 a la izquierda
const ARCO = 240, R = 78, CX = 100, CY = 100;
const ang = (k) => (-ARCO / 2 + ARCO * k) * (Math.PI / 180);
const punto = (k, r = R) => [CX + r * Math.sin(ang(k)), CY - r * Math.cos(ang(k))];
function arco(k0, k1, r = R) {
  const [x0, y0] = punto(k0, r), [x1, y1] = punto(k1, r);
  const grande = (k1 - k0) * ARCO > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${grande} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Medidor({ valor, min, max, zonas, color, marcas = [] }) {
  const v = useSuave(typeof valor === "number" ? valor : null, 900);
  const k = typeof v === "number" ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0;
  const kk = (x) => (x - min) / (max - min);
  const [px, py] = punto(k);
  return (
    <svg className="medidor" viewBox="0 0 200 168" aria-hidden="true">
      <path d={arco(0, 1)} className="medidor-pista" />
      {zonas.map((z, i) => <path key={i} d={arco(kk(z.desde), kk(z.hasta), R + 11)} stroke={z.color} className="medidor-zona" />)}
      {typeof v === "number" && <path d={arco(0, Math.max(k, 0.001))} stroke={color} className="medidor-valor" />}
      {marcas.map((m) => {
        const [a, b] = punto(kk(m), R - 12), [c, d] = punto(kk(m), R + 16);
        return <line key={m} x1={a} y1={b} x2={c} y2={d} className="medidor-marca" />;
      })}
      {typeof v === "number" && <circle cx={px} cy={py} r="6" fill={color} className="medidor-punta" />}
      <text x={punto(0, R)[0]} y={punto(0, R)[1] + 22} className="medidor-escala" textAnchor="middle">{min}</text>
      <text x={punto(1, R)[0]} y={punto(1, R)[1] + 22} className="medidor-escala" textAnchor="middle">{max}</text>
    </svg>
  );
}

// estadísticas de la ventana en memoria
function resumen(vivo, campo) {
  const vals = vivo.filter((l) => typeof l[campo] === "number");
  if (!vals.length) return null;
  const nums = vals.map((l) => l[campo]);
  const ultimo = vals[vals.length - 1];
  const hace = ultimo.t - 10 * 60 * 1000;
  const viejo = vals.find((l) => l.t >= hace);
  return {
    min: Math.min(...nums), max: Math.max(...nums), prom: nums.reduce((a, b) => a + b, 0) / nums.length,
    delta: viejo && ultimo.t - viejo.t > 60000 ? ultimo[campo] - viejo[campo] : null,
  };
}

// ms desde que el campo tomó su valor actual
function desdeCambio(vivo, campo) {
  if (!vivo.length) return null;
  const actual = vivo[vivo.length - 1][campo];
  for (let i = vivo.length - 1; i >= 0; i--) if (vivo[i][campo] !== actual) return vivo[i + 1].t;
  return null;
}

function Tendencia({ delta, unidad, decimales = 1 }) {
  if (delta == null) return <span className="tendencia">tendencia: faltan datos</span>;
  const estable = Math.abs(delta) < (decimales ? 0.15 : 1);
  const f = estable ? "→" : delta > 0 ? "↑" : "↓";
  return <span className="tendencia" data-dir={estable ? 0 : Math.sign(delta)}>{f} {delta > 0 ? "+" : ""}{delta.toFixed(decimales)}{unidad} en 10 min</span>;
}

function Panel({ titulo, icono: Icono, tono, children, className = "" }) {
  return (
    <section className={`pv ${className}`} data-tono={tono}>
      <h3 className="pv-titulo">{Icono && <Icono />} {titulo}</h3>
      {children}
    </section>
  );
}

function Actuador({ nombre, icono: Icono, activo, color, estado, detalle, children }) {
  return (
    <div className="actuador" data-activo={+!!activo} style={{ "--c": color }}>
      <div className="actuador-cabeza">
        <span className="actuador-icono" data-girar={+(activo && Icono === LuFan)}><Icono /></span>
        <span className="actuador-nombre">{nombre}</span>
        <span className="actuador-estado">{estado}</span>
      </div>
      <p className="actuador-detalle">{detalle}</p>
      {children}
    </div>
  );
}

const mayus = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const MOTIVO_ALARMA = { SIN_AGUA: "tanque vacío", TEMPERATURA_CRITICA: "temperatura crítica", FALLA_SENSOR_TEMP: "falla del DS18B20" };

export default function Tablero({ t, cfg, vivo, eventos, modo, pagina, enviar, acciones, aguaHoy, soportaSerie, verEventos }) {
  useAhora(1000);
  const ahora = Date.now();
  const e = t ? textoEstado(t.estado) : { titulo: modo === "desconectado" ? "Sin conexión" : "Esperando lecturas", detalle: "", tono: "neutro" };
  const datos = useMemo(() => vivo.map((l) => ({ ...l, aire: l.aire_alta })), [vivo]);
  const hasta = vivo.length ? vivo[vivo.length - 1].t : ahora;
  const desde = hasta - VENTANA_MS;
  const rT = useMemo(() => resumen(vivo, "temp_c"), [vivo]);
  const rS = useMemo(() => resumen(vivo, "hum_suelo"), [vivo]);
  const tMax = cfg?.temp_max ?? 30, tCrit = cfg?.temp_crit ?? 35, tHist = cfg?.temp_hist ?? 2;
  const sMin = cfg?.suelo_min ?? 30, sMax = cfg?.suelo_max ?? 85;
  const edad = t ? Math.max(0, ahora - t.t) : null;
  const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0);
  const riegosHoy = eventos.filter((ev) => ev.tipo === "riego" && ev.t >= inicioHoy.getTime()).length;
  const aireFrac = vivo.length ? vivo.filter((l) => l.aire_alta).length / vivo.length : 0;
  const cambioBomba = desdeCambio(vivo, "bomba"), cambioVent = desdeCambio(vivo, "ventilador"), cambioAire = desdeCambio(vivo, "aire_alta");
  const tempColor = !t || typeof t.temp_c !== "number" ? "#7E9086" : t.temp_c >= tCrit ? COL.alarma : t.temp_c > tMax ? COL.ventilar : COL.calor;
  const sueloColor = !t || typeof t.hum_suelo !== "number" ? "#7E9086" : t.hum_suelo < sMin ? COL.ventilar : t.hum_suelo > sMax ? COL.agua : COL.suelo;
  const tempV = useSuave(typeof t?.temp_c === "number" ? t.temp_c : null);
  const sueloV = useSuave(typeof t?.hum_suelo === "number" ? t.hum_suelo : null);
  const razonVent = !t ? "" : t.ventilador
    ? [t.estado?.startsWith("TEMPERATURA") && "calor", t.aire_alta && "aire húmedo", t.estado === "FALLA_SENSOR_TEMP" && "seguridad"].filter(Boolean).join(" y ") || "control"
    : (t.estado?.startsWith("TEMPERATURA") || t.aire_alta) && t.bomba ? "en pausa mientras riega" : "";
  const fila = textoLcd(t, pagina);
  const sinDatos = !t;

  return (
    <div className="tablero-vivo" data-sin-datos={+sinDatos}>
      <header className="tv-estado" data-tono={e.tono}>
        <div>
          <h1>{e.titulo}</h1>
          <p>{e.detalle || (modo === "desconectado" ? "Conecta el Arduino por USB o abre la demostración." : "")}</p>
        </div>
        <dl className="tv-vivo">
          <div><dt>Hora</dt><dd className="num">{t?.hora?.slice(0, 8) ?? "--:--:--"}</dd></div>
          <div><dt>Última lectura</dt><dd className="num" data-tarde={+(edad != null && edad > 6000)}>{edad == null ? "—" : `hace ${duracion(edad)}`}</dd></div>
          <div><dt>Muestras (30 min)</dt><dd className="num">{vivo.length}</dd></div>
          <div><dt>Conexión</dt><dd><i className="pulso-vivo" data-modo={modo} key={t?.t} />{{ desconectado: "Sin conexión", usb: "USB", demo: "Demostración" }[modo]}</dd></div>
        </dl>
      </header>

      {t?.alarma === 1 && (
        <div className="tv-alarma" role="alert">
          <LuBellRing /> <b>Alarma:</b> {MOTIVO_ALARMA[t.estado] || "revisar el invernadero"}
          <button type="button" className="boton chico" onClick={() => enviar("SILENCIO")}><LuBellOff /> Silenciar 10 min</button>
        </div>
      )}

      {modo === "desconectado" && (
        <div className="tv-inicio">
          <button type="button" className="boton" onClick={acciones.conectar} disabled={!soportaSerie}><LuPlugZap /> Conectar Arduino</button>
          <button type="button" className="boton sec" onClick={acciones.demo}><LuPlay /> Abrir la demostración</button>
        </div>
      )}

      <div className="tv-medidores">
        <Panel titulo="Temperatura del aire" icono={LuThermometer} tono={t && t.temp_c >= tCrit ? "alarma" : undefined}>
          <div className="medida">
            <Medidor valor={t?.temp_c} min={0} max={50} color={tempColor} marcas={[tMax, tCrit]}
              zonas={[{ desde: tMax, hasta: tCrit, color: COL.ventilar }, { desde: tCrit, hasta: 50, color: COL.alarma }]} />
            <div className="medida-valor"><span className="num">{typeof tempV === "number" ? tempV.toFixed(1) : "--"}</span><small>°C</small></div>
          </div>
          <Tendencia delta={rT?.delta} unidad=" °C" />
          <dl className="mini">
            <div><dt>Mín</dt><dd className="num">{rT ? rT.min.toFixed(1) : "--"}</dd></div>
            <div><dt>Prom</dt><dd className="num">{rT ? rT.prom.toFixed(1) : "--"}</dd></div>
            <div><dt>Máx</dt><dd className="num">{rT ? rT.max.toFixed(1) : "--"}</dd></div>
          </dl>
          <p className="pv-nota">Ventila sobre {tMax} °C hasta {tMax - tHist} °C · alarma desde {tCrit} °C</p>
        </Panel>

        <Panel titulo="Humedad del suelo" icono={LuDroplets}>
          <div className="medida">
            <Medidor valor={t?.hum_suelo} min={0} max={100} color={sueloColor} marcas={[sMin, sMax]}
              zonas={[{ desde: 0, hasta: sMin, color: COL.ventilar }, { desde: sMin, hasta: sMax, color: COL.suelo }, { desde: sMax, hasta: 100, color: COL.agua }]} />
            <div className="medida-valor"><span className="num">{typeof sueloV === "number" ? Math.round(sueloV) : "--"}</span><small>%</small></div>
          </div>
          <Tendencia delta={rS?.delta} unidad=" %" decimales={0} />
          <dl className="mini">
            <div><dt>Mín</dt><dd className="num">{rS ? Math.round(rS.min) : "--"}</dd></div>
            <div><dt>Máx</dt><dd className="num">{rS ? Math.round(rS.max) : "--"}</dd></div>
            <div><dt>ADC</dt><dd className="num">{t?.adc_suelo ?? "--"}</dd></div>
          </dl>
          <p className="pv-nota">Riega bajo {sMin} % · pausa sobre {sMax} %</p>
        </Panel>

        <Panel titulo="Humedad del aire" icono={LuWind} tono={t?.aire_alta ? "agua" : undefined}>
          <div className="binario" data-on={+!!t?.aire_alta}>
            <span className="binario-luz" />
            <span className="binario-texto">{!t ? "--" : t.aire_alta ? "Alta" : "Normal"}</span>
          </div>
          <p className="pv-dato">{!t ? "—" : cambioAire ? `Desde hace ${duracion(ahora - cambioAire)}` : "Sin cambios en los últimos 30 min"}</p>
          <div className="barra" title="Tiempo con aire húmedo en los últimos 30 min">
            <i style={{ width: `${aireFrac * 100}%`, background: COL.aire }} />
          </div>
          <p className="pv-nota">{Math.round(aireFrac * 100)} % del tiempo con aire húmedo (30 min) · contacto del HR202 en D3</p>
        </Panel>

        <Panel titulo="Tanque" icono={LuWaves} tono={t && !t.agua ? "alarma" : undefined}>
          <div className="tanque-vivo" data-vacio={+(t ? !t.agua : 0)}>
            <div className="tanque-vaso">
              <div className="tanque-agua" style={{ height: `${typeof t?._tanque === "number" ? t._tanque : t ? (t.agua ? 72 : 12) : 0}%` }} />
              <span className="tanque-sonda" />
            </div>
            <div>
              <span className="binario-texto">{!t ? "--" : t.agua ? "Con agua" : "Vacío"}</span>
              <p className="pv-dato">{typeof t?._tanque === "number" ? `${Math.round(t._tanque)} % (simulado)` : "Sonda de nivel en A2"}</p>
              <p className="pv-dato">Agua usada hoy ≈ <b className="num">{aguaHoy != null ? aguaHoy.toFixed(2) : "--"} L</b></p>
            </div>
          </div>
          {modo === "demo" && <button type="button" className="boton chico sec" onClick={acciones.rellenar}><LuGlassWater /> Rellenar</button>}
        </Panel>
      </div>

      <div className="tv-medio">
        <Panel titulo="Actuadores" className="tv-actuadores">
          <Actuador nombre="Bomba" icono={LuDroplets} activo={t?.bomba} color={COL.agua}
            estado={!t ? "--" : t.bomba ? "Regando" : "En reposo"}
            detalle={t ? `${cambioBomba ? `${t.bomba ? "Encendida" : "Apagada"} hace ${duracion(ahora - cambioBomba)}` : "Sin cambios en 30 min"} · ${riegosHoy} pulsos hoy` : "Relé 1 · D7"}>
            <div className="barra" title="Uso de la bomba en la hora actual">
              <i style={{ width: `${Math.min(100, ((t?.bomba_s_hora ?? 0) / CUPO_BOMBA_S) * 100)}%`, background: COL.agua }} />
            </div>
            <p className="pv-nota"><span className="num">{t?.bomba_s_hora ?? 0}</span> de {CUPO_BOMBA_S} s permitidos en esta hora</p>
            <button type="button" className="boton chico agua" disabled={!t || !t.agua || t.bomba} onClick={() => enviar("RIEGO")}><LuDroplets /> Regar ahora</button>
          </Actuador>
          <Actuador nombre="Ventilador" icono={LuFan} activo={t?.ventilador} color={COL.suelo}
            estado={!t ? "--" : t.ventilador ? "Encendido" : "Apagado"}
            detalle={t ? mayus(`${razonVent ? razonVent + " · " : ""}${cambioVent ? `${t.ventilador ? "encendido" : "apagado"} hace ${duracion(ahora - cambioVent)}` : "sin cambios en 30 min"}`) : "Relé 2 · D8"} />
          <Actuador nombre="Alarma" icono={LuBellRing} activo={t?.alarma === 1} color={COL.alarma}
            estado={!t ? "--" : t.alarma === 1 ? "Sonando" : t.alarma === 2 ? "Silenciada" : "En silencio"}
            detalle={t?.alarma ? `Motivo: ${MOTIVO_ALARMA[t.estado] || "—"}` : "Zumbador en D10"} />
          <div className="leds">
            <span className="led-ind" data-on={+(t ? (t.agua ? t.suelo === "BAJA" : true) : false)} data-parpadeo={+(t ? !t.agua : false)} style={{ "--c": "#FF4B3E" }}>LED rojo · suelo seco</span>
            <span className="led-ind" data-on={+!!t?.aire_alta} style={{ "--c": "#4FA8FF" }}>LED azul · aire húmedo</span>
          </div>
        </Panel>

        <Panel titulo="Pantalla de la caja" className="tv-lcd">
          <Lcd filas={fila} encendida={!!t} titulo="Pantalla del invernadero" />
          <h3 className="pv-titulo sub">Últimos eventos</h3>
          {eventos.length === 0 ? <p className="pv-nota">Sin eventos todavía.</p> : (
            <ol className="tv-eventos">
              {eventos.slice(0, 7).map((ev, i) => (
                <li key={`${ev.t}-${i}`} data-tono={ev.tono}>
                  <time className="num">{new Date(ev.t).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</time>
                  <span>{ev.texto}</span>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className="enlace" onClick={verEventos}>Ver todos los eventos</button>
        </Panel>
      </div>

      <div className="tv-graficas">
        <Panel titulo="Temperatura · 30 min" icono={LuThermometer}>
          <GraficaTiempo datos={datos} desde={desde} hasta={hasta} unidad="°" alto={190}
            series={[{ campo: "temp_c", nombre: "Temperatura", color: COL.calor }]}
            umbrales={[{ valor: tMax, color: COL.ventilar, etiqueta: "ventilar" }, { valor: tCrit, color: COL.alarma, etiqueta: "alarma" }]} />
        </Panel>
        <Panel titulo="Humedad del suelo · 30 min" icono={LuDroplets}>
          <GraficaTiempo datos={datos} desde={desde} hasta={hasta} dominio={[0, 100]} unidad="%" alto={190}
            series={[{ campo: "hum_suelo", nombre: "Suelo", color: COL.suelo }]}
            banda={{ min: sMin, max: sMax, color: COL.suelo }} />
        </Panel>
        <Panel titulo="Actuadores y aire · 30 min" className="tv-tira">
          <TiraActuadores datos={datos} desde={desde} hasta={hasta} campos={[
            { campo: "bomba", nombre: "Bomba", color: COL.agua },
            { campo: "ventilador", nombre: "Ventilador", color: COL.suelo },
            { campo: "aire", nombre: "Aire alto", color: COL.aire },
            { campo: "alarma", nombre: "Alarma", color: COL.alarma },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
