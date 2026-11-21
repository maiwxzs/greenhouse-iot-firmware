import { useEffect, useRef, useState } from "react";

// interpola hacia el nuevo valor (ease-out cúbico)
export function useSuave(valor, ms = 700) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    if (typeof valor !== "number" || typeof desde.current !== "number") { desde.current = valor; setMostrado(valor); return undefined; }
    const a = desde.current, t0 = performance.now();
    let id;
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), e = 1 - (1 - k) ** 3;
      const v = a + (valor - a) * e;
      desde.current = v; setMostrado(v);
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor, ms]);
  return mostrado;
}

// re-render periódico para contadores en vivo
export function useAhora(ms = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return ahora;
}

export function duracion(ms) {
  if (ms == null || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, "0")} min`;
}
