// Animación de la maqueta: un solo rAF, escribe el SVG directo (sin React)
// agua: ecuación de onda 1D; hojas: resortes amortiguados; partículas en pools fijos
import { interpolateRgb } from "d3-interpolate";
import { P } from "./proyeccion.js";
import {
  Z0, ALERO, TX0, TX1, TY0, TY1, NIVEL_MAX_MM, BOQUILLA, MACETA, VENTILADOR, HOJAS, NODOS_AGUA, USB,
} from "./geometria.js";

const NS = "http://www.w3.org/2000/svg";
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
// suavizado exponencial, independiente de fps
const suave = (actual, objetivo, tasa, dt) => actual + (objetivo - actual) * (1 - Math.exp(-tasa * dt));
const azar = (a, b) => a + Math.random() * (b - a);
const f2 = (n) => Math.round(n * 100) / 100;

// escribe el atributo solo si cambió: así el navegador no repinta lo que sigue igual
const previos = new WeakMap();
function fijar(el, nombre, valor) {
  if (!el) return;
  let m = previos.get(el);
  if (!m) previos.set(el, (m = {}));
  const v = String(valor);
  if (m[nombre] === v) return;
  m[nombre] = v;
  el.setAttribute(nombre, v);
}
const xy = (p) => `${p[0]},${p[1]}`;

const colorHoja = interpolateRgb("#3E9A5C", "#A9A048");
const colorHojaOscura = interpolateRgb("#2C7446", "#8A8238");
const colorTierra = interpolateRgb("#A98762", "#352010");

const GRAVEDAD = 900;               // mm/s², más lenta que la real para que se vea
const C2_ONDA = 1400;               // nodos²/s²
const SUBPASO = 1 / 240;            // s

// pool de nodos SVG reutilizables
function pool(grupo, n, tipo, clase) {
  if (!grupo) return [];
  grupo.replaceChildren();
  return Array.from({ length: n }, () => {
    const e = document.createElementNS(NS, tipo);
    if (clase) e.setAttribute("class", clase);
    fijar(e, "opacity", "0");
    grupo.appendChild(e);
    return e;
  });
}

export class Motor {
  constructor(el) {
    this.el = el;
    this.t = 0;
    this.listo = false;
    this.medidas = { cuadros: 0, ms: 0 };
    const n = NODOS_AGUA;
    this.s = {
      vent: { ang: 0, vel: 0 },
      bomba: { flujo: 0, llenado: 0, fase: 0, quieta: 0 },
      agua: { nivel: null, h: new Float32Array(n), v: new Float32Array(n), chorro: 0, acum: 0 },
      hs: null, temp: null, aire: 0, mojado: 0, ultSeca: -1, ultTierra: -1,
      hojas: HOJAS.map(() => ({ th: null, w: 0 })),
      planta: { th: 0, w: 0 },
    };
    this.p = { gotas: [], salpicas: [], ondas: [], aire: [], calor: [], niebla: [], burbujas: [], pulsos: [] };
  }

  preparar() {
    const el = this.el;
    this.e = {
      gotas: pool(el.gotas, 28, "ellipse"),
      salpicas: pool(el.salpicas, 36, "circle"),
      ondas: pool(el.ondasTierra, 8, "ellipse"),
      aire: pool(el.aire, 34, "path"),
      calor: pool(el.ondasCalor, 10, "path"),
      niebla: pool(el.niebla, 14, "circle"),
      burbujas: pool(el.burbujas, 18, "circle"),
      pulsos: pool(el.pulsos, 8, "circle"),
    };
    // largo acumulado de cada tramo de manguera
    this.tramos = (el.mangueraLlena || []).map((p, i) => ({ lleno: p, flujo: el.mangueraFlujo?.[i], largo: p ? p.getTotalLength() : 0 }));
    let inicio = 0;
    this.tramos.forEach((tr) => { tr.inicio = inicio; inicio += tr.largo; });
    this.largoManguera = inicio;
    // cable USB en coordenadas de pantalla
    this.usb = USB.map((p) => P(...p));
    this.usbLargos = this.usb.slice(1).map((b, i) => Math.hypot(b[0] - this.usb[i][0], b[1] - this.usb[i][1]));
    this.usbTotal = this.usbLargos.reduce((a, b) => a + b, 0);
    this.listo = true;
  }

  latido() { this.p.pulsos.push({ s: 0, dir: 1 }); }
  comando() { this.p.pulsos.push({ s: 0, dir: -1 }); }

  // sin animación: salta al estado final
  asentar(d) {
    if (!this.listo) return;
    const s = this.s;
    s.vent.vel = 0;
    s.bomba.flujo = 0;
    s.bomba.llenado = d?.bomba === 1 ? this.largoManguera : 0;
    s.agua.nivel = this.nivelObjetivo(d);
    s.agua.h.fill(0); s.agua.v.fill(0); s.agua.chorro = 0;
    s.hs = d?.hum_suelo ?? 45; s.temp = d?.temp_c ?? 24; s.aire = d?.aire_alta === 1 ? 1 : 0;
    s.hojas.forEach((h, i) => { h.th = this.anguloHoja(i, this.sequedad()); h.w = 0; });
    this.dibujar(d);
  }

  nivelObjetivo(d) {
    const pct = typeof d?._tanque === "number" ? d._tanque : d ? (d.agua ? 72 : 22) : 70;
    return (NIVEL_MAX_MM * limitar(pct, 0, 100)) / 100;
  }

  sequedad() {
    const seca = limitar((40 - (this.s.hs ?? 45)) / 35, 0, 1);
    return limitar(seca - this.s.mojado * 0.35, 0, 1);   // recién regada se levanta
  }

  anguloHoja(i, seca) {
    const h = HOJAS[i];
    return h.lado * (-h.sube + seca * (50 + h.sube * 0.6));
  }

  cuadro(dt, d) {
    if (!this.listo) return;
    const t0 = performance.now();
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    this.ultimoDt = dt;
    this.paso(dt, d);
    this.dibujar(d);
    const m = this.medidas;
    m.cuadros++; m.ms += performance.now() - t0;
    if (m.cuadros >= 120) { window.__motorMs = m.ms / m.cuadros; m.cuadros = 0; m.ms = 0; }
  }

  paso(dt, d) {
    const s = this.s, p = this.p, T = this.t;

    // la tel llega cada 2 s; se suaviza
    s.hs = s.hs == null ? (d?.hum_suelo ?? 45) : suave(s.hs, d?.hum_suelo ?? s.hs, 0.9, dt);
    s.temp = s.temp == null ? (d?.temp_c ?? 24) : suave(s.temp, d?.temp_c ?? s.temp, 0.8, dt);
    s.aire = suave(s.aire, d?.aire_alta === 1 ? 1 : 0, 0.7, dt);
    s.mojado = Math.max(0, s.mojado - dt * 0.06);

    // ventilador con inercia
    const v = s.vent;
    v.vel = suave(v.vel, d?.ventilador === 1 ? 1 : 0, d?.ventilador === 1 ? 1.3 : 0.55, dt);
    v.ang = (v.ang + v.vel * 1440 * dt) % 360;

    // bomba: caudal y llenado de la manguera
    const b = s.bomba;
    const encendida = d?.bomba === 1;
    b.flujo = suave(b.flujo, encendida ? 1 : 0, encendida ? 3.5 : 2.2, dt);
    if (encendida) { b.llenado = Math.min(this.largoManguera, b.llenado + 300 * dt); b.quieta = 0; }
    else if ((b.quieta += dt) > 2) b.llenado = Math.max(0, b.llenado - 90 * dt);   // vuelve al tanque
    b.fase += b.flujo * 95 * dt;
    const cebada = b.llenado >= this.largoManguera - 0.5;

    // gotas
    if (cebada && b.flujo > 0.15) {
      const tasa = 34 * b.flujo;
      let n = tasa * dt + (Math.random() < (tasa * dt) % 1 ? 1 : 0);
      while (n-- >= 1) {
        p.gotas.push({ x: BOQUILLA[0] + azar(-2, 2), y: BOQUILLA[1] + azar(-2, 2), z: BOQUILLA[2],
          vx: azar(-28, 28), vy: azar(-22, 22), vz: azar(-60, -20) });
      }
    }
    const hojas = HOJAS.map((h, i) => {
      const th = (s.hojas[i].th ?? 0) * Math.PI / 180;
      return { i, x0: h.x, z0: Z0 + h.z, x1: h.x + h.lado * h.l * Math.cos(th), z1: Z0 + h.z - h.lado * h.l * Math.sin(th) };
    });
    p.gotas = p.gotas.filter((g) => {
      const zAntes = g.z;
      g.vz -= GRAVEDAD * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      // choque con hoja
      if (!g.rebote) {
        for (const h of hojas) {
          const [xa, xb] = h.x0 < h.x1 ? [h.x0, h.x1] : [h.x1, h.x0];
          if (g.x < xa || g.x > xb) continue;
          const k = (g.x - h.x0) / ((h.x1 - h.x0) || 1);
          const zh = h.z0 + (h.z1 - h.z0) * k;
          if (zAntes >= zh && g.z < zh && Math.random() < 0.6) {
            s.hojas[h.i].w += HOJAS[h.i].lado * azar(90, 170) * Math.min(1, -g.vz / 300);
            // escurre por el borde
            g.rebote = true; g.z = zh; g.vz = azar(10, 50); g.vx = HOJAS[h.i].lado * azar(20, 60);
            this.salpicar(g.x, g.y, zh, 2, 0.6);
            break;
          }
        }
      }
      // tierra
      if (g.z <= MACETA.zTierra) {
        const dx = g.x - MACETA.x, dy = g.y - MACETA.y;
        if (dx * dx + dy * dy <= MACETA.radioTierra ** 2) {
          this.salpicar(g.x, g.y, MACETA.zTierra, 4, 1);
          p.ondas.push({ x: g.x, y: g.y, k: 0 });
          s.mojado = Math.min(1, s.mojado + 0.018);
        }
        return false;
      }
      return g.z > Z0;
    }).slice(-this.e.gotas.length);

    p.salpicas = p.salpicas.filter((q) => {
      q.vz -= GRAVEDAD * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vida -= dt;
      return q.vida > 0 && q.z > MACETA.zTierra - 2;
    }).slice(-this.e.salpicas.length);
    p.ondas = p.ondas.filter((o) => (o.k += dt * 2.2) < 1).slice(-this.e.ondas.length);

    // hojas (resorte + viento) y tallo
    const seca = this.sequedad();
    s.hojas.forEach((h, i) => {
      const objetivo = this.anguloHoja(i, seca);
      if (h.th == null) h.th = objetivo;
      const viento = v.vel * (150 * Math.sin(T * (8.5 + i * 0.9) + i * 1.7) + 70 * Math.sin(T * 23.1 + i));
      const a = 75 * (objetivo - h.th) - 6.5 * h.w + viento;
      h.w += a * dt; h.th += h.w * dt;
    });
    const pl = s.planta;
    const inclinacion = -3 * v.vel + v.vel * 1.2 * Math.sin(T * 6.3);
    pl.w += (32 * (inclinacion - pl.th) - 5 * pl.w) * dt; pl.th += pl.w * dt;

    // aire: rejilla -> planta -> ventilador
    if (v.vel > 0.12 && Math.random() < dt * 9 * v.vel) {
      p.aire.push({ k: 0, a: [azar(112, 188), 303, Z0 + azar(26, 54)], c: [azar(110, 230), azar(150, 250), Z0 + azar(110, 190)],
        fase: azar(0, 6.28), vel: azar(0.26, 0.38) });
    }
    p.aire = p.aire.filter((q) => (q.k += dt * q.vel * (0.5 + v.vel * 0.7)) < 1.5).slice(-this.e.aire.length);

    // ondas de calor
    const calor = limitar((s.temp - 27) / 7, 0, 1);
    if (calor > 0.12 && Math.random() < dt * 2.2 * calor) p.calor.push({ x: azar(30, 280), y: azar(60, 260), z: Z0 + azar(10, 30), vida: 0 });
    p.calor = p.calor.filter((q) => { q.vida += dt / 3.2; q.z += 48 * dt; return q.vida < 1 && q.z < ALERO; }).slice(-this.e.calor.length);

    // niebla
    if (s.aire > 0.1 && Math.random() < dt * 1.2 * s.aire) p.niebla.push({ x: azar(30, 280), y: azar(40, 280), z: Z0 + azar(40, 200), r: azar(10, 20), vida: 0 });
    p.niebla = p.niebla.filter((q) => { q.vida += dt / 6; q.x -= v.vel * 22 * dt; q.z += 3 * dt; return q.vida < 1; }).slice(-this.e.niebla.length);

    // tanque
    const ag = s.agua;
    const objetivo = this.nivelObjetivo(d);
    if (ag.nivel == null) ag.nivel = objetivo;
    const dif = objetivo - ag.nivel;
    const llenando = dif > 0.6;
    ag.chorro = suave(ag.chorro, llenando ? limitar(dif / 6, 0.35, 1) : 0, llenando ? 6 : 3, dt);
    ag.nivel += limitar(dif, -16 * dt, 24 * dt);
    this.olas(dt, b.flujo, ag.chorro, -limitar(dif, -16, 0) / 16);
    if (ag.chorro > 0.1 && Math.random() < dt * 40 * ag.chorro) {
      p.burbujas.push({ x: 422 + azar(-6, 6), y: TY0 + azar(14, 30), z: Z0 + 1.5 + ag.nivel - azar(6, Math.max(8, ag.nivel * 0.8)), r: azar(0.7, 1.8), fase: azar(0, 6) });
    }
    if (b.flujo > 0.3 && Math.random() < dt * 6 * b.flujo) {
      p.burbujas.push({ x: 352 + azar(-10, 10), y: TY0 + azar(16, 26), z: Z0 + azar(4, 12), r: azar(0.5, 1.1), fase: azar(0, 6) });
    }
    const sup = Z0 + 1.5 + ag.nivel;
    p.burbujas = p.burbujas.filter((q) => { q.z += (30 + q.r * 18) * dt; q.x += Math.sin(this.t * 9 + q.fase) * 6 * dt; return q.z < sup - 0.5; })
      .slice(-this.e.burbujas.length);

    // pulsos USB
    p.pulsos = p.pulsos.filter((q) => (q.s += dt * 0.9) < 1).slice(-this.e.pulsos.length);
  }

  salpicar(x, y, z, n, fuerza) {
    for (let i = 0; i < n; i++) {
      const a = azar(0, Math.PI * 2), r = azar(30, 80) * fuerza;
      this.p.salpicas.push({ x, y, z: z + 0.5, vx: Math.cos(a) * r, vy: Math.sin(a) * r, vz: azar(70, 150) * fuerza, vida: azar(0.25, 0.45), r: azar(0.5, 1) });
    }
  }

  // superficie: cuerda discreta amortiguada
  olas(dt, flujoBomba, chorro, vaciando) {
    const { h, v } = this.s.agua;
    const n = h.length;
    const nodo = (x) => Math.round(((x - TX0) / (TX1 - TX0)) * (n - 1));
    const jChorro = nodo(422), jBomba = nodo(355);
    // perturbaciones (mm/s)
    if (chorro > 0.05) for (let k = -1; k <= 1; k++) v[jChorro + k] -= chorro * azar(300, 800) * dt;
    if (flujoBomba > 0.1) v[jBomba] += (Math.random() - 0.5) * 900 * flujoBomba * dt;
    if (vaciando > 0.05) v[n >> 1] += Math.sin(this.t * 4) * 120 * vaciando * dt;
    v[(Math.random() * n) | 0] += (Math.random() - 0.5) * 18 * dt;        // ruido
    this.s.agua.acum += dt;
    while (this.s.agua.acum >= SUBPASO) {
      this.s.agua.acum -= SUBPASO;
      for (let i = 0; i < n; i++) {
        const izq = h[i > 0 ? i - 1 : 0], der = h[i < n - 1 ? i + 1 : n - 1];
        v[i] += (C2_ONDA * (izq + der - 2 * h[i]) - 3 * h[i] - 1.7 * v[i]) * SUBPASO;
      }
      for (let i = 0; i < n; i++) h[i] = limitar(h[i] + v[i] * SUBPASO, -6, 6);
    }
  }

  dibujar(d) {
    const el = this.el, e = this.e, s = this.s, p = this.p;

    // Ventilador
    fijar(el.aspas, "transform", `rotate(${f2(s.vent.ang)} 150 ${-(Z0 + 165)})`);
    fijar(el.aspas, "opacity", f2(1 - s.vent.vel * 0.55));
    fijar(el.desenfoque, "opacity", f2(s.vent.vel * 0.6));

    // manguera
    const b = s.bomba;
    for (const tr of this.tramos) {
      if (!tr.lleno) continue;
      const lleno = limitar(b.llenado - tr.inicio, 0, tr.largo);
      fijar(tr.lleno, "stroke-dasharray", `${f2(lleno)} ${f2(tr.largo + 1)}`);
      if (tr.flujo) {
        fijar(tr.flujo, "stroke-dashoffset", f2(tr.inicio - b.fase));
        fijar(tr.flujo, "opacity", f2(lleno >= tr.largo - 0.5 ? b.flujo : 0));
      }
    }

    // gotas (se estiran con la velocidad)
    e.gotas.forEach((g, i) => {
      const q = p.gotas[i];
      if (!q) { fijar(g, "opacity", "0"); return; }
      const [x, y] = P(q.x, q.y, q.z);
      const estira = limitar(-q.vz / 260, 1, 2.6);
      fijar(g, "cx", f2(x)); fijar(g, "cy", f2(y));
      fijar(g, "rx", "1.25"); fijar(g, "ry", f2(1.25 * estira));
      fijar(g, "opacity", "0.9");
    });
    e.salpicas.forEach((c, i) => {
      const q = p.salpicas[i];
      if (!q) { fijar(c, "opacity", "0"); return; }
      const [x, y] = P(q.x, q.y, q.z);
      fijar(c, "cx", f2(x)); fijar(c, "cy", f2(y)); fijar(c, "r", f2(q.r));
      fijar(c, "opacity", f2(limitar(q.vida * 3, 0, 0.9)));
    });
    e.ondas.forEach((o, i) => {
      const q = p.ondas[i];
      if (!q) { fijar(o, "opacity", "0"); return; }
      fijar(o, "cx", f2(q.x)); fijar(o, "cy", f2(-q.y));
      fijar(o, "rx", f2(2 + q.k * 9)); fijar(o, "ry", f2(2 + q.k * 9));
      fijar(o, "opacity", f2((1 - q.k) * 0.7));
    });

    // tierra
    const tono = limitar((s.hs ?? 45) / 90 + s.mojado * 0.3, 0, 1);
    if (Math.abs(tono - s.ultTierra) > 0.004) {
      s.ultTierra = tono;
      fijar(el.tierra, "fill", colorTierra(tono));
    }
    fijar(el.brilloTierra, "opacity", f2(Math.max(limitar(((s.hs ?? 45) - 75) / 20, 0, 0.7), s.mojado * 0.65)));

    // Planta
    const seca = this.sequedad();
    if (Math.abs(seca - s.ultSeca) > 0.004) {
      s.ultSeca = seca;
      const c1 = colorHoja(seca * 0.8), c2 = colorHojaOscura(seca * 0.8);
      el.hojasForma?.forEach((f, i) => fijar(f, "fill", i % 2 ? c1 : c2));
    }
    el.hojas?.forEach((g, i) => {
      const h = HOJAS[i];
      fijar(g, "transform", `translate(${h.x} ${-(Z0 + h.z)}) rotate(${f2(s.hojas[i].th ?? 0)})`);
    });
    fijar(el.planta, "transform", `rotate(${f2(s.planta.th)} 105 ${-(Z0 + 90)})`);

    // aire
    const fan = VENTILADOR;
    const bez = (a, c, k) => a.map((_, i) => (1 - k) * (1 - k) * a[i] + 2 * (1 - k) * k * c[i] + k * k * fan[i]);
    const pos = (q, k) => {
      const base = k <= 1 ? bez(q.a, q.c, k) : [fan[0] - (k - 1) * 170, fan[1] - (k - 1) * 30, fan[2] + (k - 1) * 50];
      base[2] += Math.sin(k * 5 + q.fase) * 2;
      return P(...base);
    };
    e.aire.forEach((linea, i) => {
      const q = p.aire[i];
      if (!q) { fijar(linea, "opacity", "0"); return; }
      const a = pos(q, Math.max(0, q.k - 0.16)), m = pos(q, Math.max(0, q.k - 0.08)), c = pos(q, q.k);
      fijar(linea, "d", `M${xy(a)} Q${xy(m)} ${xy(c)}`);
      fijar(linea, "opacity", f2(Math.min(1, q.k * 3, (1.5 - q.k) * 2) * 0.42 * s.vent.vel));
    });

    // Calor y niebla
    const calor = limitar(((s.temp ?? 24) - 27) / 7, 0, 0.85);
    fijar(el.velo, "opacity", f2(calor));
    e.calor.forEach((onda, i) => {
      const q = p.calor[i];
      if (!q) { fijar(onda, "opacity", "0"); return; }
      const [x, y] = P(q.x, q.y, q.z);
      fijar(onda, "d", `M${f2(x)} ${f2(y)} q3 -4 0 -8 t0 -8 t0 -8`);
      fijar(onda, "opacity", f2(Math.sin(q.vida * Math.PI) * calor * 0.4));
    });
    e.niebla.forEach((c, i) => {
      const q = p.niebla[i];
      if (!q) { fijar(c, "opacity", "0"); return; }
      const [x, y] = P(q.x, q.y, q.z);
      fijar(c, "cx", f2(x)); fijar(c, "cy", f2(y)); fijar(c, "r", f2(q.r * (1.05 + q.vida * 0.9)));
      fijar(c, "opacity", f2(Math.sin(q.vida * Math.PI) * 0.07 * s.aire));
    });

    // agua
    const ag = s.agua;
    const zb = Z0 + 1.5, x0 = TX0 + 1.5, x1 = TX1 - 1.5, yf = TY0 + 1.5, yb = TY1 - 1.5;
    const visible = ag.nivel > 0.4;
    for (const k of ["aguaFrente", "aguaArriba", "aguaLado", "aguaBrillo"]) fijar(el[k], "opacity", visible ? "1" : "0");
    if (visible) {
      const n = ag.h.length;
      const frente = [], fondo = [];
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * i) / (n - 1);
        const z = zb + ag.nivel + ag.h[i];
        frente.push(P(x, yf, z));
        fondo.push(P(x, yb, zb + ag.nivel + ag.h[i] * 0.7));
      }
      const pf = frente.map(xy), pb = fondo.map(xy);
      fijar(el.aguaFrente, "points", `${xy(P(x0, yf, zb))} ${xy(P(x1, yf, zb))} ${pf.slice().reverse().join(" ")}`);
      fijar(el.aguaArriba, "points", `${pf.join(" ")} ${pb.slice().reverse().join(" ")}`);
      const zl = zb + ag.nivel + ag.h[n - 1];
      fijar(el.aguaLado, "points", `${xy(P(x1, yf, zb))} ${xy(P(x1, yb, zb))} ${xy(P(x1, yb, zl - ag.h[n - 1] * 0.3))} ${xy(P(x1, yf, zl))}`);
      fijar(el.aguaBrillo, "points", pf.join(" "));
    }
    // chorro de llenado
    if (el.chorro) {
      if (ag.chorro > 0.03) {
        const zTop = Z0 + 150, zSup = zb + ag.nivel;
        const [ax, ay] = P(422, TY0 + 20, zTop), [bx, by] = P(422, TY0 + 20, zSup);
        const w = 2.8 * ag.chorro, bamboleo = Math.sin(this.t * 13) * 0.6;
        fijar(el.chorro, "d", `M${f2(ax - w)} ${f2(ay)} C${f2(ax - w * 0.6 + bamboleo)} ${f2((ay + by) / 2)} ${f2(bx - w * 0.45)} ${f2(by - 6)} ${f2(bx - w * 0.5)} ${f2(by)}
          L${f2(bx + w * 0.5)} ${f2(by)} C${f2(bx + w * 0.45)} ${f2(by - 6)} ${f2(ax + w * 0.6 + bamboleo)} ${f2((ay + by) / 2)} ${f2(ax + w)} ${f2(ay)} Z`);
        fijar(el.chorro, "opacity", f2(Math.min(1, ag.chorro * 1.4)));
      } else fijar(el.chorro, "opacity", "0");
    }
    e.burbujas.forEach((c, i) => {
      const q = p.burbujas[i];
      if (!q) { fijar(c, "opacity", "0"); return; }
      const [x, y] = P(q.x, q.y, q.z);
      fijar(c, "cx", f2(x)); fijar(c, "cy", f2(y)); fijar(c, "r", f2(q.r));
      fijar(c, "opacity", "0.75");
    });

    // caja translúcida al llenar o al seleccionar el tanque
    if (el.caja) {
      const transparente = ag.chorro > 0.05 || el.caja.getAttribute("data-transparente") === "1";
      s.cajaOp = suave(s.cajaOp ?? 1, transparente ? 0.28 : 1, 5, this.ultimoDt || 0.016);
      fijar(el.caja, "opacity", f2(s.cajaOp));
    }

    // pulsos USB
    e.pulsos.forEach((c, i) => {
      const q = p.pulsos[i];
      if (!q) { fijar(c, "opacity", "0"); return; }
      const [x, y] = this.enCable(q.dir > 0 ? q.s : 1 - q.s);
      fijar(c, "cx", f2(x)); fijar(c, "cy", f2(y)); fijar(c, "r", "2.6");
      fijar(c, "class", q.dir > 0 ? "pulso" : "pulso comando");
      fijar(c, "opacity", f2(Math.min(1, q.s * 8, (1 - q.s) * 8)));
    });
  }

  enCable(k) {
    let d = k * this.usbTotal;
    for (let i = 0; i < this.usbLargos.length; i++) {
      if (d <= this.usbLargos[i]) {
        const a = this.usb[i], b = this.usb[i + 1], f = d / this.usbLargos[i];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      d -= this.usbLargos[i];
    }
    return this.usb[this.usb.length - 1];
  }
}
