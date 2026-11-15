// Proyección oblicua (caballera) de la maqueta: x a la derecha, y hacia el fondo, z hacia arriba, en mm.
// El fondo se desplaza hacia arriba a la derecha, como en los renders de la maqueta.
export const DX = 0.42;
export const DY = 0.3;

const r = (n) => Math.round(n * 100) / 100;

export const P = (x, y, z) => [r(x + y * DX), r(-(z + y * DY))];
const vec = (v) => [v[0] + v[1] * DX, -(v[2] + v[1] * DY)];

export const pts = (...ps) => ps.map((p) => P(...p).join(",")).join(" ");
export const ruta = (ps, cerrar = false) =>
  ps.map((p, i) => (i ? "L" : "M") + P(...p).join(" ")).join(" ") + (cerrar ? " Z" : "");

// Matriz SVG que lleva un dibujo plano (u a la derecha, w hacia abajo, en mm) a una cara de la maqueta
function cara(origen, u, w) {
  const [e, f] = P(...origen);
  const [a, b] = vec(u);
  const [c, d] = vec(w);
  return `matrix(${r(a)} ${r(b)} ${r(c)} ${r(d)} ${e} ${f})`;
}
// Cara vertical paralela al frente; origen en la esquina superior izquierda
export const caraFrente = (x, y, zArriba) => cara([x, y, zArriba], [1, 0, 0], [0, 0, -1]);
// Cara vertical paralela a los laterales; u avanza hacia el fondo
export const caraLado = (x, yFrente, zArriba) => cara([x, yFrente, zArriba], [0, 1, 0], [0, 0, -1]);
// Cara horizontal; origen en la esquina izquierda del fondo, w avanza hacia el frente
export const caraArriba = (x, yFondo, z) => cara([x, yFondo, z], [1, 0, 0], [0, -1, 0]);

// Prisma recto: devuelve las tres caras visibles (frente, arriba y lado derecho)
export function prisma(x0, y0, z0, x1, y1, z1) {
  return {
    frente: pts([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]),
    arriba: pts([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]),
    lado: pts([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]),
  };
}

// Circunferencia horizontal proyectada
export function circulo(cx, cy, z, radio, n = 40) {
  const s = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.push(P(cx + radio * Math.cos(a), cy + radio * Math.sin(a), z));
  }
  return s;
}

// Envolvente convexa (cadena monótona) para siluetas de cilindros y troncos de cono
export function envolvente(puntos) {
  const p = [...puntos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const abajo = [], arriba = [];
  for (const q of p) {
    while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], q) <= 0) abajo.pop();
    abajo.push(q);
  }
  for (const q of p.slice().reverse()) {
    while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], q) <= 0) arriba.pop();
    arriba.push(q);
  }
  return abajo.slice(0, -1).concat(arriba.slice(0, -1));
}

export const unir = (lista) => lista.map((p) => p.join(",")).join(" ");
