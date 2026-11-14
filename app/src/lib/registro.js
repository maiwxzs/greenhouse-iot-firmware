// Registro de datos: convierte la telemetría en historial, resúmenes y eventos.
import { CAUDAL_L_POR_S, textoEstado } from "./protocolo.js";

export const SEGUNDOS_POR_MUESTRA = 2;
export const VENTANA_VIVO_MS = 30 * 60 * 1000;   // lo que se guarda en memoria para las gráficas en vivo
const LOTE_ESCRITURA = 15;                        // lecturas que se agrupan antes de escribir en disco

function minutoDe(t) {
  return Math.floor(t / 60000) * 60000;
}

function nuevoMinuto(t) {
  return { t, n: 0, tN: 0, tSum: 0, tMin: null, tMax: null, sN: 0, sSum: 0, sMin: null, sMax: null,
           vent: 0, bomba: 0, aire: 0, sinAgua: 0, alarma: 0, estado: null };
}

function acumular(m, l) {
  m.n++;
  if (typeof l.temp_c === "number") {
    m.tN++; m.tSum += l.temp_c;
    m.tMin = m.tMin === null ? l.temp_c : Math.min(m.tMin, l.temp_c);
    m.tMax = m.tMax === null ? l.temp_c : Math.max(m.tMax, l.temp_c);
  }
  if (typeof l.hum_suelo === "number") {
    m.sN++; m.sSum += l.hum_suelo;
    m.sMin = m.sMin === null ? l.hum_suelo : Math.min(m.sMin, l.hum_suelo);
    m.sMax = m.sMax === null ? l.hum_suelo : Math.max(m.sMax, l.hum_suelo);
  }
  m.vent += l.ventilador ? 1 : 0;
  m.bomba += l.bomba ? 1 : 0;
  m.aire += l.aire_alta ? 1 : 0;
  m.sinAgua += l.agua === 0 ? 1 : 0;
  m.alarma += l.alarma === 1 ? 1 : 0;
  m.estado = l.estado;
}

// Detecta qué cambió entre dos lecturas y lo describe como eventos
export function detectarEventos(antes, ahora) {
  const ev = [];
  const t = ahora.t;
  if (!antes) return ev;
  if (antes.estado !== ahora.estado) {
    const e = textoEstado(ahora.estado);
    ev.push({ t, tipo: "estado", texto: e.titulo, tono: e.tono });
  }
  if (!antes.bomba && ahora.bomba) ev.push({ t, tipo: "riego", texto: "Pulso de riego", tono: "agua" });
  if (antes.ventilador !== ahora.ventilador)
    ev.push({ t, tipo: "ventilador", texto: ahora.ventilador ? "Ventilador encendido" : "Ventilador apagado", tono: "neutro" });
  if (antes.aire_alta !== ahora.aire_alta && antes.aire_alta !== undefined)
    ev.push({ t, tipo: "aire", texto: ahora.aire_alta ? "Aire húmedo: contacto del HR202 cerrado" : "Humedad del aire normal", tono: ahora.aire_alta ? "agua" : "neutro" });
  if (antes.alarma !== 1 && ahora.alarma === 1) ev.push({ t, tipo: "alarma", texto: "Alarma activada", tono: "alarma" });
  if (antes.alarma === 1 && ahora.alarma === 2) ev.push({ t, tipo: "alarma", texto: "Alarma silenciada", tono: "neutro" });
  if (antes.agua === 1 && ahora.agua === 0) ev.push({ t, tipo: "tanque", texto: "Tanque vacío", tono: "alarma" });
  if (antes.agua === 0 && ahora.agua === 1) ev.push({ t, tipo: "tanque", texto: "Tanque con agua", tono: "agua" });
  if (typeof antes.temp_c === "number" && ahora.temp_c === null)
    ev.push({ t, tipo: "sensor", texto: "DS18B20 sin respuesta", tono: "alarma" });
  return ev;
}

export class Registro {
  constructor(almacen, alCambiar) {
    this.almacen = almacen;
    this.alCambiar = alCambiar;     // (vivo, eventosNuevos) => void
    this.vivo = [];
    this.anterior = null;
    this.minuto = null;
    this.pendientes = [];
    this.ultimaLimpieza = 0;
  }

  // Recibe una telemetría del Arduino (o del simulador)
  agregar(tel) {
    const lectura = { ...tel, t: Date.now() };
    delete lectura.tipo;

    this.vivo.push(lectura);
    const limite = lectura.t - VENTANA_VIVO_MS;
    while (this.vivo.length && this.vivo[0].t < limite) this.vivo.shift();

    const eventos = detectarEventos(this.anterior, lectura);
    this.anterior = lectura;

    const m = minutoDe(lectura.t);
    if (this.minuto && this.minuto.t !== m) {
      this.almacen.guardar("minutos", [this.minuto]);
      this.minuto = null;
    }
    if (!this.minuto) this.minuto = nuevoMinuto(m);
    acumular(this.minuto, lectura);

    this.pendientes.push(lectura);
    if (this.pendientes.length >= LOTE_ESCRITURA) this.vaciar();
    if (eventos.length) this.almacen.guardar("eventos", eventos);

    if (lectura.t - this.ultimaLimpieza > 3600000) {
      this.ultimaLimpieza = lectura.t;
      this.almacen.limpiar(lectura.t);
    }
    this.alCambiar(this.vivo, eventos);
    return lectura;
  }

  // Eventos que no vienen de la telemetría (conexión, comandos, errores)
  anotar(tipo, texto, tono = "neutro") {
    const ev = { t: Date.now(), tipo, texto, tono };
    this.almacen.guardar("eventos", [ev]);
    this.alCambiar(this.vivo, [ev]);
  }

  vaciar() {
    const lote = this.pendientes;
    this.pendientes = [];
    this.almacen.guardar("lecturas", lote);
    if (this.minuto) this.almacen.guardar("minutos", [this.minuto]);
  }

  reiniciar() {
    this.vaciar();
    this.vivo = [];
    this.anterior = null;
    this.minuto = null;
  }
}

// ----------------------------- Estadísticas -----------------------------

export function claveDia(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Resumen por día a partir de los minutos guardados
export function resumirPorDia(minutos, eventos = []) {
  const dias = new Map();
  for (const m of minutos) {
    const k = claveDia(m.t);
    if (!dias.has(k)) dias.set(k, { dia: k, t: m.t, n: 0, tN: 0, tSum: 0, tMin: null, tMax: null, sN: 0, sSum: 0,
                                   vent: 0, bomba: 0, aire: 0, alarma: 0, riegos: 0, alarmas: 0 });
    const d = dias.get(k);
    d.n += m.n; d.tN += m.tN; d.tSum += m.tSum; d.sN += m.sN; d.sSum += m.sSum;
    if (m.tMin !== null) d.tMin = d.tMin === null ? m.tMin : Math.min(d.tMin, m.tMin);
    if (m.tMax !== null) d.tMax = d.tMax === null ? m.tMax : Math.max(d.tMax, m.tMax);
    d.vent += m.vent; d.bomba += m.bomba; d.aire += m.aire; d.alarma += m.alarma;
  }
  for (const e of eventos) {
    const d = dias.get(claveDia(e.t));
    if (!d) continue;
    if (e.tipo === "riego") d.riegos++;
    if (e.tipo === "alarma" && e.texto === "Alarma activada") d.alarmas++;
  }
  return [...dias.values()].sort((a, b) => b.t - a.t).map((d) => ({
    dia: d.dia,
    t: d.t,
    horasRegistradas: (d.n * SEGUNDOS_POR_MUESTRA) / 3600,
    tMin: d.tMin,
    tMax: d.tMax,
    tProm: d.tN ? d.tSum / d.tN : null,
    sueloProm: d.sN ? d.sSum / d.sN : null,
    ventiladorMin: (d.vent * SEGUNDOS_POR_MUESTRA) / 60,
    bombaS: d.bomba * SEGUNDOS_POR_MUESTRA,
    aguaL: d.bomba * SEGUNDOS_POR_MUESTRA * CAUDAL_L_POR_S,
    aireAltoMin: (d.aire * SEGUNDOS_POR_MUESTRA) / 60,
    riegos: d.riegos,
    alarmas: d.alarmas,
  }));
}

// Serie para gráficas a partir de los minutos (promedio y extremos)
export function serieMinutos(minutos) {
  return minutos.map((m) => ({
    t: m.t,
    temp: m.tN ? m.tSum / m.tN : null,
    tempMin: m.tMin,
    tempMax: m.tMax,
    suelo: m.sN ? m.sSum / m.sN : null,
    vent: m.n ? m.vent / m.n : 0,
    bomba: m.n ? m.bomba / m.n : 0,
    aire: m.n ? m.aire / m.n : 0,
  }));
}
