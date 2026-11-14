import { useEffect, useMemo, useState } from "react";
import { LuDownload } from "react-icons/lu";
import { GraficaTiempo, TiraActuadores, formatoFecha } from "./Grafica.jsx";
import { resumirPorDia, serieMinutos } from "../lib/registro.js";

const RANGOS = [["1", "Hoy"], ["7", "7 días"], ["30", "30 días"]];
const num = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function inicioDe(dias) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (Number(dias) - 1) * 86400000;
}

function descargar(nombre, filas) {
  const csv = "﻿" + filas.map((f) => f.map((v) => (typeof v === "number" ? String(v).replace(".", ",") : v ?? "")).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function Historial({ almacen, version }) {
  const [rango, setRango] = useState("1");
  const [minutos, setMinutos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const desde = inicioDe(rango), hasta = Date.now();

  useEffect(() => {
    let vivo = true;
    Promise.all([almacen.rango("minutos", desde, hasta), almacen.rango("eventos", desde, hasta)]).then(([m, e]) => {
      if (vivo) { setMinutos(m); setEventos(e); }
    });
    return () => { vivo = false; };
    // version: se recarga cuando llegan datos nuevos (cada minuto)
  }, [almacen, rango, version]);   // eslint-disable-line react-hooks/exhaustive-deps

  const serie = useMemo(() => serieMinutos(minutos), [minutos]);
  const dias = useMemo(() => resumirPorDia(minutos, eventos), [minutos, eventos]);
  const total = dias.reduce((a, d) => ({
    agua: a.agua + d.aguaL, vent: a.vent + d.ventiladorMin, aire: a.aire + d.aireAltoMin, riegos: a.riegos + d.riegos, alarmas: a.alarmas + d.alarmas,
  }), { agua: 0, vent: 0, aire: 0, riegos: 0, alarmas: 0 });
  const tMin = Math.min(...dias.map((d) => d.tMin ?? Infinity)), tMax = Math.max(...dias.map((d) => d.tMax ?? -Infinity));
  const formatoX = rango === "1" ? undefined : (t) => formatoFecha(t).slice(0, 5);

  const exportarMinutos = async () => {
    const filas = [["fecha", "temp_prom_c", "temp_min_c", "temp_max_c", "suelo_prom_pct", "ventilador_frac", "bomba_frac", "aire_alto_frac"]];
    serie.forEach((s) => filas.push([formatoFecha(s.t), s.temp, s.tempMin, s.tempMax, s.suelo, s.vent, s.bomba, s.aire]));
    descargar(`invernadero_minutos_${new Date().toISOString().slice(0, 10)}.csv`, filas);
  };
  const exportarLecturas = async () => {
    const lecturas = await almacen.rango("lecturas", desde, hasta);
    const cols = ["t", "hora", "temp_c", "hum_suelo", "aire_alta", "agua", "estado", "ventilador", "bomba", "alarma", "adc_suelo", "adc_agua"];
    const filas = [["fecha", ...cols.slice(1)]];
    lecturas.forEach((l) => filas.push([formatoFecha(l.t) + ":" + String(new Date(l.t).getSeconds()).padStart(2, "0"), ...cols.slice(1).map((c) => l[c])]));
    descargar(`invernadero_lecturas_${new Date().toISOString().slice(0, 10)}.csv`, filas);
  };

  return (
    <div>
      <div className="cabecera">
        <div className="segmentado" role="group" aria-label="Periodo">
          {RANGOS.map(([v, txt]) => <button key={v} type="button" aria-pressed={rango === v} onClick={() => setRango(v)}>{txt}</button>)}
        </div>
        <div className="fila-botones" style={{ marginTop: 0 }}>
          <button className="boton sec chico" type="button" onClick={exportarMinutos} disabled={!serie.length}><LuDownload /> Resumen por minuto (CSV)</button>
          <button className="boton sec chico" type="button" onClick={exportarLecturas} disabled={!serie.length}><LuDownload /> Lecturas detalladas (CSV)</button>
        </div>
      </div>

      {!serie.length ? (
        <p className="vacio">No hay datos guardados en este periodo. El historial se llena solo mientras la aplicación está conectada al Arduino.</p>
      ) : (
        <>
          <div className="tarjetas">
            <div className="tarjeta"><span>Temperatura mínima / máxima</span><b>{num(tMin)} / {num(tMax)}<small>°C</small></b></div>
            <div className="tarjeta"><span>Agua de riego (estimada)</span><b>{num(total.agua, 2)}<small>L</small></b></div>
            <div className="tarjeta"><span>Pulsos de riego</span><b>{total.riegos}</b></div>
            <div className="tarjeta"><span>Ventilador encendido</span><b>{num(total.vent, 0)}<small>min</small></b></div>
            <div className="tarjeta"><span>Aire húmedo</span><b>{num(total.aire, 0)}<small>min</small></b></div>
            <div className="tarjeta"><span>Alarmas</span><b>{total.alarmas}</b></div>
          </div>
          <div className="rejilla-2">
            <section className="bloque">
              <h3>Temperatura promedio por minuto</h3>
              <p className="nota">La franja muestra el mínimo y el máximo de cada minuto.</p>
              <GraficaTiempo datos={serie} desde={desde} hasta={hasta} unidad="°" formatoX={formatoX}
                series={[{ campo: "temp", nombre: "Promedio", color: "#B9790A" }]}
                rangoArea={{ min: "tempMin", max: "tempMax", color: "#B9790A" }} />
            </section>
            <section className="bloque">
              <h3>Humedad del suelo</h3>
              <p className="nota">Cada subida brusca corresponde a un riego.</p>
              <GraficaTiempo datos={serie} desde={desde} hasta={hasta} dominio={[0, 100]} unidad="%" formatoX={formatoX}
                series={[{ campo: "suelo", nombre: "Suelo", color: "#2E7A4C" }]} />
            </section>
            <section className="bloque" style={{ gridColumn: "1 / -1" }}>
              <h3>Actuadores y humedad del aire</h3>
              <TiraActuadores datos={serie} desde={desde} hasta={hasta} umbral={0} campos={[
                { campo: "bomba", nombre: "Bomba", color: "#2370AE" },
                { campo: "vent", nombre: "Ventilador", color: "#2E7A4C" },
                { campo: "aire", nombre: "Aire alto", color: "#8DB8DD" },
              ]} />
            </section>
          </div>
          <section className="bloque" style={{ marginTop: 18 }}>
            <h3>Resumen diario</h3>
            <div className="desplazable">
              <table className="tabla">
                <thead><tr>
                  <th>Día</th><th>Horas con datos</th><th>T. mín</th><th>T. prom</th><th>T. máx</th><th>Suelo prom.</th>
                  <th>Riegos</th><th>Agua (L)</th><th>Ventilador (min)</th><th>Aire húmedo (min)</th><th>Alarmas</th>
                </tr></thead>
                <tbody>
                  {dias.map((d) => (
                    <tr key={d.dia}>
                      <td>{d.dia}</td><td>{num(d.horasRegistradas)}</td><td>{num(d.tMin)}</td><td>{num(d.tProm)}</td><td>{num(d.tMax)}</td>
                      <td>{num(d.sueloProm, 0)} %</td><td>{d.riegos}</td><td>{num(d.aguaL, 2)}</td><td>{num(d.ventiladorMin, 0)}</td>
                      <td>{num(d.aireAltoMin, 0)}</td><td>{d.alarmas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota" style={{ marginTop: 8 }}>El agua se estima con el caudal nominal de la bomba (100 L/h) y el tiempo que estuvo encendida.</p>
          </section>
        </>
      )}
    </div>
  );
}
