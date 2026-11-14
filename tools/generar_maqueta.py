#!/usr/bin/env python3
"""Maqueta paramétrica del invernadero.

Genera:
  hardware/3d-models/*.stl            modelo 3D (completo y por piezas). GitHub los muestra en 3D;
                                      Tinkercad, Fusion 360 o cualquier visor STL los abre.
  hardware/maqueta/render-*.png       vistas de la maqueta
  hardware/maqueta/planos-de-corte.svg  piezas a recortar, con medidas en milímetros

Uso:  python3 tools/generar_maqueta.py        (necesita numpy y matplotlib)
Todas las medidas están en milímetros y se cambian en la sección PARÁMETROS.
"""
import math
import struct
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

RAIZ = Path(__file__).resolve().parent.parent
DIR_STL = RAIZ / "hardware" / "3d-models"
DIR_MAQUETA = RAIZ / "hardware" / "maqueta"

# ============================ PARÁMETROS ============================
BASE_X, BASE_Y, BASE_Z = 460, 300, 5          # tablero de MDF o cartón paja
INV_X, INV_Y = 300, 300                        # planta del invernadero
ALTO_PARED = 220                               # altura hasta el alero
ALTO_CUMBRERA = 90                             # altura extra del techo a dos aguas
LISTON = 10                                    # palitos de balso de 10 x 10 mm
CAJA_X0, CAJA_X = 315, 140                     # caja de la electrónica (zona seca)
CAJA_Y, CAJA_Z = 190, 75
TANQUE_X0, TANQUE_Y0 = 325, 205                # recipiente del agua (comprado)
TANQUE_X, TANQUE_Y, TANQUE_Z = 120, 85, 100
MACETA_X, MACETA_Y, MACETA_R, MACETA_Z = 110, 150, 55, 95
VENTILADOR = 40                                # ventilador de 40 x 40 x 10 mm
# ====================================================================


class Malla:
    def __init__(self, nombre, color, alfa=1.0):
        self.nombre, self.color, self.alfa = nombre, color, alfa
        self.tris = []

    def tri(self, a, b, c):
        self.tris.append((np.array(a, float), np.array(b, float), np.array(c, float)))

    def quad(self, a, b, c, d):
        self.tri(a, b, c)
        self.tri(a, c, d)

    def caja(self, x0, y0, z0, x1, y1, z1):
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for i in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
            self.quad(*[p[j] for j in i])
        return self

    def cilindro(self, a, b, r, n=28):
        """Cilindro entre los puntos a y b."""
        a, b = np.array(a, float), np.array(b, float)
        eje = b - a
        eje /= np.linalg.norm(eje)
        aux = np.array([1.0, 0, 0]) if abs(eje[0]) < 0.9 else np.array([0, 1.0, 0])
        u = np.cross(eje, aux); u /= np.linalg.norm(u)
        v = np.cross(eje, u)
        anillo = [r * (math.cos(2 * math.pi * k / n) * u + math.sin(2 * math.pi * k / n) * v) for k in range(n)]
        for k in range(n):
            p0, p1 = anillo[k], anillo[(k + 1) % n]
            self.quad(a + p0, a + p1, b + p1, b + p0)
            self.tri(a, a + p1, a + p0)
            self.tri(b, b + p0, b + p1)
        return self

    def placa(self, puntos, grosor, normal):
        """Polígono convexo con espesor (puntos en orden, normal hacia afuera)."""
        n = np.array(normal, float) * grosor
        base = [np.array(p, float) for p in puntos]
        tapa = [p + n for p in base]
        for i in range(1, len(base) - 1):
            self.tri(base[0], base[i + 1], base[i])
            self.tri(tapa[0], tapa[i], tapa[i + 1])
        for i in range(len(base)):
            j = (i + 1) % len(base)
            self.quad(base[i], base[j], tapa[j], tapa[i])
        return self


def guardar_stl(ruta, mallas):
    tris = [t for m in mallas for t in m.tris]
    with open(ruta, "wb") as f:
        f.write(b"Invernadero IoT - maqueta".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            n = np.cross(b - a, c - a)
            l = np.linalg.norm(n)
            n = n / l if l else n
            f.write(struct.pack("<12fH", *n, *a, *b, *c, 0))


# ------------------------------ Piezas ------------------------------
Z0 = BASE_Z
CUMBRE = Z0 + ALTO_PARED + ALTO_CUMBRERA
L = LISTON

base = Malla("base", "#C8A97E").caja(0, 0, 0, BASE_X, BASE_Y, BASE_Z)

estructura = Malla("estructura", "#E3C98F")
for x in (0, INV_X - L):
    for y in (0, INV_Y - L):
        estructura.caja(x, y, Z0, x + L, y + L, Z0 + ALTO_PARED)                    # postes
for y in (0, INV_Y - L):
    estructura.caja(0, y, Z0 + ALTO_PARED - L, INV_X, y + L, Z0 + ALTO_PARED)      # vigas frente/fondo
    estructura.caja(INV_X / 2 - L / 2, y, Z0 + ALTO_PARED, INV_X / 2 + L / 2, y + L, CUMBRE)  # pie de la cumbrera
for x in (0, INV_X - L):
    estructura.caja(x, 0, Z0 + ALTO_PARED - L, x + L, INV_Y, Z0 + ALTO_PARED)      # vigas laterales
estructura.caja(INV_X / 2 - L / 2, 0, CUMBRE - L, INV_X / 2 + L / 2, INV_Y, CUMBRE)  # cumbrera
for y in (0, INV_Y - L):                                                            # cabios (inclinados)
    for x_alero, signo in ((0, 1), (INV_X, -1)):
        estructura.cilindro((x_alero + signo * L / 2, y + L / 2, Z0 + ALTO_PARED),
                            (INV_X / 2, y + L / 2, CUMBRE - L / 2), L / 2, 6)

paredes = Malla("paredes (acetato)", "#9FD3E6", 0.18)
E = 1.5   # espesor del acetato o acrílico
for y, normal in ((0, (0, -1, 0)), (INV_Y, (0, 1, 0))):
    paredes.placa([(0, y, Z0), (INV_X, y, Z0), (INV_X, y, Z0 + ALTO_PARED), (INV_X / 2, y, CUMBRE),
                   (0, y, Z0 + ALTO_PARED)], E, normal)
for x, normal in ((0, (-1, 0, 0)), (INV_X, (1, 0, 0))):
    paredes.placa([(x, 0, Z0), (x, INV_Y, Z0), (x, INV_Y, Z0 + ALTO_PARED), (x, 0, Z0 + ALTO_PARED)], E, normal)

techo = Malla("techo (acetato)", "#9FD3E6", 0.22)
inclin = math.atan2(ALTO_CUMBRERA, INV_X / 2)
techo.placa([(0, 0, Z0 + ALTO_PARED), (INV_X / 2, 0, CUMBRE), (INV_X / 2, INV_Y, CUMBRE), (0, INV_Y, Z0 + ALTO_PARED)],
            E, (-math.sin(inclin), 0, math.cos(inclin)))
techo.placa([(INV_X, 0, Z0 + ALTO_PARED), (INV_X, INV_Y, Z0 + ALTO_PARED), (INV_X / 2, INV_Y, CUMBRE), (INV_X / 2, 0, CUMBRE)],
            E, (math.sin(inclin), 0, math.cos(inclin)))

# Ventilador en la pared izquierda (arriba) y rejilla de entrada en el fondo (abajo)
ventilador = Malla("ventilador", "#263238")
vz = Z0 + ALTO_PARED - 35 - VENTILADOR
ventilador.caja(-10, INV_Y / 2 - VENTILADOR / 2, vz, 0, INV_Y / 2 + VENTILADOR / 2, vz + VENTILADOR)
rejilla = Malla("rejilla de entrada", "#546E7A")
rejilla.caja(INV_X / 2 - 40, INV_Y, Z0 + 25, INV_X / 2 + 40, INV_Y + 2, Z0 + 55)

maceta = Malla("maceta", "#9C6B4A").cilindro((MACETA_X, MACETA_Y, Z0), (MACETA_X, MACETA_Y, Z0 + MACETA_Z), MACETA_R)
planta = Malla("planta", "#2E7A4C")
planta.cilindro((MACETA_X, MACETA_Y, Z0 + MACETA_Z), (MACETA_X, MACETA_Y, Z0 + MACETA_Z + 60), 3, 10)
planta.cilindro((MACETA_X, MACETA_Y, Z0 + MACETA_Z + 40), (MACETA_X, MACETA_Y, Z0 + MACETA_Z + 85), 32, 18)
sonda_suelo = Malla("sonda de suelo", "#90A4AE")
for dx in (-6, 6):
    sonda_suelo.cilindro((MACETA_X + 30 + dx, MACETA_Y, Z0 + MACETA_Z - 50), (MACETA_X + 30 + dx, MACETA_Y, Z0 + MACETA_Z + 25), 1.8, 8)

sensores = Malla("sensores", "#2370AE")
sensores.caja(195, 170, Z0 + 120, 227, 184, Z0 + 135)                                 # HR202 colgado al centro
sensores.cilindro((210, 130, Z0 + 115), (210, 130, Z0 + 165), 3.5, 12)                # DS18B20 colgado

lampara = Malla("luz de cultivo", "#F5C542")
lampara.cilindro((INV_X / 2, INV_Y / 2, CUMBRE - L), (INV_X / 2, INV_Y / 2, CUMBRE - 45), 1.5, 8)
lampara.cilindro((INV_X / 2, INV_Y / 2, CUMBRE - 45), (INV_X / 2, INV_Y / 2, CUMBRE - 60), 22, 24)

ALTURA_MANGUERA = 205   # entra por la pared derecha, por debajo del alero
manguera = Malla("manguera y boquilla", "#1E5F96")
recorrido = [(TANQUE_X0 + 60, TANQUE_Y0 + 42, Z0 + 20), (TANQUE_X0 + 60, TANQUE_Y0 + 42, Z0 + ALTURA_MANGUERA),
             (MACETA_X, TANQUE_Y0 + 42, Z0 + ALTURA_MANGUERA), (MACETA_X, MACETA_Y, Z0 + ALTURA_MANGUERA)]
for a, b in zip(recorrido, recorrido[1:]):
    manguera.cilindro(a, b, 3.5, 10)
manguera.cilindro((MACETA_X, MACETA_Y, Z0 + ALTURA_MANGUERA + 3), (MACETA_X, MACETA_Y, Z0 + ALTURA_MANGUERA - 12), 6, 12)  # boquilla

caja = Malla("caja de la electrónica", "#37474F")
caja.caja(CAJA_X0, 0, Z0, CAJA_X0 + CAJA_X, CAJA_Y, Z0 + CAJA_Z)
panel = Malla("panel frontal", "#9BE3B4")
panel.caja(CAJA_X0 + 18, -1.5, Z0 + 34, CAJA_X0 + 90, 0, Z0 + 59)                        # pantalla LCD
leds = [Malla(f"led {i}", col).cilindro((CAJA_X0 + 112.5 + i * 12, 0, Z0 + 50.5), (CAJA_X0 + 112.5 + i * 12, -4, Z0 + 50.5), 2.5, 12)
        for i, col in enumerate(("#E53935", "#1E88E5"))]
boton = Malla("pulsador", "#B0BEC5").cilindro((CAJA_X0 + 118, 0, Z0 + 17), (CAJA_X0 + 118, -6, Z0 + 17), 6, 16)

tanque = Malla("tanque", "#8EC5E8", 0.35).caja(TANQUE_X0, TANQUE_Y0, Z0, TANQUE_X0 + TANQUE_X, TANQUE_Y0 + TANQUE_Y, Z0 + TANQUE_Z)
agua = Malla("agua", "#2370AE", 0.55).caja(TANQUE_X0 + 2, TANQUE_Y0 + 2, Z0 + 2, TANQUE_X0 + TANQUE_X - 2, TANQUE_Y0 + TANQUE_Y - 2, Z0 + 70)
bomba = Malla("bomba", "#263238").cilindro((TANQUE_X0 + 60, TANQUE_Y0 + 42, Z0 + 2), (TANQUE_X0 + 60, TANQUE_Y0 + 42, Z0 + 35), 12, 18)
sonda_tanque = Malla("sonda del tanque", "#90A4AE")
for dx in (-5, 5):
    sonda_tanque.cilindro((TANQUE_X0 + 20 + dx, TANQUE_Y0 + 20, Z0 + 15), (TANQUE_X0 + 20 + dx, TANQUE_Y0 + 20, Z0 + TANQUE_Z + 20), 1.2, 8)

PIEZAS = {
    "base": [base],
    "estructura-balso": [estructura],
    "paredes-y-techo": [paredes, techo],
    "caja-electronica": [caja, panel, boton] + leds,
    "tanque-y-bomba": [tanque, bomba, sonda_tanque],
    "interior": [maceta, planta, sonda_suelo, sensores, lampara, manguera, ventilador, rejilla],
}
TODO = [m for ms in PIEZAS.values() for m in ms] + [agua]


def render(ruta, elev, azim, titulo, solidas=None):
    fig = plt.figure(figsize=(11, 8), dpi=110)
    ax = fig.add_subplot(111, projection="3d")
    from matplotlib.colors import to_rgba
    caras, colores = [], []
    for m in TODO:
        if solidas is not None and m not in solidas:
            continue
        rgba = to_rgba(m.color, m.alfa)
        for t in m.tris:
            caras.append([tuple(p) for p in t])
            colores.append(rgba)
    # Una sola colección: matplotlib ordena las caras una por una (las piezas pequeñas no quedan tapadas)
    ax.add_collection3d(Poly3DCollection(caras, facecolors=colores, edgecolors="none", linewidths=0))
    ax.set_xlim(-20, BASE_X + 10); ax.set_ylim(-20, BASE_Y + 20); ax.set_zlim(0, CUMBRE + 20)
    ax.set_box_aspect((BASE_X + 30, BASE_Y + 40, CUMBRE + 20))
    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    ax.set_facecolor("#F7FAF8")
    ax.set_title(titulo, fontsize=15, pad=0)
    fig.subplots_adjust(0, 0, 1, 0.95)
    fig.savefig(ruta, facecolor="#F7FAF8")
    plt.close(fig)


# ---------------------------- Planos 2D ----------------------------
def planos(ruta):
    piezas = []   # (nombre, material, polígono [(x,y)], agujeros [(x,y,w,h,etiqueta)], cantidad)
    W, H, C = INV_X, ALTO_PARED, ALTO_CUMBRERA
    piezas.append(("Base", "MDF 3 mm o cartón paja 5 mm", [(0, 0), (BASE_X, 0), (BASE_X, BASE_Y), (0, BASE_Y)], [], 1))
    piezas.append(("Pared frontal", "acetato o acrílico 1.5–2 mm", [(0, 0), (W, 0), (W, H), (W / 2, H + C), (0, H)], [], 1))
    piezas.append(("Pared de fondo", "acetato o acrílico 1.5–2 mm", [(0, 0), (W, 0), (W, H), (W / 2, H + C), (0, H)],
                   [(W / 2 - 40, 25, 80, 30, "rejilla de entrada 80×30 (tapar con malla)")], 1))
    vy = H - 35 - VENTILADOR
    piezas.append(("Pared izquierda", "acetato o acrílico 1.5–2 mm", [(0, 0), (INV_Y, 0), (INV_Y, H), (0, H)],
                   [(INV_Y / 2 - 19, vy + 1, 38, 38, "hueco del ventilador 38×38")], 1))
    piezas.append(("Pared derecha", "acetato o acrílico 1.5–2 mm", [(0, 0), (INV_Y, 0), (INV_Y, H), (0, H)],
                   [(40, 10, 25, 15, "paso de cables 25×15"), (TANQUE_Y0 + 42 - 6, ALTURA_MANGUERA - 6, 12, 12, "manguera Ø 8")], 1))
    largo_techo = round(math.hypot(W / 2, C) + 10)
    piezas.append(("Techo", "acetato o acrílico 1.5–2 mm", [(0, 0), (INV_Y + 10, 0), (INV_Y + 10, largo_techo), (0, largo_techo)], [], 2))
    piezas.append(("Caja: piso y tapa", "MDF 3 mm o cartón paja", [(0, 0), (CAJA_X, 0), (CAJA_X, CAJA_Y), (0, CAJA_Y)], [], 2))
    piezas.append(("Caja: frente", "MDF 3 mm o cartón paja", [(0, 0), (CAJA_X, 0), (CAJA_X, CAJA_Z), (0, CAJA_Z)],
                   [(18, 34, 72, 25, "ventana LCD 72×25"), (110, 48, 5, 5, "2 LED Ø 5"), (122, 48, 5, 5, ""),
                    (112, 11, 12, 12, "pulsador Ø 12")], 1))
    piezas.append(("Caja: fondo", "MDF 3 mm o cartón paja", [(0, 0), (CAJA_X, 0), (CAJA_X, CAJA_Z), (0, CAJA_Z)],
                   [(10, 8, 30, 15, "USB del Arduino 30×15")], 1))
    piezas.append(("Caja: laterales", "MDF 3 mm o cartón paja", [(0, 0), (CAJA_Y, 0), (CAJA_Y, CAJA_Z), (0, CAJA_Z)],
                   [(40, 10, 25, 15, "cables al invernadero (solo el lateral izquierdo)")], 2))

    margen, sep, ancho_hoja = 30, 40, 1500
    x, y, alto_fila = margen, 110, 0
    svg = []
    for nombre, material, poli, agujeros, cant in piezas:
        pw = max(p[0] for p in poli); ph = max(p[1] for p in poli)
        if x + pw > ancho_hoja - margen:
            x, y, alto_fila = margen, y + alto_fila + sep + 60, 0
        pts = " ".join(f"{x + px},{y + ph - py}" for px, py in poli)
        svg.append(f"<polygon points='{pts}' fill='#FFFFFF' stroke='#263238' stroke-width='1.5'/>")
        pequena = ph < 100
        notas = []
        for ax_, ay, aw, ah, et in agujeros:
            svg.append(f"<rect x='{x + ax_}' y='{y + ph - ay - ah}' width='{aw}' height='{ah}' fill='#FFEBEE' stroke='#C62828' stroke-dasharray='4 3'/>")
            if not et:
                continue
            if pequena:
                notas.append(et)
            else:
                arriba = ay + ah < ph - 18
                ty_ = y + ph - ay - ah - 4 if arriba else y + ph - ay + 12
                svg.append(f"<text x='{x + ax_ + aw / 2}' y='{ty_}' font-size='10' text-anchor='middle' fill='#C62828'>{et}</text>")
        svg.append(f"<text x='{x}' y='{y - 22}' font-size='15' font-weight='600' fill='#263238'>{nombre}{'  ×' + str(cant) if cant > 1 else ''}</text>")
        svg.append(f"<text x='{x}' y='{y - 7}' font-size='11' fill='#546E7A'>{material}</text>")
        svg.append(f"<text x='{x + pw / 2}' y='{y + ph + 16}' font-size='12' text-anchor='middle' fill='#263238'>{pw:g} mm</text>")
        svg.append(f"<text x='{x + pw + 6}' y='{y + ph / 2}' font-size='12' fill='#263238'>{ph:g} mm</text>")
        if len(poli) == 5:   # paredes con techo a dos aguas: altura hasta el alero
            svg.append(f"<text x='{x + pw + 6}' y='{y + ph - H / 2 + 22}' font-size='11' fill='#546E7A'>({H:g} mm al alero)</text>")
        for i, nota in enumerate(notas):
            svg.append(f"<text x='{x}' y='{y + ph + 34 + i * 15}' font-size='11' fill='#C62828'>Hueco: {nota}</text>")
        x += pw + sep + 60
        alto_fila = max(alto_fila, ph)
    alto = y + alto_fila + 210
    # Lista de palitos de balso
    largo_cabio = round(math.hypot(W / 2, C))
    balso = [("Postes de esquina", 4, ALTO_PARED), ("Vigas frente y fondo", 2, INV_X), ("Vigas laterales", 2, INV_Y),
             ("Cumbrera", 1, INV_Y), ("Pies de cumbrera", 2, ALTO_CUMBRERA), ("Cabios del techo", 4, largo_cabio)]
    total = sum(n * l for _, n, l in balso)
    ty = alto - 110
    svg.append(f"<text x='{margen}' y='{ty}' font-size='15' font-weight='600' fill='#263238'>Palitos de balso 10×10 mm (total ≈ {total / 1000:.1f} m)</text>")
    for i, (n, c, l) in enumerate(balso):
        svg.append(f"<text x='{margen + (i % 3) * 420}' y='{ty + 24 + (i // 3) * 20}' font-size='13' fill='#263238'>{c} × {l} mm  {n}</text>")
    cabecera = (f"<text x='{margen}' y='40' font-size='24' font-weight='700' fill='#263238'>Maqueta del invernadero: planos de corte</text>"
                f"<text x='{margen}' y='64' font-size='13' fill='#546E7A'>Escala 1:1 si imprimes a tamaño real (1 unidad = 1 mm). "
                f"Las líneas rojas punteadas son huecos a recortar.</text>")
    contenido = "".join(svg)
    ruta.write_text(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {ancho_hoja} {alto}' width='{ancho_hoja}mm' height='{alto}mm' "
                    f"font-family='Segoe UI, Roboto, Arial, sans-serif'><rect width='100%' height='100%' fill='#F7FAF8'/>{cabecera}{contenido}</svg>\n",
                    encoding="utf-8")
    return balso


if __name__ == "__main__":
    DIR_STL.mkdir(parents=True, exist_ok=True)
    DIR_MAQUETA.mkdir(parents=True, exist_ok=True)
    guardar_stl(DIR_STL / "maqueta-completa.stl", TODO)
    for nombre, ms in PIEZAS.items():
        guardar_stl(DIR_STL / f"{nombre}.stl", ms)
    render(DIR_MAQUETA / "render-perspectiva.png", 22, -58, "Maqueta del invernadero: vista general")
    render(DIR_MAQUETA / "render-trasera.png", 28, 128, "Vista trasera: rejilla de entrada y tanque")
    planos(DIR_MAQUETA / "planos-de-corte.svg")
    print("Listo:", ", ".join(sorted(p.name for p in DIR_STL.glob("*.stl"))))
