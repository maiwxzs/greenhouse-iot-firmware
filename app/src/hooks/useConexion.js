// Web Serial o simulador
import { useCallback, useEffect, useRef, useState } from "react";
import { Simulador } from "../lib/simulador.js";

export const soportaSerie = typeof navigator !== "undefined" && "serial" in navigator;

export function useConexion({ alRecibirLinea, alCambiarModo }) {
  const [modo, setModo] = useState("desconectado");     // desconectado | usb | demo
  const [velocidadDemo, setVelocidadDemoState] = useState(1);
  const serie = useRef({ puerto: null, lector: null, escritor: null, cerrando: false });
  const sim = useRef(null);
  const recibir = useRef(alRecibirLinea);
  const cambiarModo = useRef(alCambiarModo);
  recibir.current = alRecibirLinea;
  cambiarModo.current = alCambiarModo;

  const fijarModo = useCallback((m, info) => {
    setModo(m);
    cambiarModo.current?.(m, info);
  }, []);

  const desconectar = useCallback(async () => {
    const s = serie.current;
    s.cerrando = true;
    try { await s.lector?.cancel(); } catch { /* ya cerrado */ }
    try { await s.escritor?.close(); } catch { /* ya cerrado */ }
    try { s.escritor?.releaseLock(); } catch { /* ya liberado */ }
    try { await s.puerto?.close(); } catch { /* ya cerrado */ }
    s.puerto = s.lector = s.escritor = null;
    fijarModo("desconectado");
  }, [fijarModo]);

  const leer = useCallback(async () => {
    const s = serie.current;
    const decodificador = new TextDecoderStream();
    const tuberia = s.puerto.readable.pipeTo(decodificador.writable).catch(() => {});
    s.lector = decodificador.readable.getReader();
    let resto = "";
    try {
      for (;;) {
        const { value, done } = await s.lector.read();
        if (done) break;
        resto += value;
        const partes = resto.split("\n");
        resto = partes.pop();
        partes.forEach((l) => recibir.current(l));
      }
    } catch {
      /* cable desconectado */
    } finally {
      try { s.lector.releaseLock(); } catch { /* ya liberado */ }
      await tuberia;
      if (!s.cerrando) {
        fijarModo("desconectado", { perdida: true });
        try { await s.puerto?.close(); } catch { /* ya cerrado */ }
        s.puerto = null;
      }
    }
  }, [fijarModo]);

  const conectar = useCallback(async () => {
    if (!soportaSerie) return { error: "navegador" };
    const s = serie.current;
    try {
      s.puerto = await navigator.serial.requestPort();
      await s.puerto.open({ baudRate: 9600 });
    } catch (e) {
      s.puerto = null;
      return { error: e?.name === "NotFoundError" ? "cancelado" : "ocupado" };
    }
    s.cerrando = false;
    const codificador = new TextEncoderStream();
    codificador.readable.pipeTo(s.puerto.writable).catch(() => {});
    s.escritor = codificador.writable.getWriter();
    fijarModo("usb");
    leer();
    return { ok: true };
  }, [fijarModo, leer]);

  const iniciarDemo = useCallback(() => {
    sim.current = new Simulador();
    sim.current.velocidad = velocidadDemo;
    sim.current.iniciar((l) => recibir.current(l));
    fijarModo("demo");
  }, [fijarModo, velocidadDemo]);

  const detenerDemo = useCallback(() => {
    sim.current?.detener();
    sim.current = null;
    fijarModo("desconectado");
  }, [fijarModo]);

  const enviar = useCallback(async (texto) => {
    if (sim.current) { sim.current.enviar(texto); return true; }
    const esc = serie.current.escritor;
    if (!esc) return false;
    await esc.write(texto + "\n");
    return true;
  }, []);

  const setVelocidadDemo = useCallback((v) => {
    setVelocidadDemoState(v);
    if (sim.current) sim.current.velocidad = v;
  }, []);

  const rellenarDemo = useCallback(() => sim.current?.rellenar(), []);
  const provocarDemo = useCallback((tipo) => sim.current?.provocar(tipo), []);

  useEffect(() => () => { sim.current?.detener(); }, []);

  return { modo, conectar, desconectar, iniciarDemo, detenerDemo, enviar, velocidadDemo, setVelocidadDemo, rellenarDemo, provocarDemo };
}
