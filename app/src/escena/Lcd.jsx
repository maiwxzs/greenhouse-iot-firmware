// LCD 16x2, fuente 5x8 (mismas páginas que PantallaLCD del firmware)
const FUENTE = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14], "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [31, 2, 4, 2, 1, 17, 14], "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8], "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  A: [14, 17, 17, 17, 31, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  ":": [0, 12, 12, 0, 12, 12, 0], ".": [0, 0, 0, 0, 0, 12, 12], "%": [24, 25, 2, 4, 8, 19, 3],
  "-": [0, 0, 0, 31, 0, 0, 0], "?": [14, 17, 1, 2, 4, 0, 4],
  a: [0, 0, 14, 1, 15, 17, 15], g: [0, 0, 15, 17, 15, 1, 14], u: [0, 0, 17, 17, 17, 19, 13],
};

const ESTADO_LCD = {
  TEMPERATURA_ALTA: "TEMPERATURA ALTA", TEMPERATURA_CRITICA: "TEMPERATURA CRIT", SUELO_ENCHARCADO: "SUELO ENCHARCADO",
  FALLA_SENSOR_TEMP: "FALLA SENSOR TEM",
};

const ajustar = (s) => (s.length > 16 ? s.slice(0, 16) : s.padEnd(16, " "));

// pagina: 0 lecturas, 1 estado
export function textoLcd(t, pagina) {
  if (!t) return ["SIN CONEXION", "USB"].map(ajustar);
  if (pagina === 0) {
    const temp = typeof t.temp_c === "number" ? `${t.temp_c.toFixed(1)}C` : "--.-C";
    const suelo = typeof t.hum_suelo === "number" ? `${Math.round(t.hum_suelo)}%` : "--";
    return [`T:${temp}  HR:${t.aire_alta ? "ALTA" : "OK"}`, `S:${suelo} Agua:${t.agua ? "OK" : "NO"}`].map(ajustar);
  }
  const estado = ESTADO_LCD[t.estado] || String(t.estado || "").replaceAll("_", " ");
  const [h, m] = String(t.hora || "00:00").split(":");
  return [estado, `V:${t.ventilador ? 1 : 0} B:${t.bomba ? 1 : 0}    ${h}:${m}`].map(ajustar);
}

// un path para puntos encendidos y otro para apagados
function trazados(filas) {
  let on = "", off = "";
  filas.forEach((fila, f) => {
    [...fila].forEach((ch, c) => {
      const g = FUENTE[ch] || FUENTE[ch.toUpperCase()] || FUENTE["?"];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 5; x++) {
          const lit = y < 7 && (g[y] >> (4 - x)) & 1;
          const px = c * 6 + x, py = f * 9 + y;
          const d = `M${px} ${py}h.82v.82h-.82z`;
          if (lit) on += d; else off += d;
        }
      }
    });
  });
  return { on, off };
}

// 96 x 17 unidades
export function PuntosLcd({ filas, encendida = true }) {
  const { on, off } = trazados(filas);
  return (
    <g className="lcd-puntos" data-encendida={+encendida}>
      <path d={off} className="lcd-off" />
      <path d={on} className="lcd-on" />
    </g>
  );
}

export default function Lcd({ filas, encendida = true, titulo }) {
  return (
    <svg className="lcd-grande" viewBox="-6 -5 107 27" role="img" aria-label={`${titulo}: ${filas.join(" / ")}`}>
      <rect x="-6" y="-5" width="107" height="27" rx="1.5" className="lcd-placa" />
      <rect x="-3.2" y="-2.4" width="101.4" height="21.8" rx=".8" className="lcd-bisel" />
      <rect x="-1.6" y="-1.2" width="98.2" height="19.4" className="lcd-fondo" data-encendida={+encendida} />
      <PuntosLcd filas={filas} encendida={encendida} />
    </svg>
  );
}
