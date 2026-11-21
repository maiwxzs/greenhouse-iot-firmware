// Selector de puerto (Electron no trae el diálogo de Web Serial)
import { useEffect, useState } from "react";
import { LuCable, LuX } from "react-icons/lu";

const FABRICANTES = { "2341": "Arduino", "2a03": "Arduino", "1a86": "CH340 (clon de Arduino)", "0403": "FTDI", "10c4": "Silicon Labs CP210x" };

const hex = (n) => (n ? Number(n).toString(16).padStart(4, "0") : "");

export default function SelectorPuerto() {
  const [puertos, setPuertos] = useState(null);
  const [elegido, setElegido] = useState("");
  const api = typeof window !== "undefined" ? window.escritorio : null;

  useEffect(() => {
    if (!api) return undefined;
    return api.alPedirPuerto((lista) => {
      setPuertos(lista);
      const arduino = lista.find((p) => FABRICANTES[hex(p.vendorId)]);
      setElegido((arduino || lista[0])?.portId ?? "");
    });
  }, [api]);

  if (!api || !puertos) return null;
  const responder = (id) => { api.elegirPuerto(id); setPuertos(null); };

  return (
    <div className="modal-fondo" role="presentation" onClick={() => responder("")}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-puerto" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="titulo-puerto">Elige el puerto del Arduino</h2>
          <button type="button" className="cerrar" onClick={() => responder("")} aria-label="Cancelar"><LuX /></button>
        </header>
        {puertos.length === 0 ? (
          <p className="vacio">No hay ningún puerto USB. Conecta el Arduino con el cable y espera unos segundos: la lista se actualiza sola.</p>
        ) : (
          <ul className="lista-puertos">
            {puertos.map((p) => {
              const fab = FABRICANTES[hex(p.vendorId)];
              return (
                <li key={p.portId}>
                  <label data-elegido={+(elegido === p.portId)}>
                    <input type="radio" name="puerto" value={p.portId} checked={elegido === p.portId} onChange={() => setElegido(p.portId)} />
                    <LuCable />
                    <span>
                      <b>{p.portName || p.displayName}</b>
                      <small>{[p.displayName !== p.portName && p.displayName, fab].filter(Boolean).join(" · ") || "Dispositivo serie"}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="fila-botones">
          <button type="button" className="boton" disabled={!elegido} onClick={() => responder(elegido)}>Conectar</button>
          <button type="button" className="boton sec" onClick={() => responder("")}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
