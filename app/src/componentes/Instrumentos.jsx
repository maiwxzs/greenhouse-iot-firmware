import { useEffect, useRef, useState } from "react";
import { LuDroplets, LuGlassWater, LuSprout, LuThermometer } from "react-icons/lu";

// Interpola un número hacia su nuevo valor (los dígitos "corren" hasta la lectura nueva)
export function useTween(valor, duracion = 900) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    if (typeof valor !== "number") { setMostrado(valor); desde.current = valor; return; }
    const inicio = typeof desde.current === "number" ? desde.current : valor;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / duracion);
      const e = 1 - Math.pow(1 - k, 3);
      const v = inicio + (valor - inicio) * e;
      setMostrado(v);
      desde.current = v;
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, duracion]);
  // Mientras arranca la animación, nunca se devuelve un valor de otro tipo
  return typeof valor === "number" && typeof mostrado !== "number" ? valor : mostrado;
}

const pct = (v, min, max) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));

function Temperatura({ t, cfg }) {
  const temp = typeof t?.temp_c === "number" ? t.temp_c : null;
  const v = useTween(temp);
  const max = cfg?.temp_max ?? 30, crit = cfg?.temp_crit ?? 35;
  const ang = temp === null ? -90 : -90 + (Math.max(0, Math.min(45, temp)) / 45) * 180;
  const arco = (a0, a1) => {
    const r = 46, cx = 55, cy = 58, p = (a) => [cx + r * Math.cos((a - 180) * Math.PI / 180), cy + r * Math.sin((a - 180) * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const g = (c) => (c / 45) * 180;
  const alerta = temp === null || temp >= crit;
  return (
    <article className="instrumento" data-tema="temp" data-alerta={+alerta}>
      <header><LuThermometer /> Temperatura</header>
      <div className="medidor">
        <svg viewBox="0 0 110 66" aria-hidden="true">
          <path d={arco(0, g(max))} stroke="#BFDDC9" strokeWidth="9" fill="none" />
          <path d={arco(g(max), g(crit))} stroke="#EBCB8B" strokeWidth="9" fill="none" />
          <path d={arco(g(crit), 180)} stroke="#E4A39F" strokeWidth="9" fill="none" />
          <g className="aguja" style={{ transform: `rotate(${ang}deg)` }}>
            <line x1="55" y1="58" x2="55" y2="18" stroke="#1E2D24" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="55" cy="58" r="5" fill="#1E2D24" />
        </svg>
        <div className="valor">{temp === null ? "--" : v.toFixed(1)}<small>°C</small></div>
      </div>
      <div className="pie">{temp === null ? "El DS18B20 no responde." : `Ventila sobre ${max} °C, alarma en ${crit} °C.`}</div>
    </article>
  );
}

function Suelo({ t, cfg }) {
  const s = typeof t?.hum_suelo === "number" ? t.hum_suelo : null;
  const v = useTween(s);
  const min = cfg?.suelo_min ?? 30, max = cfg?.suelo_max ?? 85;
  const usado = cfg ? cfg.sonda_suelo !== 0 : true;
  return (
    <article className="instrumento" data-tema="suelo" data-alerta={+(s !== null && s < min)}>
      <header><LuSprout /> Humedad del suelo</header>
      <div className="valor">{s === null ? "--" : Math.round(v)}<small>%</small></div>
      <div className="barra" aria-hidden="true">
        <div className="banda" style={{ left: `${min}%`, width: `${max - min}%` }} />
        {s !== null && <div className="marca" style={{ left: `${pct(s, 0, 100)}%` }} />}
      </div>
      <div className="pie">
        {!usado ? "Sonda de suelo desactivada." : s === null ? "La sonda no toca tierra o está desconectada." : `Riega bajo ${min} %; no riega sobre ${max} %.`}
      </div>
    </article>
  );
}

function Aire({ t, desde }) {
  const alta = t?.aire === "ALTA";
  const minutos = desde ? Math.max(0, Math.round((Date.now() - desde) / 60000)) : null;
  return (
    <article className="instrumento" data-tema="aire">
      <header><LuDroplets /> Humedad del aire</header>
      <div className="valor" style={{ fontSize: "2.1rem", lineHeight: 1.2 }}>{t ? (alta ? "Alta" : "Normal") : "--"}</div>
      <div className="barra" aria-hidden="true">
        <div className="banda" style={{ left: 0, width: alta ? "100%" : "55%", background: alta ? "#B5D1EA" : "#BFDDC9", transition: "width 1s, background 1s" }} />
      </div>
      <div className="pie">
        {alta ? "Sobre el umbral del módulo HR202: ventilación activa." : "Bajo el umbral ajustado en el módulo HR202."}
        {minutos !== null && t ? ` Desde hace ${minutos} min.` : ""}
      </div>
    </article>
  );
}

function Tanque({ t, aguaHoy }) {
  const vacio = t?.agua === 0;
  const uso = t ? Math.min(1, (t.bomba_s_hora || 0) / 900) : 0;
  const r = 20, circ = 2 * Math.PI * r;
  return (
    <article className="instrumento" data-tema="aire" data-alerta={+vacio}>
      <header><LuGlassWater /> Tanque y bomba</header>
      <div className="fila-tanque">
        <svg viewBox="0 0 50 50" width="54" height="54" aria-hidden="true">
          <circle cx="25" cy="25" r={r} stroke="#DFE8E3" strokeWidth="6" fill="none" />
          <circle className="anillo" cx="25" cy="25" r={r} stroke="#2370AE" strokeWidth="6" fill="none" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - uso)} transform="rotate(-90 25 25)" />
        </svg>
        <div className="valor" style={{ fontSize: "1.9rem" }}>{!t ? "--" : vacio ? "Vacío" : "Con agua"}</div>
      </div>
      <div className="pie">
        Bomba: {t ? t.bomba_s_hora : 0} s de 900 s en esta hora.
        {aguaHoy !== null ? ` Agua usada hoy ≈ ${aguaHoy.toFixed(2)} L.` : ""}
      </div>
    </article>
  );
}

export default function Instrumentos({ t, cfg, aireDesde, aguaHoy }) {
  return (
    <section className="instrumentos" aria-label="Lecturas de los sensores">
      <Temperatura t={t} cfg={cfg} />
      <Suelo t={t} cfg={cfg} />
      <Aire t={t} desde={aireDesde} />
      <Tanque t={t} aguaHoy={aguaHoy} />
    </section>
  );
}
