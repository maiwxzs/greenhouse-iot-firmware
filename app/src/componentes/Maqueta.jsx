// Maqueta interactiva con la ficha de cada pieza
import { LuBellOff, LuDroplets, LuGlassWater, LuX } from "react-icons/lu";
import Escena, { VB } from "../escena/Escena.jsx";
import { PIEZAS } from "../escena/piezas.js";
import { P } from "../escena/proyeccion.js";

const pct = ([x, y]) => ({ left: `${((x - VB.x) / VB.w) * 100}%`, top: `${((y - VB.y) / VB.h) * 100}%` });

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

export default function Maqueta({ t, cfg, modo, latido, envio, pagina, sel, setSel, foco, setFoco, enviar, acciones }) {
  return (
    <div className="escena-marco" style={{ aspectRatio: `${VB.w} / ${VB.h}` }} onClick={() => setSel(null)}>
      <Escena t={t} cfg={cfg} modo={modo} latido={latido} envio={envio} pagina={pagina}
        sel={sel} setSel={setSel} foco={foco} setFoco={setFoco} tapaAbierta={sel === "caja"} />
      {foco && foco !== sel && PIEZAS[foco] && <span className="etiqueta-pieza" style={pct(P(...PIEZAS[foco].ancla))}>{PIEZAS[foco].nombre}</span>}
      {sel && PIEZAS[sel] && <Ficha id={sel} t={t} cfg={cfg} modo={modo} enviar={enviar} acciones={acciones} cerrar={() => setSel(null)} />}
      {modo !== "desconectado" && !sel && <p className="pista">Toca una pieza para ver qué es y qué está haciendo</p>}
    </div>
  );
}
