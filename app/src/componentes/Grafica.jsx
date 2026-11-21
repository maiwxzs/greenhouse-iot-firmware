import { useId, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleTime } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";

const dos = (n) => String(n).padStart(2, "0");
export const formatoHora = (t) => { const d = new Date(t); return `${dos(d.getHours())}:${dos(d.getMinutes())}`; };
export const formatoFecha = (t) => { const d = new Date(t); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${formatoHora(t)}`; };

// serie temporal con banda, umbrales y cursor
export function GraficaTiempo({ datos, series, desde, hasta, dominio, banda, umbrales = [], alto = 200, unidad = "", formatoX = formatoHora, rangoArea }) {
  const ref = useRef(null);
  const [cursor, setCursor] = useState(null);
  const ancho = 720, m = { i: 40, d: 12, s: 10, b: 24 };

  const uid = useId().replace(/:/g, "");
  const { x, y, caminos, areas, ticksY, ticksX, areaRango } = useMemo(() => {
    const x = scaleTime().domain([desde, hasta]).range([m.i, ancho - m.d]);
    let [y0, y1] = dominio || [0, 100];
    if (!dominio) {
      const vals = datos.flatMap((d) => series.map((s) => d[s.campo])).filter((v) => typeof v === "number");
      umbrales.forEach((u) => vals.push(u.valor));
      if (vals.length) { y0 = Math.floor(Math.min(...vals) - 1); y1 = Math.ceil(Math.max(...vals) + 1); }
    }
    const y = scaleLinear().domain([y0, y1]).nice(5).range([alto - m.b, m.s]);
    const caminos = series.map((s) => line().defined((d) => typeof d[s.campo] === "number")
      .x((d) => x(d.t)).y((d) => y(d[s.campo])).curve(curveMonotoneX)(datos) || "");
    const areas = series.map((s) => area().defined((d) => typeof d[s.campo] === "number")
      .x((d) => x(d.t)).y0(alto - m.b).y1((d) => y(d[s.campo])).curve(curveMonotoneX)(datos) || "");
    const areaRango = rangoArea ? area().defined((d) => typeof d[rangoArea.min] === "number")
      .x((d) => x(d.t)).y0((d) => y(d[rangoArea.min])).y1((d) => y(d[rangoArea.max])).curve(curveMonotoneX)(datos) : null;
    return { x, y, caminos, areas, ticksY: y.ticks(5), ticksX: x.ticks(6), areaRango };
  }, [datos, series, desde, hasta, dominio, umbrales, alto, rangoArea]);

  const mover = (e) => {
    if (!datos.length || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * ancho;
    const t = x.invert(px).getTime();
    let mejor = datos[0];
    for (const d of datos) if (Math.abs(d.t - t) < Math.abs(mejor.t - t)) mejor = d;
    setCursor(mejor);
  };

  const ultimo = datos[datos.length - 1];
  return (
    <div className="grafica">
      <svg ref={ref} viewBox={`0 0 ${ancho} ${alto}`} onPointerMove={mover} onPointerLeave={() => setCursor(null)} role="img">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.campo} id={`${uid}-g${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity={series.length > 1 ? 0.12 : 0.32} />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
          <filter id={`${uid}-brillo`} x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        <g className="rejilla">
          {ticksY.map((v) => <line key={v} x1={m.i} x2={ancho - m.d} y1={y(v)} y2={y(v)} />)}
        </g>
        <g className="eje">
          {ticksY.map((v) => <text key={v} x={m.i - 7} y={y(v) + 4} textAnchor="end">{v}{unidad}</text>)}
          {ticksX.map((t) => <text key={+t} x={x(t)} y={alto - 6} textAnchor="middle">{formatoX(t)}</text>)}
        </g>
        {banda && (
          <rect x={m.i} width={ancho - m.i - m.d} y={y(Math.min(banda.max, y.domain()[1]))}
            height={Math.max(0, y(Math.max(banda.min, y.domain()[0])) - y(Math.min(banda.max, y.domain()[1])))} fill={banda.color} opacity=".22" />
        )}
        {areaRango && <path d={areaRango} fill={rangoArea.color} opacity=".18" />}
        {umbrales.map((u) => (
          <g key={u.etiqueta}>
            <line x1={m.i} x2={ancho - m.d} y1={y(u.valor)} y2={y(u.valor)} stroke={u.color} strokeDasharray="5 4" strokeWidth="1.5" />
            <text x={ancho - m.d} y={y(u.valor) - 4} textAnchor="end" fontSize="10" fill={u.color}>{u.etiqueta}</text>
          </g>
        ))}
        {/* El trazo se dibuja de izquierda a derecha al cambiar de periodo */}
        <g className="series" key={`${Math.round((hasta - desde) / 60000)}-${datos.length > 0}`}>
          {areas.map((d, i) => <path key={`a${i}`} d={d} fill={`url(#${uid}-g${i})`} className="serie-area" />)}
          {caminos.map((d, i) => <path key={`b${i}`} d={d} fill="none" stroke={series[i].color} strokeWidth="5" opacity=".35" filter={`url(#${uid}-brillo)`} pathLength="1" className="serie-linea" />)}
          {caminos.map((d, i) => <path key={series[i].campo} d={d} fill="none" stroke={series[i].color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" pathLength="1" className="serie-linea" />)}
        </g>
        {ultimo && series.map((s) => typeof ultimo[s.campo] === "number" && (
          <g key={s.campo}>
            <circle cx={x(ultimo.t)} cy={y(ultimo[s.campo])} r="4" fill={s.color} stroke="var(--panel)" strokeWidth="2" />
          </g>
        ))}
        {!datos.length && <text x={ancho / 2} y={alto / 2} textAnchor="middle" fill="var(--tinta-3)" fontSize="13">Aún no hay datos en este periodo</text>}
        {cursor && <line className="cursor" x1={x(cursor.t)} x2={x(cursor.t)} y1={m.s} y2={alto - m.b} />}
        {cursor && series.map((s) => typeof cursor[s.campo] === "number" && (
          <circle key={s.campo} cx={x(cursor.t)} cy={y(cursor[s.campo])} r="4.5" fill="var(--panel)" stroke={s.color} strokeWidth="2.2" className="punto-cursor" />
        ))}
      </svg>
      {/* el pulso va fuera del SVG: así se anima en la GPU y no repinta la gráfica */}
      {ultimo && series.map((s) => typeof ultimo[s.campo] === "number" && (
        <span key={s.campo} className="punto-vivo" style={{ left: `${(x(ultimo.t) / ancho) * 100}%`, top: `${(y(ultimo[s.campo]) / alto) * 100}%`, background: s.color }} />
      ))}
      {cursor && (
        <div className="tooltip" style={{ left: `${(x(cursor.t) / ancho) * 100}%`, top: 8 }}>
          <div>{formatoFecha(cursor.t)}</div>
          {series.map((s) => (
            <div key={s.campo}><i style={{ background: s.color }} />{s.nombre}: <b>{typeof cursor[s.campo] === "number" ? cursor[s.campo].toFixed(1) : "sin dato"}{unidad}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// franjas on/off; umbral = fracción mínima para considerarlo encendido
export function TiraActuadores({ datos, desde, hasta, campos, umbral = 0.5 }) {
  const total = Math.max(1, hasta - desde);
  const pos = (t) => Math.max(0, Math.min(100, ((t - desde) / total) * 100));
  const tramos = (campo) => {
    const res = [];
    let ini = null;
    datos.forEach((d, k) => {
      const on = (d[campo] || 0) > umbral;
      if (on && ini === null) ini = d.t;
      const fin = k === datos.length - 1;
      if ((!on || fin) && ini !== null) { res.push([ini, on && fin ? d.t + 2000 : d.t]); ini = null; }
    });
    return res;
  };
  return (
    <div className="tira" role="img" aria-label="Encendido de actuadores en el tiempo">
      {campos.map((c) => (
        <div key={c.campo} className="tira-fila">
          <span>{c.nombre}</span>
          <div className="tira-pista">
            {tramos(c.campo).map(([a, b]) => (
              <i key={a} style={{ left: `${pos(a)}%`, width: `max(3px, ${pos(b) - pos(a)}%)`, "--c": c.color }} />
            ))}
          </div>
        </div>
      ))}
      <div className="tira-fila tira-eje"><span /><div><span>{formatoHora(desde)}</span><span>{formatoHora(hasta)}</span></div></div>
    </div>
  );
}
