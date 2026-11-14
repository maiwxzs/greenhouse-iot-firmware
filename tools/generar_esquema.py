#!/usr/bin/env python3
"""Genera hardware/circuits/esquema-conexiones.svg (esquema del circuito real).

Uso:  python3 tools/generar_esquema.py
Si cambian pines en firmware/include/Config.h, actualiza la tabla FILAS y vuelve a ejecutar.
"""
from pathlib import Path
from xml.sax.saxutils import escape

SALIDA = Path(__file__).resolve().parent.parent / "hardware" / "circuits" / "esquema-conexiones.svg"

ROJO, NEGRO, SENAL, ANALOG, I2C, CARGA = "#C62828", "#263238", "#1565C0", "#2E7D32", "#6A1B9A", "#EF6C00"
FUENTE = "font-family='Segoe UI, Roboto, Arial, sans-serif'"

X_PIN = 330          # borde derecho del Arduino
X_5V, X_GND = 420, 455
X_COMP = 640         # borde izquierdo de los componentes
ANCHO_COMP = 250

partes = []


def t(x, y, texto, tam=14, peso="normal", ancla="start", color="#263238"):
    partes.append(f"<text x='{x}' y='{y}' font-size='{tam}' font-weight='{peso}' text-anchor='{ancla}' "
                  f"fill='{color}' {FUENTE}>{escape(texto)}</text>")


def linea(x1, y1, x2, y2, color, ancho=2.2, guion=None):
    d = f" stroke-dasharray='{guion}'" if guion else ""
    partes.append(f"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='{color}' stroke-width='{ancho}' stroke-linecap='round'{d}/>")


def camino(puntos, color, ancho=2.2):
    d = " ".join(("M" if i == 0 else "L") + f"{x} {y}" for i, (x, y) in enumerate(puntos))
    partes.append(f"<path d='{d}' fill='none' stroke='{color}' stroke-width='{ancho}' stroke-linejoin='round' stroke-linecap='round'/>")


def punto(x, y, color):
    partes.append(f"<circle cx='{x}' cy='{y}' r='4.5' fill='{color}'/>")


def caja(x, y, w, h, titulo, sub="", relleno="#FFFFFF"):
    partes.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='6' fill='{relleno}' stroke='#263238' stroke-width='2'/>")
    t(x + 12, y + 22, titulo, 15, "600")
    if sub:
        t(x + 12, y + 40, sub, 12, color="#546E7A")


def tierra(x, y):
    """Símbolo de tierra: indica conexión a GND del Arduino."""
    linea(x, y, x, y + 12, NEGRO, 2.2)
    for i, w in enumerate((18, 12, 6)):
        linea(x - w / 2, y + 12 + i * 5, x + w / 2, y + 12 + i * 5, NEGRO, 2)


def resistencia(x, y, valor, horizontal=True):
    """Resistencia sobre una línea horizontal centrada en (x, y)."""
    partes.append(f"<rect x='{x - 22}' y='{y - 8}' width='44' height='16' rx='3' fill='#FFF8E1' stroke='#263238' stroke-width='1.8'/>")
    t(x, y - 13, valor, 12, ancla="middle")


def pin_arduino(y, nombre, color):
    linea(X_PIN - 14, y, X_PIN, y, color, 3)
    t(X_PIN - 20, y + 5, nombre, 14, "600", "end")


# Filas: (y, pin, color, componente)
FILAS = [
    (240, "D2", SENAL), (320, "D3", SENAL), (430, "D4", SENAL),
    (510, "D5", SENAL), (580, "D6", SENAL), (650, "D10", SENAL),
    (740, "D7", SENAL), (830, "D8", SENAL),
    (920, "A1", ANALOG), (1000, "A2", ANALOG), (1080, "A4 SDA", I2C), (1110, "A5 SCL", I2C),
]

ALTO = 1200
partes.append(f"<rect width='1500' height='{ALTO}' fill='#F7FAF8'/>")
t(40, 46, "Invernadero IoT: esquema de conexiones (Arduino Uno R3)", 24, "700")
t(40, 72, "Alimentación por el USB del Arduino. Los relés conmutan sus cargas por el borne NO (normalmente abierto).", 14, color="#546E7A")

# Arduino
caja(60, 100, X_PIN - 60, ALTO - 150, "Arduino Uno R3", "clon CH340G, por USB", "#E3F2FD")
pin_arduino(150, "5V", ROJO)
pin_arduino(185, "GND", NEGRO)
for y, pin, color in FILAS:
    pin_arduino(y, pin, color)

# Rieles de alimentación
linea(X_PIN, 150, X_5V, 150, ROJO, 3); punto(X_5V, 150, ROJO)
linea(X_PIN, 185, X_GND, 185, NEGRO, 3); punto(X_GND, 185, NEGRO)
linea(X_5V, 150, X_5V, ALTO - 70, ROJO, 3)
linea(X_GND, 185, X_GND, ALTO - 70, NEGRO, 3)
t(X_5V - 4, ALTO - 52, "5V", 13, "600", "middle", ROJO)
t(X_GND + 4, ALTO - 52, "GND", 13, "600", "middle", NEGRO)


def toma(y, x_destino, riel):
    """Conecta una patita del componente a un riel de alimentación."""
    xr = X_5V if riel == "5V" else X_GND
    color = ROJO if riel == "5V" else NEGRO
    linea(xr, y, x_destino, y, color)
    punto(xr, y, color)


def senal(y, color, x_hasta=X_COMP):
    linea(X_PIN, y, x_hasta, y, color)


# 1. DS18B20 + pull-up 4.7k
caja(X_COMP, 205, ANCHO_COMP, 70, "DS18B20 (temperatura)", "rojo VCC, negro GND, amarillo DATA")
toma(222, X_COMP, "5V"); toma(262, X_COMP, "GND")
senal(240, SENAL)
punto(560, 240, SENAL)
camino([(560, 240), (560, 205), (530, 205)], SENAL)
resistencia(507, 205, "4.7 kΩ")
camino([(485, 205), (X_5V, 205)], ROJO); punto(X_5V, 205, ROJO)

# 2. Módulo HR202 con relé: alimentación y contacto seco (NO a D3, COM a GND)
caja(X_COMP, 290, ANCHO_COMP, 82, "Módulo HR202 con relé", "humedad del aire: contacto NO / COM")
toma(302, X_COMP, "5V"); toma(362, X_COMP, "GND")
senal(320, SENAL)
t(X_COMP - 8, 316, "NO", 11, ancla="end")
toma(345, X_COMP, "GND"); t(X_COMP - 8, 341, "COM", 11, ancla="end")
t(X_COMP + 12, 362, "el umbral se ajusta con su potenciómetro", 11, color="#546E7A")

# 3. Botón
caja(X_COMP, 405, ANCHO_COMP, 50, "Pulsador", "riego manual / silenciar")
senal(430, SENAL)
toma(448, X_COMP, "GND")

# 4-5. LEDs
for y, nombre, col in [(510, "LED rojo (suelo seco)", "#E53935"), (580, "LED azul (aire húmedo)", "#1E88E5")]:
    linea(X_PIN, y, 520, y, SENAL)
    resistencia(542, y, "220 Ω")
    linea(564, y, X_COMP, y, SENAL)
    caja(X_COMP, y - 25, ANCHO_COMP, 50, nombre, "pata larga al resistor")
    partes.append(f"<circle cx='{X_COMP + ANCHO_COMP - 22}' cy='{y}' r='9' fill='{col}'/>")
    toma(y + 18, X_COMP, "GND")

# 6. Zumbador
caja(X_COMP, 625, ANCHO_COMP, 50, "Zumbador piezo activo 3–24 V", "rojo + a D10, negro − a GND")
senal(650, SENAL); toma(668, X_COMP, "GND")

# 7-9. Relés y cargas
X_CARGA_5V, X_CARGA_GND = 930, 1330
for y, rele, carga, nota in [(740, "Relé 1", "Mini bomba", "aspersor, 3–6V"),
                             (830, "Relé 2", "Ventilador 5V", "40×40 mm, 0.1 A")]:
    caja(X_COMP, y - 35, ANCHO_COMP, 72, f"{rele} (módulo 5V)", "VCC, GND, IN  |  COM, NO")
    toma(y - 22, X_COMP, "5V"); toma(y + 24, X_COMP, "GND")
    senal(y, SENAL)
    t(X_COMP - 8, y - 4, "IN", 11, ancla="end")
    # Lado de potencia
    linea(X_COMP + ANCHO_COMP, y - 12, X_CARGA_5V, y - 12, CARGA); t(X_COMP + ANCHO_COMP + 8, y - 18, "COM", 11)
    punto(X_CARGA_5V, y - 12, CARGA)
    linea(X_COMP + ANCHO_COMP, y + 14, 1010, y + 14, CARGA); t(X_COMP + ANCHO_COMP + 8, y + 30, "NO", 11)
    caja(1010, y - 20, 200, 56, carga, nota, "#FFF3E0")
    t(1002, y + 10, "+", 14, "700", "end")
    linea(1210, y + 8, X_CARGA_GND, y + 8, NEGRO)
    t(1218, y + 4, "−", 14, "700")
    punto(X_CARGA_GND, y + 8, NEGRO)

# Rieles de potencia de las cargas (salen del 5V y GND del Arduino)
camino([(X_5V, 150), (X_5V, 120), (X_CARGA_5V, 120), (X_CARGA_5V, 818)], CARGA, 3)
punto(X_5V, 120, ROJO)
linea(X_CARGA_GND, 748, X_CARGA_GND, 870, NEGRO, 3)
tierra(X_CARGA_GND, 870)
t(X_CARGA_GND + 16, 895, "a GND del Arduino", 12)
t(X_CARGA_5V + 8, 138, "5V para las cargas (del pin 5V)", 12, color=CARGA)

# 10-11. Sondas caseras
for y, nombre, sub in [(920, "Sonda de suelo", "dos clavos; usa el pull-up interno"),
                       (1000, "Sonda del tanque", "dos cables; usa el pull-up interno")]:
    caja(X_COMP, y - 25, ANCHO_COMP, 56, nombre, sub, "#E8F5E9")
    senal(y, ANALOG)
    toma(y + 20, X_COMP, "GND")

# 12. LCD
caja(X_COMP, 1050, ANCHO_COMP, 80, "LCD 16×2 con módulo I2C", "dirección 0x27 o 0x3F")
toma(1065, X_COMP, "5V"); toma(1122, X_COMP, "GND")
senal(1080, I2C); senal(1110, I2C)

# Leyenda
lx, ly = 1010, 950
partes.append(f"<rect x='{lx - 16}' y='{ly - 30}' width='420' height='212' rx='6' fill='#FFFFFF' stroke='#B0BEC5'/>")
t(lx, ly - 6, "Colores de los cables", 15, "600")
for i, (col, txt) in enumerate([(ROJO, "5V"), (NEGRO, "GND (tierra)"), (SENAL, "señal digital"),
                                (ANALOG, "señal analógica"), (I2C, "bus I2C de la pantalla"), (CARGA, "potencia de la bomba y el ventilador")]):
    yy = ly + 22 + i * 24
    linea(lx, yy - 5, lx + 36, yy - 5, col, 3)
    t(lx + 48, yy, txt, 13)
t(lx, ly + 172, "Un punto indica unión de cables; los cruces sin punto no se tocan.", 12, color="#546E7A")

svg = (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1500 {ALTO}' width='1500' height='{ALTO}'>"
       f"<title>Esquema de conexiones del invernadero IoT</title>" + "".join(partes) + "</svg>\n")
SALIDA.parent.mkdir(parents=True, exist_ok=True)
SALIDA.write_text(svg, encoding="utf-8")
print("Escrito", SALIDA)
