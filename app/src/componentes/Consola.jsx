import { useEffect, useRef, useState } from "react";
import { LuSend } from "react-icons/lu";
import { COMANDOS } from "../lib/protocolo.js";

export default function Consola({ lineas, activo, enviar }) {
  const [texto, setTexto] = useState("");
  const [verTelemetria, setVerTelemetria] = useState(false);
  const caja = useRef(null);
  const visibles = verTelemetria ? lineas : lineas.filter((l) => !l.texto.includes('"tipo":"tel"'));

  useEffect(() => {
    const c = caja.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [visibles.length]);

  const mandar = (e) => {
    e.preventDefault();
    if (texto.trim()) { enviar(texto.trim()); setTexto(""); }
  };

  return (
    <div className="rejilla-2">
      <section className="bloque">
        <div className="cabecera">
          <h3>Comunicación con el Arduino</h3>
          <label style={{ fontSize: ".85rem", color: "var(--tinta-2)", display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={verTelemetria} onChange={(e) => setVerTelemetria(e.target.checked)} /> Mostrar telemetría
          </label>
        </div>
        <div className="consola" ref={caja} aria-live="off">
          {visibles.map((l) => <div key={l.id} className={l.clase}>{l.texto}</div>)}
        </div>
        <form className="envio" onSubmit={mandar}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un comando, por ejemplo TEMP 28" aria-label="Comando" disabled={!activo} />
          <button className="boton" type="submit" disabled={!activo}><LuSend /> Enviar</button>
        </form>
      </section>
      <section className="bloque">
        <h3>Comandos</h3>
        <p className="nota">Haz clic en un comando para copiarlo al campo de envío.</p>
        <table className="referencia">
          <tbody>
            {COMANDOS.map(([c, d]) => (
              <tr key={c}><td><button type="button" onClick={() => setTexto(c)}>{c}</button></td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
