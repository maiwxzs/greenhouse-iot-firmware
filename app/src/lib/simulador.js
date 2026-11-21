// Arduino simulado (mismo protocolo que el firmware 3.x)
import { CAUDAL_L_POR_S, dos } from "./protocolo.js";

const CAPACIDAD_TANQUE_L = 1.0;   // 12 x 8.5 x 10 cm

const FABRICA = {
  temp_max: 30, temp_hist: 2, temp_crit: 35, suelo_min: 30, suelo_max: 85, hist: 5,
  adc_suelo_seco: 1000, adc_suelo_hum: 250, umbral_agua: 700,
};

export class Simulador {
  constructor() {
    this.timer = null;
    this.velocidad = 1;
  }

  iniciar(alRecibir) {
    this.emitir = alRecibir;
    const n = new Date();
    this.reloj = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
    this.ms = 0;
    this.cfg = { tipo: "cfg", version: "3.0.0-demo", ...FABRICA, solo_arduino: 1, sonda_suelo: 1, sonda_agua: 1, lcd: 1 };
    this.m = {
      temp: 26, hr: 62, suelo: 41, tanqueL: 0.85,
      calor: false, aireAlta: false, sueloEstado: "NORMAL",
      bombaHasta: -1, ultimaBomba: -1e9, bombaMsHora: 0, ventanaHora: 0,
      silencioHasta: -1, vent: false,
    };
    ["# Smart Greenhouse IoT v3.0.0 (simulado en la aplicación)", "# Ajustes de fabrica"].forEach((l) => this.emitir(l));
    this.emitir(JSON.stringify(this.cfg));
    this.timer = setInterval(() => this.paso(), 2000);
    setTimeout(() => this.paso(), 300);
  }

  detener() {
    clearInterval(this.timer);
    this.timer = null;
  }

  rellenar() {
    this.m.tanqueL = CAPACIDAD_TANQUE_L * 0.95;
    this.emitir("# Tanque rellenado (demostración)");
    this.paso();
  }

  // solo demo
  provocar(tipo) {
    const m = this.m;
    if (tipo === "calor") m.temp = Math.max(m.temp, (this.cfg.temp_max ?? 30) + 2.5);
    if (tipo === "critico") m.temp = Math.max(m.temp, (this.cfg.temp_crit ?? 35) + 0.8);
    if (tipo === "frio") m.temp = Math.min(m.temp, (this.cfg.temp_max ?? 30) - 6);
    if (tipo === "seco") m.suelo = Math.min(m.suelo, (this.cfg.suelo_min ?? 30) - 6);
    if (tipo === "humedo") m.hr = 92;
    if (tipo === "vaciar") m.tanqueL = 0.04;
    this.emitir(`# Demostración: ${tipo}`);
    this.paso();
  }

  paso() {
    const c = this.cfg, m = this.m;
    const dt = 2 * this.velocidad;            // s por paso
    this.ms += dt * 1000;
    const seg = Math.floor(this.reloj + this.ms / 1000) % 86400;
    const hora = seg / 3600;

    // clima diario
    const ambiente = 24 + 7 * Math.sin(((hora - 9) / 24) * 2 * Math.PI);
    const bombaActiva = this.ms < m.bombaHasta;
    m.temp += ((ambiente - m.temp) * 0.004 + (m.vent ? -0.05 : 0.01)) * dt + (Math.random() - 0.5) * 0.06;
    m.hr += ((bombaActiva ? 0.9 : -0.03) + (m.vent ? -0.12 : 0.02)) * dt + (Math.random() - 0.5) * 0.3;
    const secado = 0.0035 + Math.max(0, m.temp - 24) * 0.0012;
    m.suelo += (bombaActiva ? 0.9 : -secado) * dt + (Math.random() - 0.5) * 0.05;
    if (bombaActiva) m.tanqueL = Math.max(0, m.tanqueL - CAUDAL_L_POR_S * dt);
    m.temp = Math.min(41, Math.max(12, m.temp));
    m.hr = Math.min(98, Math.max(30, m.hr));
    m.suelo = Math.min(97, Math.max(4, m.suelo));

    // mismas reglas del firmware
    if (!m.calor && m.temp > c.temp_max) m.calor = true;
    else if (m.calor && m.temp < c.temp_max - c.temp_hist) m.calor = false;
    if (!m.aireAlta && m.hr > 82) m.aireAlta = true;          // umbral del potenciómetro
    else if (m.aireAlta && m.hr < 78) m.aireAlta = false;
    const clas = (v, est) => {
      if (est === "BAJA" && v < c.suelo_min + c.hist) return "BAJA";
      if (est === "ALTA" && v > c.suelo_max - c.hist) return "ALTA";
      return v < c.suelo_min ? "BAJA" : v > c.suelo_max ? "ALTA" : "NORMAL";
    };
    m.sueloEstado = clas(m.suelo, m.sueloEstado);
    const hayAgua = m.tanqueL > 0.08;
    const critico = m.temp >= c.temp_crit;

    if (this.ms - m.ventanaHora >= 3600000) { m.ventanaHora = this.ms; m.bombaMsHora = 0; }
    if (hayAgua && m.sueloEstado === "BAJA" && !bombaActiva && this.ms - m.ultimaBomba >= 65000 && m.bombaMsHora < 900000) {
      m.bombaHasta = this.ms + 5000; m.ultimaBomba = this.ms; m.bombaMsHora += 5000;
    }
    if (!hayAgua) m.bombaHasta = -1;
    const bomba = this.ms < m.bombaHasta;

    const quiereVent = m.calor || m.aireAlta;
    m.vent = quiereVent && !bomba;

    const estado = !hayAgua ? "SIN_AGUA" : critico ? "TEMPERATURA_CRITICA" : m.calor ? "TEMPERATURA_ALTA"
      : m.sueloEstado === "BAJA" ? "SUELO_SECO" : m.sueloEstado === "ALTA" ? "SUELO_ENCHARCADO"
      : m.aireAlta ? "HUMEDAD_ALTA" : "NORMAL";
    const hayAlarma = !hayAgua || critico;
    const alarma = hayAlarma ? (this.ms < m.silencioHasta ? 2 : 1) : 0;
    const adcSuelo = Math.round(c.adc_suelo_seco + (c.adc_suelo_hum - c.adc_suelo_seco) * m.suelo / 100);

    this.emitir(JSON.stringify({
      tipo: "tel", t_ms: Math.round(this.ms), hora: `${dos(Math.floor(seg / 3600))}:${dos(Math.floor(seg / 60) % 60)}:${dos(seg % 60)}`,
      hora_sync: 1, temp_c: Math.round(m.temp * 100) / 100, aire_alta: m.aireAlta ? 1 : 0,
      hum_suelo: Math.round(m.suelo * 10) / 10, adc_suelo: adcSuelo, agua: hayAgua ? 1 : 0, adc_agua: hayAgua ? 260 : 1023,
      estado, aire: m.aireAlta ? "ALTA" : "NORMAL", suelo: m.sueloEstado,
      ventilador: m.vent ? 1 : 0, bomba: bomba ? 1 : 0, alarma,
      bomba_s_hora: Math.floor(m.bombaMsHora / 1000),
      // solo demo: nivel del tanque
      _tanque: Math.round((m.tanqueL / CAPACIDAD_TANQUE_L) * 100),
    }));
  }

  enviar(texto) {
    setTimeout(() => this.responder(texto), 150);
  }

  responder(texto) {
    const p = texto.trim().replace(/[:,]/g, " ").split(/\s+/);
    const n = (p[0] || "").toUpperCase(), a = (p[1] || "").toUpperCase(), v = Number(p[1]);
    const c = this.cfg, m = this.m;
    const ok = (cmd, conCfg = true) => {
      this.emitir(JSON.stringify({ tipo: "ok", cmd }));
      if (conCfg) this.emitir(JSON.stringify(c));
    };
    const error = (msg) => this.emitir(JSON.stringify({ tipo: "error", msg }));
    const campos = { TEMP: "temp_max", TEMPCRIT: "temp_crit", TEMPHIST: "temp_hist", SUELOMIN: "suelo_min",
                     SUELOMAX: "suelo_max", HIST: "hist", UMBRALAGUA: "umbral_agua" };
    if (campos[n]) {
      if (Number.isNaN(v)) return error("Falta el valor");
      const anterior = c[campos[n]];
      c[campos[n]] = v;
      const valido = c.temp_max >= 0 && c.temp_max <= 60 && c.temp_crit >= c.temp_max && c.temp_crit <= 80 &&
        c.temp_hist >= 0.1 && c.temp_hist <= 10 && c.suelo_min >= 0 && c.suelo_max >= c.suelo_min &&
        c.suelo_max <= 100 && c.hist >= 0 && c.hist <= 30 && c.umbral_agua >= 1 && c.umbral_agua <= 1022;
      if (!valido) { c[campos[n]] = anterior; return error("Valor fuera de rango"); }
      return ok(n);
    }
    switch (n) {
      case "AYUDA": case "?":
        return this.emitir("# ESTADO TEMP TEMPCRIT TEMPHIST SUELOMIN SUELOMAX HIST HORA RIEGO SILENCIO CAL UMBRALAGUA FABRICA");
      case "ESTADO": return this.emitir(JSON.stringify(c));
      case "RIEGO":
        if (m.tanqueL <= 0.08) return error("Sin agua en el tanque");
        if (this.ms < m.bombaHasta) return error("La bomba esta regando o se agoto el cupo de la hora");
        m.bombaHasta = this.ms + 5000; m.bombaMsHora += 5000;
        return ok("RIEGO", false);
      case "SILENCIO": m.silencioHasta = this.ms + 600000; return ok("SILENCIO", false);
      case "HORA": {
        const h = Number(p[1]), mi = Number(p[2]), s = Number(p[3] || 0);
        if (!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return error("Uso: HORA hh:mm[:ss]");
        this.reloj = h * 3600 + mi * 60 + s - Math.floor(this.ms / 1000);
        return ok("HORA", false);
      }
      case "CAL":
        if (a === "SUELOSECO") c.adc_suelo_seco = 960 + Math.round(Math.random() * 30);
        else if (a === "SUELOHUMEDO") c.adc_suelo_hum = 230 + Math.round(Math.random() * 40);
        else if (a === "TANQUE") c.umbral_agua = 640 + Math.round(Math.random() * 30);
        else return error("Uso: CAL SUELOSECO|SUELOHUMEDO|TANQUE");
        return ok("CAL");
      case "FABRICA": Object.assign(c, FABRICA); return ok("FABRICA");
      default: return error("Comando desconocido. Escribe AYUDA");
    }
  }
}

// historial de ejemplo para la demo
export function generarHistorialDemo(dias = 3, ahora = Date.now()) {
  const minutos = [], eventos = [];
  const inicio = Math.floor((ahora - dias * 86400000) / 60000) * 60000;
  let suelo = 48, temp = 22, venting = false, regando = 0, aireAntes = false;
  for (let t = inicio; t < ahora - 60000; t += 60000) {
    const d = new Date(t), hora = d.getHours() + d.getMinutes() / 60;
    const ambiente = 24 + 7 * Math.sin(((hora - 9) / 24) * 2 * Math.PI) + Math.sin(t / 7200000) * 0.8;
    temp += (ambiente - temp) * 0.12 + (venting ? -0.35 : 0) + (Math.random() - 0.5) * 0.25;
    const ventAhora = venting ? temp > 28 : temp > 30;
    if (ventAhora !== venting) eventos.push({ t, tipo: "ventilador", texto: ventAhora ? "Ventilador encendido" : "Ventilador apagado", tono: "neutro" });
    venting = ventAhora;
    suelo -= 0.04 + Math.max(0, temp - 24) * 0.012;
    let bomba = 0;
    if (suelo < 30 && regando === 0) { regando = 5; eventos.push({ t, tipo: "estado", texto: "Suelo seco: regando", tono: "agua" }); }
    if (regando > 0) { bomba = 2.5; suelo += 4.5; regando--; eventos.push({ t, tipo: "riego", texto: "Pulso de riego", tono: "agua" });
      if (regando === 0) eventos.push({ t, tipo: "estado", texto: "Todo en orden", tono: "ok" }); }
    const aire = hora < 6 || hora >= 22.5;                      // rocío nocturno
    if (aire !== aireAntes) eventos.push({ t, tipo: "aire", texto: aire ? "Aire húmedo: contacto del HR202 cerrado" : "Humedad del aire normal", tono: aire ? "agua" : "neutro" });
    aireAntes = aire;
    const tN = 30, ruido = () => (Math.random() - 0.5) * 0.4;
    minutos.push({
      t, n: 30, tN, tSum: temp * tN, tMin: temp - 0.3 + ruido(), tMax: temp + 0.3 + ruido(),
      sN: 30, sSum: suelo * 30, sMin: suelo - 0.4, sMax: suelo + 0.4,
      vent: venting || aire ? (bomba ? 27 : 30) : 0, bomba, aire: aire ? 30 : 0,
      sinAgua: 0, alarma: 0, estado: venting ? "TEMPERATURA_ALTA" : "NORMAL",
    });
  }
  return { minutos, eventos };
}
