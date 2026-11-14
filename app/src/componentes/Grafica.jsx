import { useMemo, useRef, useState } from "react";
import { scaleLinear, scaleTime } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";

const dos = (n) => String(n).padStart(2, "0");
export const formatoHora = (t) => { const d = new Date(t); return `${dos(d.getHours())}:${dos(d.getMinutes())}`; };
export const formatoFecha = (t) => { const d = new Date(t); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${formatoHora(t)}`; };

// Serie temporal con banda de rango ideal, líneas de umbral y cursor con valor exacto
export function GraficaTiempo({ datos, series, desde, hasta, dominio, banda, umbrales = [], alto = 200, unidad = "", formatoX = formatoHora, rangoArea }) {
  const ref = useRef(null);
  const [cursor, setCursor] = useState(null);
  const ancho = 720, m = { i: 40, d: 12, s: 10, b: 24 };

  const { x, y, caminos, ticksY, ticksX, areaRango } = useMemo(() => {
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
    const areaRango = rangoArea ? area().defined((d) => typeof d[rangoArea.min] === "number")
      .x((d) => x(d.t)).y0((d) => y(d[rangoArea.min])).y1((d) => y(d[rangoArea.max])).curve(curveMonotoneX)(datos) : null;
    return { x, y, caminos, ticksY: y.ticks(5), ticksX: x.ticks(6), areaRango };
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
        {caminos.map((d, i) => <path key={series[i].campo} d={d} fill="none" stroke={series[i].color} strokeWidth="2.2" strokeLinejoin="round" />)}
        {ultimo && series.map((s) => typeof ultimo[s.campo] === "number" && (
          <circle key={s.campo} cx={x(ultimo.t)} cy={y(ultimo[s.campo])} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />
        ))}
        {!datos.length && <text x={ancho / 2} y={alto / 2} textAnchor="middle" fill="#7A8B80" fontSize="13">Aún no hay datos en este periodo</text>}
        {cursor && <line className="cursor" x1={x(cursor.t)} x2={x(cursor.t)} y1={m.s} y2={alto - m.b} />}
      </svg>
      {cursor && (
        <div className="tooltip" style={{ left: `${(x(cursor.t) / ancho) * 100}%`, top: 8 }}>
          <div>{formatoFecha(cursor.t)}</div>
          {series.map((s) => (
            <div key={s.campo}>{s.nombre}: <b>{typeof cursor[s.campo] === "number" ? cursor[s.campo].toFixed(1) : "sin dato"}{unidad}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// Franjas de encendido de bomba y ventilador, y del contacto de humedad del aire.
// umbral: fracción a partir de la cual se considera encendido (0 en resúmenes por minuto).
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
              <i key={a} style={{ left: `${pos(a)}%`, width: `max(2px, ${pos(b) - pos(a)}%)`, background: c.color }} />
            ))}
          </div>
        </div>
      ))}
      <div className="tira-fila tira-eje"><span /><div><span>{formatoHora(desde)}</span><span>{formatoHora(hasta)}</span></div></div>
    </div>
  );
}
