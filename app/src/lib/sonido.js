// Sonidos de la interfaz, sintetizados con Web Audio (sin archivos de audio)
// campana: parciales inarmónicos con caída exponencial + reverberación corta

let ctx = null, salida = null, reverb = null;
let ultimo = -Infinity;

function iniciar() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  salida = ctx.createGain();
  salida.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  salida.connect(comp).connect(ctx.destination);
  // impulso de reverb: ruido con caída de 1.8 s
  const largo = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, largo, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 2.6;
  }
  reverb = ctx.createConvolver();
  reverb.buffer = ir;
  const mezcla = ctx.createGain();
  mezcla.gain.value = 0.32;
  reverb.connect(mezcla).connect(salida);
  return ctx;
}

const nota = (n) => 440 * 2 ** ((n - 69) / 12);   // número MIDI -> Hz

function campana(midi, t, { vol = 0.22, dur = 1.6, brillo = 1 } = {}) {
  const f = nota(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  g.connect(salida); g.connect(reverb);
  // fundamental + parciales tipo celesta
  [[1, 1], [2.0, 0.42 * brillo], [3.01, 0.2 * brillo], [4.17, 0.1 * brillo], [5.43, 0.05 * brillo]].forEach(([r, a], i) => {
    const o = ctx.createOscillator();
    const ga = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f * r * (1 + (i ? (Math.random() - 0.5) * 0.002 : 0));
    ga.gain.setValueAtTime(a, t);
    ga.gain.exponentialRampToValueAtTime(0.001, t + dur / (1 + i * 0.8));
    o.connect(ga).connect(g);
    o.start(t); o.stop(t + dur + 0.05);
  });
}

function gota(t, { desde = 1400, hasta = 520, vol = 0.16 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(desde, t);
  o.frequency.exponentialRampToValueAtTime(hasta, t + 0.11);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.connect(g); g.connect(salida); g.connect(reverb);
  o.start(t); o.stop(t + 0.25);
}

function soplo(t, { dur = 1.1, vol = 0.12 } = {}) {
  const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = n;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp).connect(g).connect(salida);
  src.start(t); src.stop(t + dur);
}

// secuencias: [midi, retardo s]
const SONIDOS = {
  conectado: () => { const t = ctx.currentTime; [[72, 0], [76, 0.09], [79, 0.18], [84, 0.27], [88, 0.38]].forEach(([n, d], i) => campana(n, t + d, { vol: 0.16 + i * 0.015 })); },
  normal: () => { const t = ctx.currentTime; campana(79, t, { vol: 0.18 }); campana(84, t + 0.14, { vol: 0.2, dur: 2 }); },
  riego: () => { const t = ctx.currentTime; gota(t); gota(t + 0.16, { desde: 1700, hasta: 640, vol: 0.12 }); gota(t + 0.3, { desde: 1250, hasta: 480, vol: 0.09 }); },
  ventilador: () => { const t = ctx.currentTime; soplo(t); campana(67, t + 0.05, { vol: 0.08, dur: 1.2, brillo: 0.5 }); },
  alarma: () => { const t = ctx.currentTime; [[81, 0], [76, 0.16], [81, 0.42], [76, 0.58]].forEach(([n, d]) => campana(n, t + d, { vol: 0.24, dur: 0.9, brillo: 1.3 })); },
  silencio: () => { const t = ctx.currentTime; campana(76, t, { vol: 0.14 }); campana(72, t + 0.15, { vol: 0.12, dur: 1.4 }); },
  ok: () => campana(88, ctx.currentTime, { vol: 0.1, dur: 0.9 }),
  desconectado: () => { const t = ctx.currentTime; campana(79, t, { vol: 0.14 }); campana(72, t + 0.16, { vol: 0.14, dur: 1.6 }); },
};

export function sonar(nombre) {
  if (!SONIDOS[nombre]) return;
  if (!iniciar()) return;
  if (ctx.state === "suspended") ctx.resume();
  const ahora = performance.now();
  if (nombre !== "alarma" && ahora - ultimo < 350) return;
  ultimo = ahora;
  try { SONIDOS[nombre](); } catch { /* audio no disponible */ }
}


// tipo de evento del registro -> sonido
export function sonidoDeEvento(ev) {
  if (ev.tipo === "alarma") return ev.texto.includes("silenciada") ? "silencio" : "alarma";
  if (ev.tipo === "riego") return "riego";
  if (ev.tipo === "ventilador" && ev.texto.includes("encendido")) return "ventilador";
  if (ev.tipo === "estado" && ev.tono === "ok") return "normal";
  if (ev.tipo === "conexion") return ev.tono === "ok" ? "conectado" : "desconectado";
  return null;
}
