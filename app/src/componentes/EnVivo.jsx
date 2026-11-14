import { GraficaTiempo, TiraActuadores } from "./Grafica.jsx";

export default function EnVivo({ vivo, cfg }) {
  const hasta = vivo.length ? vivo[vivo.length - 1].t : Date.now();
  const desde = hasta - 30 * 60 * 1000;
  const datos = vivo.map((l) => ({ ...l, aire: l.aire_alta }));
  return (
    <div className="rejilla-2">
      <section className="bloque">
        <h3>Temperatura, últimos 30 minutos</h3>
        <p className="nota">Lectura del DS18B20 cada 2 s. Pasa el mouse sobre la gráfica para ver cada valor.</p>
        <GraficaTiempo datos={datos} desde={desde} hasta={hasta} unidad="°"
          series={[{ campo: "temp_c", nombre: "Temperatura", color: "#B9790A" }]}
          umbrales={[{ valor: cfg?.temp_max ?? 30, color: "#D07A12", etiqueta: "ventilar" }, { valor: cfg?.temp_crit ?? 35, color: "#B3332E", etiqueta: "alarma" }]} />
      </section>
      <section className="bloque">
        <h3>Humedad del suelo, últimos 30 minutos</h3>
        <p className="nota">La franja verde es el rango ideal: bajo ella se riega, sobre ella se pausa el riego.</p>
        <GraficaTiempo datos={datos} desde={desde} hasta={hasta} dominio={[0, 100]} unidad="%"
          series={[{ campo: "hum_suelo", nombre: "Suelo", color: "#2E7A4C" }]}
          banda={{ min: cfg?.suelo_min ?? 30, max: cfg?.suelo_max ?? 85, color: "#7FC198" }} />
      </section>
      <section className="bloque" style={{ gridColumn: "1 / -1" }}>
        <h3>Actuadores y humedad del aire</h3>
        <p className="nota">Cada franja marca cuándo estuvo encendido. La bomba nunca coincide con el ventilador: comparten la energía del USB.</p>
        <TiraActuadores datos={datos} desde={desde} hasta={hasta} campos={[
          { campo: "bomba", nombre: "Bomba", color: "#2370AE" },
          { campo: "ventilador", nombre: "Ventilador", color: "#2E7A4C" },
          { campo: "aire", nombre: "Aire alto", color: "#8DB8DD" },
        ]} />
      </section>
    </div>
  );
}
