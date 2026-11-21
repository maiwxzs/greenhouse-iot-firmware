// Medidas de la maqueta (mm)
export const Z0 = 6;                                  // cara superior de la base
export const ALERO = Z0 + 220;
export const CUMBRERA = Z0 + 310;
export const BX0 = 318, BX1 = 468, BY0 = 5, BY1 = 205, BZ1 = Z0 + 75;   // caja de la electrónica
export const TX0 = 330, TX1 = 450, TY0 = 212, TY1 = 297;                // tanque de 1 L
export const NIVEL_MAX_MM = 85;
export const BOQUILLA = [105, 155, Z0 + 198];
export const MACETA = { x: 105, y: 155, zTierra: Z0 + 91, radioTierra: 51 };
export const VENTILADOR = [5, 150, Z0 + 165];
export const BASE_PLANTA = [105, Z0 + 90];             // en el plano de la planta (y = 150): x y z
// manguera: bomba -> pared derecha -> alero -> boquilla
export const MANGUERA = [[352, 255, Z0 + 34], [352, 255, Z0 + 205], [305, 255, Z0 + 205], [105, 255, Z0 + 205], [105, 155, Z0 + 205], [105, 155, Z0 + 199]];
export const TRAMOS_MANGUERA = [MANGUERA.slice(0, 2), MANGUERA.slice(1, 3), MANGUERA.slice(2)];
export const USB = [[421, 205, Z0 + 13], [421, 209, Z0 + 13], [476, 209, Z0 + 12], [492, 214, 1], [540, 214, 0], [600, 190, 0], [700, 160, 0]];
// hojas: base (x, z), lado, largo, ángulo sana (grados)
export const HOJAS = [
  { z: 112, x: 103, lado: -1, l: 40, sube: 20 }, { z: 116, x: 107, lado: 1, l: 42, sube: 16 },
  { z: 132, x: 104, lado: -1, l: 38, sube: 26 }, { z: 138, x: 106, lado: 1, l: 40, sube: 24 },
  { z: 152, x: 104, lado: -1, l: 32, sube: 34 }, { z: 156, x: 106, lado: 1, l: 33, sube: 30 },
  { z: 168, x: 105, lado: -1, l: 22, sube: 50 }, { z: 170, x: 105, lado: 1, l: 22, sube: 46 },
];
export const NODOS_AGUA = 28;                          // nodos de la superficie del agua
