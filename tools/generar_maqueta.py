#!/usr/bin/env python3
"""Maqueta del invernadero: modelo 3D detallado, renders y planos.

Genera:
  hardware/3d-models/maqueta-completa.stl / .obj (+ .mtl con colores)
  hardware/3d-models/<grupo>.stl                 cada parte por separado
  hardware/maqueta/render-*.png                  vistas renderizadas
  hardware/maqueta/planos-de-corte.svg           piezas con medidas (mm)
  hardware/maqueta/planta-distribucion.svg       distribución vista desde arriba

Uso:  python3 tools/generar_maqueta.py      (necesita numpy y Pillow)
Todas las medidas están en milímetros.
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / "maqueta"))
from geometria import Malla, curva_cable, guardar_obj, guardar_stl, pared_con_huecos  # noqa: E402
from render import render  # noqa: E402
import componentes as C  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
DIR_3D = RAIZ / "hardware" / "3d-models"
DIR_MAQ = RAIZ / "hardware" / "maqueta"

# ============================== DIMENSIONES ==============================
BASE_X, BASE_Y, BASE_Z = 470, 310, 6          # tablero de MDF de 6 mm
Z0 = BASE_Z
GX0, GY0 = 5, 5                                # invernadero: estructura de balso
ANCHO, FONDO, ALTO, CUMBRE = 300, 300, 220, 90
L = 10                                         # listón de balso 10 x 10
E = 2                                          # acrílico transparente de 2 mm
BX0, BY0, BW, BD, BH, BE = 318, 5, 150, 200, 75, 3   # caja de la electrónica (MDF 3 mm)
TX0, TY0, TW, TD, TH = 330, 212, 120, 85, 100        # tanque (recipiente plástico de 1 L)
MAC_X, MAC_Y = GX0 + 100, GY0 + 150                  # maceta Ø110 arriba, Ø80 abajo, 95 de alto
ALT_MANGUERA = 205                                    # altura de la manguera sobre la base
ZUM_X, ZUM_Y = BX0 + 118, BY0 + 40                    # centro del zumbador sobre la tapa de la caja

# Huecos (u, v en mm desde la esquina inferior izquierda de cada pieza, vista desde afuera)
HUECOS = {
    "pared_izquierda": [(131, 146, 169, 184, "Ventilador 38 x 38")],
    "pared_derecha": [(35, 10, 60, 25, "Paso de cables 25 x 15"),
                      (TY0 + 42.5 - GY0 - 6, ALT_MANGUERA - 6, TY0 + 42.5 - GY0 + 6, ALT_MANGUERA + 6, "Manguera Ø8 (12 x 12)")],
    "pared_fondo": [(110, 25, 190, 55, "Rejilla 80 x 30")],
    "caja_frente": [(14, 36, 86, 61, "Ventana LCD 72 x 25"), (101.5, 53.5, 106.5, 58.5, "LED Ø5"),
                    (115.5, 53.5, 120.5, 58.5, "LED Ø5"), (105, 20, 117, 32, "Pulsador Ø12")],
    "caja_fondo": [(95, 6, 111, 20, "USB 16 x 14"), (118, 52, 136, 64, "Cables del tanque 18 x 12")],
    "caja_izquierda": [(35, 10, 60, 25, "Paso de cables 25 x 15")],
    # Tapa vista desde arriba (u a lo largo de x, v a lo largo de y): zumbador atornillado encima
    "caja_tapa": [(ZUM_X - BX0 - 7, ZUM_Y - BY0 - 17, ZUM_X - BX0 - 1, ZUM_Y - BY0 - 11, "Cables del zumbador 6 x 6"),
                  (ZUM_X - BX0 - 20, ZUM_Y - BY0 - 1, ZUM_X - BX0 - 18, ZUM_Y - BY0 + 1, "Tornillo M2"),
                  (ZUM_X - BX0 + 18, ZUM_Y - BY0 - 1, ZUM_X - BX0 + 20, ZUM_Y - BY0 + 1, "Tornillo M2")],
}

MALLAS = []


def agregar(*grupos):
    for g in grupos:
        if isinstance(g, Malla):
            MALLAS.append(g)
        else:
            MALLAS.extend(g)


def pared_vertical(nombre, color, alfa, grupo, origen, eje_u, ancho, alto, espesor, normal, huecos):
    """Panel en un plano vertical con huecos rectangulares. eje_u: dirección horizontal (x o y)."""
    m = Malla(nombre, color, alfa, grupo)
    o = np.asarray(origen, float); du = np.asarray(eje_u, float); n = np.asarray(normal, float)
    for (u0, v0, u1, v1) in pared_con_huecos(ancho, alto, [h[:4] for h in huecos]):
        p0 = o + du * u0 + np.array([0, 0, v0])
        p1 = o + du * u1 + np.array([0, 0, v1])
        q = p0 + n * espesor
        xs = sorted([p0[0], p1[0], q[0]]); ys = sorted([p0[1], p1[1], q[1]])
        m.caja(xs[0], ys[0], p0[2], xs[-1], ys[-1], p1[2])
    return m


# ------------------------------- Base -------------------------------
agregar(Malla("Base MDF 6 mm", "#C8A97E", grupo="base").caja(0, 0, 0, BASE_X, BASE_Y, BASE_Z))

# --------------------------- Estructura de balso ---------------------------
bal = Malla("Estructura de balso 10x10", "#E2C48E", grupo="estructura")
x0, x1, y0, y1 = GX0, GX0 + ANCHO, GY0, GY0 + FONDO
zA, zC = Z0 + ALTO, Z0 + ALTO + CUMBRE
for x in (x0, x1 - L):
    for y in (y0, y1 - L):
        bal.caja(x, y, Z0, x + L, y + L, zA)                                  # 4 postes
for y in (y0, y1 - L):
    bal.caja(x0, y, zA - L, x1, y + L, zA)                                    # vigas del alero (frente y fondo)
    bal.caja(x0, y, Z0, x1, y + L, Z0 + L)                                    # soleras inferiores
    bal.caja(x0 + ANCHO / 2 - L / 2, y, zA, x0 + ANCHO / 2 + L / 2, y + L, zC)   # pie de cumbrera
for x in (x0, x1 - L):
    bal.caja(x, y0, zA - L, x + L, y1, zA)                                    # vigas laterales
    bal.caja(x, y0, Z0, x + L, y1, Z0 + L)
    bal.caja(x, y0 + FONDO / 2 - L / 2, Z0, x + L, y0 + FONDO / 2 + L / 2, zA)   # poste intermedio lateral
bal.caja(x0 + ANCHO / 2 - L / 2, y0, zC - L, x0 + ANCHO / 2 + L / 2, y1, zC)    # cumbrera
for y in (y0 + L / 2, y0 + FONDO / 2, y1 - L / 2):
    for xa, xb in ((x0 + L / 2, x0 + ANCHO / 2), (x1 - L / 2, x0 + ANCHO / 2)):
        bal.viga((xa, y, zA - L / 2), (xb, y, zC - L / 2), L, L, arriba=(0, 1, 0))   # cabios
agregar(bal)

# ------------------------------ Paredes de acrílico ------------------------------
ACR, AA = "#BFE3EE", 0.22
agregar(pared_vertical("Pared frontal (acrílico)", ACR, AA, "pared_frontal", (x0, y0, Z0), (1, 0, 0), ANCHO, ALTO, E, (0, -1, 0), []),
        pared_vertical("Pared de fondo (acrílico)", ACR, AA, "paredes", (x0, y1, Z0), (1, 0, 0), ANCHO, ALTO, E, (0, 1, 0), HUECOS["pared_fondo"]),
        pared_vertical("Pared izquierda (acrílico)", ACR, AA, "paredes", (x0, y0, Z0), (0, 1, 0), FONDO, ALTO, E, (-1, 0, 0), HUECOS["pared_izquierda"]),
        pared_vertical("Pared derecha (acrílico)", ACR, AA, "paredes", (x1, y0, Z0), (0, 1, 0), FONDO, ALTO, E, (1, 0, 0), HUECOS["pared_derecha"]))
for y, n, g in ((y0, -1, "pared_frontal"), (y1, 1, "paredes")):
    agregar(Malla("Frontón (acrílico)", ACR, AA, g).placa([(x0, y, zA), (x1, y, zA), (x0 + ANCHO / 2, y, zC)], E, (0, n, 0)))
agregar(Malla("Malla de la rejilla", "#5A6B62", 0.55, "paredes").caja(x0 + 110, y1 + 0.5, Z0 + 25, x0 + 190, y1 + 1.5, Z0 + 55))
inc = math.atan2(CUMBRE, ANCHO / 2)
techo = Malla("Techo (acrílico)", ACR, 0.26, "techo")
techo.placa([(x0 - 6, y0 - 6, zA - 3), (x0 + ANCHO / 2, y0 - 6, zC), (x0 + ANCHO / 2, y1 + 6, zC), (x0 - 6, y1 + 6, zA - 3)], E, (-math.sin(inc), 0, math.cos(inc)))
techo.placa([(x1 + 6, y0 - 6, zA - 3), (x1 + 6, y1 + 6, zA - 3), (x0 + ANCHO / 2, y1 + 6, zC), (x0 + ANCHO / 2, y0 - 6, zC)], E, (math.sin(inc), 0, math.cos(inc)))
bisagras = Malla("Bisagras del techo", "#9AA3A8", grupo="techo")
for y in (y0 + 40, y1 - 40):
    bisagras.cilindro((x0 + ANCHO / 2, y - 12, zC + 2.5), (x0 + ANCHO / 2, y + 12, zC + 2.5), 2.5, 12)
agregar(techo, bisagras)

# ------------------------------ Caja de la electrónica ------------------------------
MDF = "#D8BE8F"
cx0, cy0, cz0 = BX0, BY0, Z0
agregar(Malla("Caja: piso", MDF, grupo="caja").caja(cx0, cy0, cz0, cx0 + BW, cy0 + BD, cz0 + BE),
        pared_vertical("Caja: frente", MDF, 1, "caja", (cx0, cy0 + BE, cz0), (1, 0, 0), BW, BH, BE, (0, -1, 0), HUECOS["caja_frente"]),
        pared_vertical("Caja: fondo", MDF, 1, "caja", (cx0, cy0 + BD - BE, cz0), (1, 0, 0), BW, BH, BE, (0, 1, 0), HUECOS["caja_fondo"]),
        pared_vertical("Caja: lateral izquierdo", MDF, 1, "caja", (cx0 + BE, cy0, cz0), (0, 1, 0), BD, BH, BE, (-1, 0, 0), HUECOS["caja_izquierda"]),
        pared_vertical("Caja: lateral derecho", MDF, 1, "caja", (cx0 + BW - BE, cy0, cz0), (0, 1, 0), BD, BH, BE, (1, 0, 0), []),
        )
tapa = Malla("Caja: tapa", MDF, grupo="tapa")
for (u0, v0, u1, v1) in pared_con_huecos(BW, BD, [h[:4] for h in HUECOS["caja_tapa"]]):
    tapa.caja(cx0 + u0, cy0 + v0, cz0 + BH, cx0 + u1, cy0 + v1, cz0 + BH + BE)
agregar(tapa)

zi = cz0 + BE                                                     # piso interior de la caja
proto, P = C.protoboard(90, (BX0 + BE + 2 + 54.6, BY0 + 17, zi))
uno, U = C.arduino_uno(-90, (BX0 + 65, BY0 + 115 + 68.6, zi))
agregar(proto, uno)
RELES = {}
for k, (nombre, x) in enumerate((("Relé 1 (bomba)", BX0 + 64), ("Relé 2 (ventilador)", BX0 + 92))):
    r, pts = C.modulo_rele(-90, (x, BY0 + 9 + 50, zi), nombre)
    agregar(r)
    RELES[k + 1] = pts
lcd, LCD = C.lcd_i2c(BX0, BY0, cz0, 50, 48.5)
agregar(lcd)
led_r, LR = C.led(BX0 + 104, BY0, cz0 + 56, "#E5483F", "LED rojo")
led_a, LA = C.led(BX0 + 118, BY0, cz0 + 56, "#3C8CE0", "LED azul")
pul, PU = C.pulsador(BX0 + 111, BY0, cz0 + 26)
zum, ZU = C.zumbador(ZUM_X, ZUM_Y, cz0 + BH + BE)
agregar(led_r, led_a, pul, zum)
# Resistencias en la protoboard: 4.7 kΩ (DS18B20) y 220 Ω (LEDs)
agregar(C.resistencia(P["+1"], P["F12"], "Resistencia 4.7 kΩ", "#E5C14B"),
        C.resistencia(P["F30"], P["F34"], "Resistencia 220 Ω (rojo)", "#C0392B"),
        C.resistencia(P["F40"], P["F44"], "Resistencia 220 Ω (azul)", "#C0392B"))

# ------------------------------ Tanque y bomba ------------------------------
agregar(Malla("Tanque (recipiente 1 L)", "#CFE5F0", 0.32, "tanque").caja(TX0, TY0, Z0, TX0 + TW, TY0 + TD, Z0 + TH),
        Malla("Agua", "#3E8ED0", 0.42, "tanque").caja(TX0 + 2, TY0 + 2, Z0 + 2, TX0 + TW - 2, TY0 + TD - 2, Z0 + 70))
bom, BO = C.bomba(TX0 + 35, TY0 + TD / 2, Z0 + 1.5)
agregar(bom)
sonda_t = Malla("Sonda del tanque", "#9AA3A8", grupo="tanque")
for dx in (0, 10):
    sonda_t.tubo([(TX0 + 8 + dx, TY0 + 4, Z0 + 40), (TX0 + 8 + dx, TY0 + 4, Z0 + TH + 6)], 0.9, 8)
# Puntas peladas a 35-40 mm del fondo: por encima de la bomba (33 mm), así avisa antes de que trabaje en seco
agregar(sonda_t, Malla("Sonda del tanque (puntas)", "#C77B3A", grupo="tanque").caja(TX0 + 6.5, TY0 + 3, Z0 + 35, TX0 + 19.5, TY0 + 5, Z0 + 40))

# ------------------------------ Interior del invernadero ------------------------------
vent, VE = C.ventilador(x0 - E, y0 + 150, Z0 + 165)
hum, HU = C.modulo_humedad(x1, y0 + 115, Z0 + 105)
ds, DS = C.ds18b20(x0 + 210, y0 + 150, Z0 + 120)
agregar(vent, hum, ds)
maceta = Malla("Maceta", "#B0714A", grupo="interior")
maceta.cilindro((MAC_X, MAC_Y, Z0), (MAC_X, MAC_Y, Z0 + 87), 40, 32, r2=53)
maceta.cilindro((MAC_X, MAC_Y, Z0 + 87), (MAC_X, MAC_Y, Z0 + 95), 57, 32)
tierra = Malla("Tierra", "#5B3B25", grupo="interior").cilindro((MAC_X, MAC_Y, Z0 + 92), (MAC_X, MAC_Y, Z0 + 95.5), 53, 32)
planta = Malla("Planta", "#2E7A4C", grupo="interior")
planta.cilindro((MAC_X, MAC_Y, Z0 + 95), (MAC_X, MAC_Y, Z0 + 175), 2.6, 10)
for (dx, dy, z, ex) in ((22, 0, 125, (2.3, .8, .22)), (-20, 6, 140, (2.1, .8, .22)), (4, 20, 155, (.8, 2.1, .22)),
                        (-6, -18, 112, (.9, 2.2, .22)), (14, -10, 168, (1.6, 1.2, .25)), (-12, 12, 172, (1.4, 1.3, .25))):
    planta.esfera((MAC_X + dx, MAC_Y + dy, Z0 + z), 12, n=8, escala=ex)
sonda_s = Malla("Sonda de suelo (clavos)", "#A9B2B7", grupo="interior")
for dy in (-6, 6):
    sonda_s.cilindro((MAC_X + 33, MAC_Y + dy, Z0 + 40), (MAC_X + 33, MAC_Y + dy, Z0 + 105), 1.5, 8)
    sonda_s.cilindro((MAC_X + 33, MAC_Y + dy, Z0 + 105), (MAC_X + 33, MAC_Y + dy, Z0 + 107), 3, 12)
boquilla = Malla("Boquilla", "#1B1D1C", grupo="interior").cilindro((MAC_X, MAC_Y, Z0 + ALT_MANGUERA + 4), (MAC_X, MAC_Y, Z0 + ALT_MANGUERA - 14), 5, 16, r2=3.5)
rocio = Malla("Rocío", "#7FB9E6", 0.12, "interior").cilindro((MAC_X, MAC_Y, Z0 + ALT_MANGUERA - 14), (MAC_X, MAC_Y, Z0 + 100), 2, 24, r2=45, tapas=False)
agregar(maceta, tierra, planta, sonda_s, boquilla, rocio)

# Manguera de silicona (Ø exterior 7.5 mm) desde la bomba hasta la boquilla
yb = TY0 + TD / 2
manguera = Malla("Manguera de silicona", "#D3EAF6", grupo="tanque")
manguera.tubo([BO["salida"], (BO["salida"][0], yb, Z0 + ALT_MANGUERA), (MAC_X, yb, Z0 + ALT_MANGUERA),
               (MAC_X, MAC_Y, Z0 + ALT_MANGUERA), (MAC_X, MAC_Y, Z0 + ALT_MANGUERA + 4)], 3.75, 12)
agregar(manguera)

# ------------------------------ Cableado ------------------------------
COLORES = {"rojo": "#D63A33", "negro": "#232323", "amarillo": "#E7C02E", "verde": "#3BA55C", "blanco": "#EDEDED",
           "naranja": "#EF8A2B", "azul": "#2F6FD6", "morado": "#8A4FC2", "gris": "#8C9396", "cafe": "#8A5A35",
           "rosa": "#E07AA8", "cian": "#3BB6C9", "lima": "#9BCB3C"}
cables = {}


def cable(puntos, color, r=0.8, grupo="cables"):
    m = cables.setdefault((color, grupo), Malla(f"Cable {color}", COLORES[color], grupo=grupo))
    m.tubo([np.asarray(p, float) for p in puntos], r, 8, uniones=False)


def dupont(a, b, color, alto=14):
    cable(curva_cable(a, b, alto), color)
    for p in (a, b):
        cables.setdefault(("negro", "conectores"), Malla("Conectores Dupont", "#151515", grupo="cables")).caja_c(p[0], p[1], p[2], 2.5, 2.5, 6)


ENTRADA = np.array([BX0 + BE + 4, BY0 + 52, Z0 + 17])             # paso de cables, lado de la caja
SALIDA = np.array([x1 - 4, BY0 + 52, Z0 + 17])                    # paso de cables, lado del invernadero
ENTRADA_T = np.array([BX0 + 127, BY0 + BD - BE - 4, Z0 + 58])     # cables del tanque


def mazo(puntos_afuera, color, r=0.8, desplaz=0.0):
    """Cable desde un componente exterior hasta el interior de la caja por el paso de cables."""
    d = np.array([0, desplaz, 0])
    cable([*puntos_afuera, SALIDA + d, ENTRADA + d], color, r)
    return ENTRADA + d


# Alimentación del Arduino a la protoboard
dupont(U["5V"], P["+8"], "rojo"); dupont(U["GND"], P["-8"], "negro")
# Relés: VCC, GND, IN y alimentación del contacto COM
for k, pin in ((1, "D7"), (2, "D8")):
    dupont(RELES[k]["VCC"], P[f"+{k + 3}"], "rojo", 10); dupont(RELES[k]["GND"], P[f"-{k + 3}"], "negro", 10)
    dupont(U[pin], RELES[k]["IN"], ("morado", "gris", "cafe")[k - 1], 22)
    cable(curva_cable(P[f"+{k}"], RELES[k]["COM"], 18), "rojo")
# Pantalla I2C
dupont(LCD["VCC"], P["+0"], "rojo", 8); dupont(LCD["GND"], P["-0"], "negro", 8)
dupont(U["A4"], LCD["SDA"], "azul", 26); dupont(U["A5"], LCD["SCL"], "amarillo", 26)
# LEDs con sus resistencias, pulsador y zumbador
dupont(U["D5"], P["F30"], "naranja", 18); dupont(P["F34"], LR["pata"], "naranja", 10)
dupont(U["D6"], P["F40"], "azul", 18); dupont(P["F44"], LA["pata"], "azul", 10)
dupont(U["D4"], PU["pata"], "blanco", 20)
for p in (LR["pata"], LA["pata"], PU["pata"]):
    dupont(p + np.array([2.5, 0, -2]), P["-1"], "negro", 8)
# Zumbador sobre la tapa: sus cables bajan por el hueco de 6 x 6; rojo a D10, negro a GND
z_tapa = cz0 + BH + BE
for color, dx, destino, color_dupont in (("rojo", -1.2, U["D10"], "rosa"), ("negro", 1.2, P["-1"], "negro")):
    a = np.array(ZU["cables"]) + (dx, 0, 0)
    h = (ZU["hueco"][0] + dx, ZU["hueco"][1], z_tapa + 0.8)
    fin = (h[0], h[1], z_tapa - BE - 8)
    cable([a, (a[0], h[1], z_tapa + 0.8), h, fin], color, grupo="tapa")
    dupont(fin, destino, color_dupont, 16)
# DS18B20 (bus 1-Wire en la fila F12 con la resistencia de 4.7 kΩ)
dupont(U["D2"], P["F12"], "amarillo", 16)
e = mazo([DS["cable"], (DS["cable"][0], DS["cable"][1], zA - 14), (x1 - 4, DS["cable"][1], zA - 14), (x1 - 4, BY0 + 52, zA - 14)], "negro", 2.0)
dupont(e, P["F12"] + np.array([0, 2.5, 0]), "amarillo", 8); dupont(e, P["+2"], "rojo", 8); dupont(e, P["-2"], "negro", 8)
# Módulo HR202: alimentación y contacto seco (COM a GND, NO a D3)
for nombre, color, dz in (("VCC", "rojo", 0), ("GND", "negro", 1.6), ("COM", "negro", 3.2), ("NO", "verde", 4.8)):
    p = HU[nombre]
    e = mazo([p, (x1 - 4, p[1], p[2]), (x1 - 4, BY0 + 52, Z0 + 40 + dz)], color, 0.8, dz - 2.4)
    destino = {"VCC": P["+3"], "GND": P["-3"], "COM": P["-5"], "NO": U["D3"]}[nombre]
    dupont(e, destino, color, 16)
# Sonda de suelo: un clavo a A1, el otro a GND
for dy, color, destino in ((-6, "lima", U["A1"]), (6, "negro", P["-6"])):
    c0 = (MAC_X + 33, MAC_Y + dy, Z0 + 106)
    e = mazo([c0, (MAC_X + 58, MAC_Y + dy, Z0 + 60), (MAC_X + 60, MAC_Y + dy, Z0 + 3), (MAC_X + 60, BY0 + 52 + dy / 3, Z0 + 3)], color, 0.8, dy / 3)
    dupont(e, destino, color, 14)
# Ventilador: rojo al NO del relé 2, negro a GND
for color, dy, destino in (("rojo", -1, RELES[2]["NO"]), ("negro", 1, P["-7"])):
    v = VE["cables"]
    e = mazo([v, (x0 + 14, v[1] + dy, v[2] - 6), (x0 + 14, v[1] + dy, Z0 + 3), (x0 + 14, BY0 + 30, Z0 + 3), (x1 - 20, BY0 + 30, Z0 + 3)], color, 0.8, dy)
    dupont(e, destino, color, 12)
# Bomba y sonda del tanque: por el hueco del fondo de la caja
for color, dx, inicio, destino in (("rojo", -2, BO["cables"], RELES[1]["NO"]), ("negro", 2, BO["cables"], P["-4"])):
    cable([inicio, (inicio[0], inicio[1], Z0 + TH + 12), (ENTRADA_T[0] + dx, TY0 - 2, Z0 + TH + 12), ENTRADA_T + (dx, 0, 0)], color)
    dupont(ENTRADA_T + (dx, 0, 0), destino, color, 12)
for color, dx, destino in (("cian", 0, U["A2"]), ("negro", 10, P["-9"])):
    a = (TX0 + 8 + dx, TY0 + 4, Z0 + TH + 6)
    cable([a, (a[0], a[1] - 6, Z0 + TH + 14), (ENTRADA_T[0] + 6 + dx / 2, TY0 - 4, Z0 + TH + 14), ENTRADA_T + (6 + dx / 2, 0, 0)], color)
    dupont(ENTRADA_T + (6 + dx / 2, 0, 0), destino, color, 12)
agregar(*cables.values())

# ============================== Salidas ==============================
GRUPOS_STL = {
    "base-y-estructura": ("base", "estructura"),
    "paredes-y-techo": ("pared_frontal", "paredes", "techo"),
    "caja-electronica": ("caja", "tapa"),
    "electronica": ("electronica",),
    "interior-invernadero": ("interior",),
    "tanque-y-bomba": ("tanque",),
    "cableado": ("cables",),
}


def renders():
    vistas = [
        ("render-general.png", dict(ojo=(1020, -560, 640), objetivo=(232, 150, 100), fov=30,
                                    titulo="Maqueta del invernadero IoT",
                                    etiquetas=[((x0 + 150, y0 + 60, zC - 30), "Techo de acrílico con bisagra", (-40, -60)),
                                               ((BX0 + 40, BY0, Z0 + 50), "Caja de la electrónica con pantalla", (-40, 70)),
                                               ((TX0 + TW, TY0 + 40, Z0 + 80), "Tanque de 1 L con bomba", (40, -30)),
                                               ((x1, y0 + 140, Z0 + 120), "Módulo HR202", (40, -40)),
                                               ((MAC_X, MAC_Y - 50, Z0 + 60), "Maceta con sonda de suelo", (-40, 60)),
                                               ((ZUM_X, ZUM_Y, z_tapa + 13), "Zumbador de alarma", (40, -50)),
                                               ((x0 - E, y0 + 150, Z0 + 190), "Ventilador 40 x 40", (-40, -40))])),
        ("render-caja-interior.png", dict(ojo=(BX0 + 75, BY0 + 30, Z0 + 470), objetivo=(BX0 + 75, BY0 + 100, Z0), fov=36,
                                          ocultar=("tapa",), titulo="Caja de la electrónica, vista superior sin tapa",
                                          etiquetas=[((BX0 + 92, BY0 + 150, Z0 + 20), "Arduino Uno R3", (60, -20)),
                                                     ((BX0 + 30, BY0 + 160, Z0 + 15), "Protoboard 830", (-60, -20)),
                                                     ((BX0 + 77, BY0 + 30, Z0 + 25), "Relé 1: bomba", (-70, 60)),
                                                     ((BX0 + 105, BY0 + 30, Z0 + 25), "Relé 2: ventilador", (40, 70)),
                                                     (P["F12"], "Resistencia 4.7 kΩ", (-60, -40)),
                                                     ((BX0 + 50, BY0 + 12, Z0 + 70), "LCD 16x2 I2C (por detrás)", (-60, 50)),
                                                     ((BX0 + 8, BY0 + 52, Z0 + 20), "Paso de cables", (-50, 20))])),
        ("render-invernadero-interior.png", dict(ojo=(x0 + 150, y0 - 470, Z0 + 260), objetivo=(x0 + 150, y0 + 170, Z0 + 120), fov=34,
                                                 ocultar=("pared_frontal",), titulo="Interior del invernadero (sin pared frontal)",
                                                 etiquetas=[(HU["NO"], "Módulo HR202"), (DS["cable"], "Sonda DS18B20"),
                                                            ((MAC_X, MAC_Y, Z0 + ALT_MANGUERA - 10), "Boquilla"),
                                                            ((MAC_X + 33, MAC_Y - 6, Z0 + 104), "Sonda de suelo"),
                                                            (VE["cables"], "Ventilador 40 x 40")])),
        ("render-tanque.png", dict(ojo=(TX0 + 330, TY0 + 330, Z0 + 260), objetivo=(TX0 + 50, TY0 + 30, Z0 + 40), fov=34,
                                   titulo="Tanque, bomba y sonda de nivel",
                                   etiquetas=[(BO["salida"], "Bomba sumergible"), ((TX0 + 13, TY0 + 4, Z0 + 60), "Sonda de nivel"),
                                              ((BO["salida"][0], yb, Z0 + 150), "Manguera de silicona")])),
        ("render-planta.png", dict(ojo=(BASE_X / 2, BASE_Y / 2, 2400), objetivo=(BASE_X / 2, BASE_Y / 2, 0), ortografica=560,
                                   ocultar=("techo", "tapa"), titulo="Vista superior (sin techo ni tapa)")),
    ]
    for nombre, kw in vistas:
        render(MALLAS, **kw).save(DIR_MAQ / nombre, optimize=True)
        print("  render:", nombre)


def planos():
    W, H = ANCHO, ALTO
    largo_techo = round(math.hypot(ANCHO / 2 + 6, CUMBRE + 3))
    piezas = [
        ("Base", "MDF 6 mm", [(0, 0), (BASE_X, 0), (BASE_X, BASE_Y), (0, BASE_Y)], [], 1),
        ("Pared frontal", "Acrílico transparente 2 mm", [(0, 0), (W, 0), (W, H), (W / 2, H + CUMBRE), (0, H)], [], 1),
        ("Pared de fondo", "Acrílico transparente 2 mm", [(0, 0), (W, 0), (W, H), (W / 2, H + CUMBRE), (0, H)], HUECOS["pared_fondo"], 1),
        ("Pared izquierda", "Acrílico transparente 2 mm", [(0, 0), (FONDO, 0), (FONDO, H), (0, H)], HUECOS["pared_izquierda"], 1),
        ("Pared derecha", "Acrílico transparente 2 mm", [(0, 0), (FONDO, 0), (FONDO, H), (0, H)], HUECOS["pared_derecha"], 1),
        ("Techo", "Acrílico transparente 2 mm", [(0, 0), (FONDO + 12, 0), (FONDO + 12, largo_techo), (0, largo_techo)], [], 2),
        ("Caja: frente", "MDF 3 mm", [(0, 0), (BW, 0), (BW, BH), (0, BH)], HUECOS["caja_frente"], 1),
        ("Caja: fondo", "MDF 3 mm", [(0, 0), (BW, 0), (BW, BH), (0, BH)], HUECOS["caja_fondo"], 1),
        ("Caja: lateral izquierdo", "MDF 3 mm", [(0, 0), (BD, 0), (BD, BH), (0, BH)], HUECOS["caja_izquierda"], 1),
        ("Caja: lateral derecho", "MDF 3 mm", [(0, 0), (BD, 0), (BD, BH), (0, BH)], [], 1),
        ("Caja: piso", "MDF 3 mm", [(0, 0), (BW, 0), (BW, BD), (0, BD)], [], 1),
        ("Caja: tapa (vista superior)", "MDF 3 mm", [(0, 0), (BW, 0), (BW, BD), (0, BD)], HUECOS["caja_tapa"], 1),
    ]
    margen, sep, hoja = 30, 70, 1560
    x, y, fila = margen, 120, 0
    svg = []
    for nombre, mat, poli, huecos, cant in piezas:
        pw, ph = max(p[0] for p in poli), max(p[1] for p in poli)
        if x + pw > hoja - margen:
            x, y, fila = margen, y + fila + 120, 0
        svg.append(f"<polygon points='{' '.join(f'{x + a},{y + ph - b}' for a, b in poli)}' fill='#fff' stroke='#263238' stroke-width='1.4'/>")
        notas = []
        for (u0, v0, u1, v1, t) in huecos:
            svg.append(f"<rect x='{x + u0}' y='{y + ph - v1}' width='{u1 - u0}' height='{v1 - v0}' fill='#FDECEA' stroke='#B3332E' stroke-dasharray='4 3'/>")
            nota = f"{t}: u {u0:g}–{u1:g}, v {v0:g}–{v1:g}"
            if t not in [n.split(':')[0] for n in notas]:
                notas.append(nota)
        svg.append(f"<text x='{x}' y='{y - 24}' font-size='15' font-weight='600'>{nombre}{'  ×' + str(cant) if cant > 1 else ''}</text>")
        svg.append(f"<text x='{x}' y='{y - 8}' font-size='11' fill='#546E7A'>{mat}</text>")
        svg.append(f"<text x='{x + pw / 2}' y='{y + ph + 16}' font-size='12' text-anchor='middle'>{pw:g}</text>")
        svg.append(f"<text x='{x + pw + 6}' y='{y + ph / 2 + 4}' font-size='12'>{ph:g}</text>")
        for i, t in enumerate(notas):
            svg.append(f"<text x='{x}' y='{y + ph + 34 + i * 14}' font-size='10.5' fill='#B3332E'>{t}</text>")
        x += max(pw, 190 if notas else 0) + sep
        fila = max(fila, ph + len(notas) * 14)
    alto = y + fila + 190
    cabio = round(math.hypot(ANCHO / 2, CUMBRE))
    balso = [("Postes de esquina", 4, ALTO), ("Postes intermedios laterales", 2, ALTO), ("Vigas del alero, frente y fondo", 2, ANCHO),
             ("Vigas del alero, laterales", 2, FONDO), ("Soleras inferiores, frente y fondo", 2, ANCHO), ("Soleras inferiores, laterales", 2, FONDO),
             ("Cumbrera", 1, FONDO), ("Pies de cumbrera", 2, CUMBRE), ("Cabios", 6, cabio)]
    ty = alto - 150
    svg.append(f"<text x='{margen}' y='{ty}' font-size='15' font-weight='600'>Listones de balso 10 x 10 mm (total {sum(n * l for _, n, l in balso) / 1000:.2f} m)</text>")
    for i, (n, c, l) in enumerate(balso):
        svg.append(f"<text x='{margen + (i % 3) * 470}' y='{ty + 24 + (i // 3) * 19}' font-size='12.5'>{c} × {l} mm: {n}</text>")
    cab = (f"<text x='{margen}' y='42' font-size='24' font-weight='700'>Maqueta del invernadero: piezas cortadas</text>"
           f"<text x='{margen}' y='66' font-size='13' fill='#546E7A'>Medidas en milímetros, escala 1:1. Huecos en rojo, vistos desde el exterior; "
           f"u horizontal y v vertical desde la esquina inferior izquierda.</text>")
    (DIR_MAQ / "planos-de-corte.svg").write_text(
        f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {hoja} {alto}' width='{hoja}mm' height='{alto}mm' "
        f"font-family='Segoe UI, Roboto, Arial, sans-serif' fill='#263238'><rect width='100%' height='100%' fill='#F7FAF8'/>{cab}{''.join(svg)}</svg>\n",
        encoding="utf-8")


def planta():
    """Distribución vista desde arriba, con cotas."""
    k, ox, oy = 2.2, 110, 110
    X = lambda x: ox + x * k
    Y = lambda y: oy + (BASE_Y - y) * k
    s = []

    def rect(xa, ya, xb, yb, relleno, txt=None, sub=None, op=1.0):
        s.append(f"<rect x='{X(xa)}' y='{Y(yb)}' width='{(xb - xa) * k}' height='{(yb - ya) * k}' fill='{relleno}' fill-opacity='{op}' stroke='#263238' stroke-width='1.5'/>")
        if txt:
            s.append(f"<text x='{X((xa + xb) / 2)}' y='{Y((ya + yb) / 2)}' font-size='14' text-anchor='middle' font-weight='600'>{txt}</text>")
        if sub:
            s.append(f"<text x='{X((xa + xb) / 2)}' y='{Y((ya + yb) / 2) + 17}' font-size='11.5' text-anchor='middle' fill='#4D5F54'>{sub}</text>")

    def cota_h(xa, xb, y, texto, desp):
        yy = Y(y) + desp
        s.append(f"<line x1='{X(xa)}' y1='{yy}' x2='{X(xb)}' y2='{yy}' stroke='#B9790A' marker-start='url(#f)' marker-end='url(#f)'/>")
        s.append(f"<text x='{(X(xa) + X(xb)) / 2}' y='{yy - 5}' font-size='12' text-anchor='middle' fill='#8A5A06'>{texto}</text>")

    def cota_v(x, ya, yb, texto, desp):
        xx = X(x) + desp
        s.append(f"<line x1='{xx}' y1='{Y(ya)}' x2='{xx}' y2='{Y(yb)}' stroke='#B9790A' marker-start='url(#f)' marker-end='url(#f)'/>")
        s.append(f"<text x='{xx + (6 if desp > 0 else -6)}' y='{(Y(ya) + Y(yb)) / 2 + 4}' font-size='12' text-anchor='{'start' if desp > 0 else 'end'}' fill='#8A5A06'>{texto}</text>")

    rect(0, 0, BASE_X, BASE_Y, "#E9DCC3")
    rect(x0, y0, x1, y1, "#DDF0F5", None, None, 0.9)
    s.append(f"<text x='{X(x0 + 150)}' y='{Y(y0 + 40)}' font-size='14' text-anchor='middle' font-weight='600'>Invernadero</text>")
    s.append(f"<text x='{X(x0 + 150)}' y='{Y(y0 + 40) + 17}' font-size='11.5' text-anchor='middle' fill='#4D5F54'>balso 10 x 10 y acrílico 2 mm</text>")
    s.append(f"<circle cx='{X(MAC_X)}' cy='{Y(MAC_Y)}' r='{55 * k}' fill='#C98E66' stroke='#6E4428'/>")
    s.append(f"<text x='{X(MAC_X)}' y='{Y(MAC_Y) + 4}' font-size='12' text-anchor='middle' fill='#fff'>Maceta Ø110</text>")
    rect(x0 - 12, y0 + 130, x0 - 2, y0 + 170, "#263238")
    s.append(f"<text x='{X(x0 + 4)}' y='{Y(y0 + 122)}' font-size='12'>Ventilador</text>")
    rect(x0 + 110, y1, x0 + 190, y1 + 3, "#5A6B62")
    s.append(f"<text x='{X(x0 + 150)}' y='{Y(y1) + 20}' font-size='12' text-anchor='middle'>Rejilla de entrada de aire</text>")
    rect(x1 - 23, y0 + 115, x1 - 6, y0 + 175, "#1E5FA0")
    s.append(f"<text x='{X(x1 - 30)}' y='{Y(y0 + 145) + 4}' font-size='12' text-anchor='end'>Módulo HR202</text>")
    s.append(f"<circle cx='{X(x0 + 210)}' cy='{Y(y0 + 150)}' r='{3 * k}' fill='#C9D1D6' stroke='#263238'/>")
    s.append(f"<text x='{X(x0 + 210)}' y='{Y(y0 + 150) - 12}' font-size='12' text-anchor='middle'>DS18B20</text>")
    rect(BX0, BY0, BX0 + BW, BY0 + BD, "#D8BE8F", "Caja de la electrónica", "MDF 3 mm, 75 mm de alto")
    rect(TX0, TY0, TX0 + TW, TY0 + TD, "#CFE5F0", "Tanque 1 L", "con la bomba sumergible")
    s.append(f"<polyline points='{X(BO['salida'][0])},{Y(yb)} {X(MAC_X)},{Y(yb)} {X(MAC_X)},{Y(MAC_Y)}' fill='none' stroke='#2370AE' stroke-width='3' stroke-dasharray='8 5'/>")
    s.append(f"<text x='{X(170)}' y='{Y(yb) - 8}' font-size='12' fill='#2370AE'>Manguera a {ALT_MANGUERA} mm de altura</text>")
    s.append(f"<line x1='{X(x1)}' y1='{Y(BY0 + 52)}' x2='{X(BX0)}' y2='{Y(BY0 + 52)}' stroke='#B3332E' stroke-width='5'/>")
    s.append(f"<text x='{X(x1) - 6}' y='{Y(BY0 + 52) + 20}' font-size='12' fill='#B3332E' text-anchor='end'>Paso de cables</text>")
    cota_h(0, BASE_X, 0, f"{BASE_X} mm", 32)
    cota_v(0, 0, BASE_Y, f"{BASE_Y} mm", -44)
    cota_h(x0, x1, y1, f"{ANCHO} mm", -34)
    cota_h(BX0, BX0 + BW, 0, f"{BW} mm", 62)
    cota_v(BASE_X, BY0, BY0 + BD, f"{BD} mm", 30)
    cota_v(BASE_X, TY0, TY0 + TD, f"{TD} mm", 30)
    w_svg, h_svg = X(BASE_X) + 140, Y(0) + 110
    (DIR_MAQ / "planta-distribucion.svg").write_text(
        f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w_svg:.0f} {h_svg:.0f}' font-family='Segoe UI, Roboto, Arial, sans-serif' fill='#263238'>"
        "<defs><marker id='f' viewBox='0 0 10 10' refX='5' refY='5' markerWidth='6' markerHeight='6' orient='auto-start-reverse'>"
        "<path d='M0 0 L10 5 L0 10 z' fill='#B9790A'/></marker></defs>"
        f"<rect width='100%' height='100%' fill='#F7FAF8'/><text x='{ox}' y='46' font-size='22' font-weight='700'>Distribución de la maqueta (vista superior)</text>"
        f"<text x='{ox}' y='70' font-size='13' fill='#4D5F54'>Frente hacia abajo. Medidas en milímetros.</text>{''.join(s)}</svg>\n", encoding="utf-8")


if __name__ == "__main__":
    DIR_3D.mkdir(parents=True, exist_ok=True)
    DIR_MAQ.mkdir(parents=True, exist_ok=True)
    con_renders = "--sin-renders" not in sys.argv
    for viejo in list(DIR_3D.glob("*.stl")) + (list(DIR_MAQ.glob("render-*.png")) if con_renders else []):
        viejo.unlink()
    total = guardar_stl(DIR_3D / "maqueta-completa.stl", MALLAS)
    guardar_obj(DIR_3D / "maqueta-completa.obj", MALLAS)
    for nombre, grupos in GRUPOS_STL.items():
        guardar_stl(DIR_3D / f"{nombre}.stl", [m for m in MALLAS if m.grupo in grupos])
    print(f"Modelo: {total} triángulos, {len(MALLAS)} piezas")
    planos()
    planta()
    if con_renders:
        renders()
