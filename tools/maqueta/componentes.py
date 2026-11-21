"""Modelos simplificados de los componentes, con medidas cercanas a las reales (mm).

Cada función construye la pieza en coordenadas locales y la ubica con una rotación
alrededor de z y un desplazamiento. Devuelve (mallas, puntos) donde 'puntos' son las
posiciones de pines y bornes en coordenadas del mundo, para tender los cables.
"""
import math

import numpy as np

from geometria import Malla

NEGRO, DORADO, PLATA = "#1B1D1C", "#C9A646", "#C5CCD1"


def _ubicar(mallas, puntos, rot, mover):
    t = math.radians(rot)
    R = np.array([[math.cos(t), -math.sin(t), 0], [math.sin(t), math.cos(t), 0], [0, 0, 1]])
    for m in mallas:
        m.transformar(rot, mover)
    return mallas, {k: R @ np.asarray(p, float) + np.asarray(mover, float) for k, p in puntos.items()}


# Arduino Uno R3 (clon CH340G): 68.6 x 53.3 mm, separadores de 3 mm
UNO_DIGITALES = {f"D{i}": 64.0 - 2.54 * i for i in range(8)}
UNO_DIGITALES.update({"D8": 41.9, "D9": 39.4, "D10": 36.8, "D11": 34.3, "D12": 31.8, "D13": 29.2, "GND_D": 26.7})
UNO_POTENCIA = {"IOREF": 29.2, "RESET": 31.8, "3V3": 34.3, "5V": 36.8, "GND": 39.4, "GND2": 41.9, "VIN": 44.5,
                "A0": 49.5, "A1": 52.1, "A2": 54.6, "A3": 57.2, "A4": 59.7, "A5": 62.2}


def arduino_uno(rot, mover, grupo="electronica"):
    z = 3.0
    pcb = Malla("Arduino Uno (placa)", "#1F6DAD", grupo=grupo).caja(0, 0, z, 68.6, 53.3, z + 1.6)
    zt = z + 1.6
    metal = Malla("Arduino Uno (USB)", PLATA, grupo=grupo).caja(-6.2, 32, zt, 10, 44, zt + 10.9)
    negro = Malla("Arduino Uno (componentes)", NEGRO, grupo=grupo)
    negro.caja(-1.8, 3.3, zt, 12.4, 12.2, zt + 11)                 # conector de alimentación
    negro.caja(31, 21, zt, 66, 29, zt + 4.5)                        # ATmega328P DIP-28
    negro.caja(20, 30, zt, 25, 35, zt + 1.6)                        # CH340G
    negro.caja(14, 44, zt, 20, 50, zt + 3.5)                        # botón reset
    negro.caja(63.5, 24, zt, 67.5, 31.5, zt + 8.5)                  # ICSP
    for nombre, filas in (("dig1", [UNO_DIGITALES[f"D{i}"] for i in range(8)]),
                          ("dig2", [UNO_DIGITALES[k] for k in ("D8", "D9", "D10", "D11", "D12", "D13", "GND_D")] + [24.1, 21.6, 19.1]),
                          ("pot", [UNO_POTENCIA[k] for k in ("IOREF", "RESET", "3V3", "5V", "GND", "GND2", "VIN")] + [26.7]),
                          ("ana", [UNO_POTENCIA[f"A{i}"] for i in range(6)])):
        y = 50.8 if nombre.startswith("dig") else 2.5
        negro.caja(min(filas) - 1.27, y - 1.27, zt, max(filas) + 1.27, y + 1.27, zt + 8.5)
    plata = Malla("Arduino Uno (cristal)", PLATA, grupo=grupo).caja(38, 14, zt, 49, 18.5, zt + 3.5)
    led = Malla("Arduino Uno (LED ON)", "#7CE38B", grupo=grupo).caja(26, 14, zt, 28, 15.5, zt + 0.8)
    soportes = Malla("Arduino Uno (separadores)", "#B8BEC2", grupo=grupo)
    for x, y in ((14, 2.5), (15.3, 50.7), (66.1, 7.6), (66.1, 35.5)):
        soportes.cilindro((x, y, 0), (x, y, z), 1.8, 10)
    puntos = {k: (x, 50.8, zt + 8.5) for k, x in UNO_DIGITALES.items()}
    puntos.update({k: (x, 2.5, zt + 8.5) for k, x in UNO_POTENCIA.items()})
    puntos["USB"] = (-6.2, 38, zt + 5.5)
    return _ubicar([pcb, metal, negro, plata, led, soportes], puntos, rot, mover)


# Protoboard MB-102 (830 puntos): 165.1 x 54.6 x 8.5 mm
def protoboard(rot, mover, grupo="electronica"):
    cuerpo = Malla("Protoboard 830", "#F1EFE8", grupo=grupo).caja(0, 0, 0, 165.1, 54.6, 8.5)
    rojo = Malla("Protoboard (línea +)", "#D2463F", grupo=grupo)
    azul = Malla("Protoboard (línea -)", "#2F62B8", grupo=grupo)
    for y, m in ((1.3, rojo), (7.4, azul), (47.2, azul), (53.3, rojo)):
        m.caja(6, y - 0.35, 8.5, 159, y + 0.35, 8.56)
    canal = Malla("Protoboard (canal)", "#CFCBBF", grupo=grupo).caja(4, 26.3, 8.2, 161, 28.3, 8.56)
    agujeros = Malla("Protoboard (agujeros)", "#8E8A80", grupo=grupo)
    for i in range(63):
        x = 4.5 + i * 2.54
        for j in range(5):
            agujeros.caja(x - 0.4, 10.2 + j * 2.54 - 0.4, 8.5, x + 0.4, 10.2 + j * 2.54 + 0.4, 8.58)
            agujeros.caja(x - 0.4, 31.2 + j * 2.54 - 0.4, 8.5, x + 0.4, 31.2 + j * 2.54 + 0.4, 8.58)
    puntos = {f"+{k}": (8 + k * 15, 3.2, 8.5) for k in range(10)}
    puntos.update({f"-{k}": (8 + k * 15, 5.7, 8.5) for k in range(10)})
    puntos.update({f"F{k}": (6 + k * 2.54, 15.3, 8.5) for k in range(60)})    # filas de componentes
    return _ubicar([cuerpo, rojo, azul, canal, agujeros], puntos, rot, mover)


# Módulo relé 1 canal 5 V con optoacoplador: 50 x 26 mm
def modulo_rele(rot, mover, nombre="Relé", grupo="electronica"):
    z = 3.0
    pcb = Malla(f"{nombre} (placa)", "#151816", grupo=grupo).caja(0, 0, z, 50, 26, z + 1.6)
    zt = z + 1.6
    azul = Malla(f"{nombre} (relé y borne)", "#1F62C4", grupo=grupo)
    azul.caja(16, 5.2, zt, 35, 20.7, zt + 15.3)                   # relé SRD-05VDC
    azul.caja(41, 3.5, zt, 49, 22.5, zt + 10)                     # bornera de 3 tornillos
    tornillos = Malla(f"{nombre} (tornillos)", PLATA, grupo=grupo)
    for y in (6.5, 13, 19.5):
        tornillos.cilindro((45, y, zt + 10), (45, y, zt + 10.6), 2, 10)
    negro = Malla(f"{nombre} (componentes)", NEGRO, grupo=grupo)
    negro.caja(0.8, 8.4, zt, 3.4, 16.1, zt + 2.5)                 # base del conector IN/VCC/GND
    negro.caja(6, 3.5, zt, 11, 7.5, zt + 3)                       # optoacoplador
    negro.caja(0.8, 18.5, zt, 3.4, 23.6, zt + 2.5)                # jumper JD-VCC
    oro = Malla(f"{nombre} (pines)", DORADO, grupo=grupo)
    for y in (9.7, 12.25, 14.8):
        oro.caja(1.8, y - 0.32, zt + 2.5, 2.4, y + 0.32, zt + 8.5)
    led = Malla(f"{nombre} (LED)", "#E8473F", grupo=grupo).caja(10, 20, zt, 12, 22, zt + 0.8)
    puntos = {"IN": (2.1, 14.8, zt + 8.5), "VCC": (2.1, 9.7, zt + 8.5), "GND": (2.1, 12.25, zt + 8.5),
              "COM": (45, 13, zt + 10.6), "NO": (45, 6.5, zt + 10.6)}
    return _ubicar([pcb, azul, tornillos, negro, oro, led], puntos, rot, mover)


# Módulo de humedad HR202 con relé (50 x 27 mm). Se monta de canto en la pared.
# Construido de frente en el plano y-z, mirando hacia -x
def modulo_humedad(x_pared, y0, z0, grupo="interior"):
    xp = x_pared - 6                                              # separadores de 6 mm
    pcb = Malla("Módulo HR202 (placa)", "#1E5FA0", grupo=grupo).caja(xp - 1.6, y0, z0, xp, y0 + 50, z0 + 27)
    xs = xp - 1.6
    azul = Malla("Módulo HR202 (relé y potenciómetro)", "#1F62C4", grupo=grupo)
    azul.caja(xs - 15.3, y0 + 15, z0 + 5.5, xs, y0 + 34, z0 + 21)
    azul.caja(xs - 10, y0 + 37, z0 + 14, xs, y0 + 46.5, z0 + 23.5)
    azul.caja(xs - 10, y0 + 1, z0 + 4, xs, y0 + 9, z0 + 23)        # bornera
    sensor = Malla("Sensor HR202", "#F1ECDD", grupo=grupo).caja(xs - 2, y0 + 50, z0 + 8, xs, y0 + 60, z0 + 18)
    negro = Malla("Módulo HR202 (componentes)", NEGRO, grupo=grupo)
    negro.caja(xs - 2, y0 + 38, z0 + 4, xs, y0 + 43, z0 + 9)       # LM393
    negro.caja(xs - 2.5, y0 + 44, z0 + 2, xs, y0 + 49, z0 + 5)     # conector VCC/GND
    leds = [Malla("Módulo HR202 (LED rojo)", "#E8473F", grupo=grupo).cilindro((xs, y0 + 47, z0 + 12), (xs - 5, y0 + 47, z0 + 12), 1.5, 10),
            Malla("Módulo HR202 (LED verde)", "#51C27A", grupo=grupo).cilindro((xs, y0 + 47, z0 + 20), (xs - 5, y0 + 47, z0 + 20), 1.5, 10)]
    soportes = Malla("Módulo HR202 (separadores)", "#B8BEC2", grupo=grupo)
    for y, zz in ((y0 + 3, z0 + 3), (y0 + 47, z0 + 24)):
        soportes.cilindro((xp, y, zz), (x_pared, y, zz), 1.8, 8)
    puntos = {"VCC": (xs - 2.5, y0 + 45.5, z0 + 3.5), "GND": (xs - 2.5, y0 + 47.5, z0 + 3.5),
              "COM": (xs - 10, y0 + 5, z0 + 13), "NO": (xs - 10, y0 + 2.5, z0 + 13)}
    return [pcb, azul, sensor, negro, soportes] + leds, puntos


# Mini bomba sumergible 3-6 V: Ø24 x 45 mm, 33 mm de alto, salida Ø7.5
# (eje a lo largo de x, entrada en x = 0)
def bomba(x0, y, z_fondo, grupo="tanque"):
    blanco = "#EEEAE0"
    zc = z_fondo + 3 + 12
    cuerpo = Malla("Bomba sumergible", blanco, grupo=grupo)
    cuerpo.cilindro((x0 + 4, y, zc), (x0 + 45, y, zc), 12, 28)
    cuerpo.cilindro((x0, y, zc), (x0 + 4, y, zc), 10.5, 28)        # tapa con la entrada
    cuerpo.caja(x0 + 6, y - 11, z_fondo, x0 + 42, y + 11, z_fondo + 3)   # patas / base
    cuerpo.cilindro((x0 + 9, y, zc + 10), (x0 + 9, y, zc + 21), 3.75, 16)  # salida Ø7.5
    entrada = Malla("Bomba (entrada)", "#6F6A60", grupo=grupo).cilindro((x0 - 0.3, y, zc), (x0 + 0.2, y, zc), 3.2, 16)
    puntos = {"salida": (x0 + 9, y, zc + 21), "cables": (x0 + 45, y, zc + 4)}
    return [cuerpo, entrada], puntos


# Ventilador 40 x 40 x 10 mm (eje a lo largo de x, en el plano y-z)
def ventilador(x_cara, yc, zc, grupo="interior"):
    marco = Malla("Ventilador 40x40 (marco)", "#222624", grupo=grupo)
    x0, x1 = x_cara - 10, x_cara
    for (ya, za, yb, zb) in ((-20, -20, 20, -17), (-20, 17, 20, 20), (-20, -17, -17, 17), (17, -17, 20, 17)):
        marco.caja(x0, yc + ya, zc + za, x1, yc + yb, zc + zb)
    for sy in (-1, 1):
        for sz in (-1, 1):
            marco.caja(x0, yc + sy * 20 - (sy > 0) * 6, zc + sz * 20 - (sz > 0) * 6, x1, yc + sy * 20 + (sy < 0) * 6, zc + sz * 20 + (sz < 0) * 6)
            marco.caja(x0, yc + sy * 14 - 2, zc - 1, x1, yc + sy * 14 + 2, zc + 1)   # brazos del soporte
    marco.cilindro((x0, yc, zc), (x1, yc, zc), 7.5, 20)
    aspas = Malla("Ventilador (aspas)", "#33393A", grupo=grupo)
    for k in range(7):
        a0 = 2 * math.pi * k / 7
        pts = []
        for r, da, dx in ((8, 0, 2), (17.5, 0.25, 7), (17.5, 0.75, 3), (8, 0.55, 8)):
            pts.append((x0 + dx, yc + r * math.cos(a0 + da), zc + r * math.sin(a0 + da)))
        aspas.quad(*pts)
    etiqueta = Malla("Ventilador (etiqueta)", "#2B6CC4", grupo=grupo).cilindro((x1, yc, zc), (x1 + 0.3, yc, zc), 7, 20)
    puntos = {"cables": (x0, yc + 18, zc - 12)}
    return [marco, aspas, etiqueta], puntos


# LCD 16x2 con módulo I2C (80 x 36 mm), detrás de la ventana del frente
# Construido mirando hacia -y; (u, v) en mm desde la esquina del panel
def lcd_i2c(x_panel, y_panel, z_panel, u_centro, v_centro, grupo="caja"):
    cx, cz = x_panel + u_centro, z_panel + v_centro
    bisel = Malla("LCD 16x2 (bisel)", "#151716", grupo=grupo).caja(cx - 35.6, y_panel - 0.5, cz - 12.1, cx + 35.6, y_panel + 6.5, cz + 12.1)
    pantalla = Malla("LCD 16x2 (pantalla)", "#A7D65A", grupo=grupo).caja(cx - 32.2, y_panel - 0.8, cz - 7.25, cx + 32.2, y_panel - 0.5, cz + 7.25)
    letras = Malla("LCD 16x2 (caracteres)", "#4D7A2A", grupo=grupo)
    for fila, texto in enumerate(("T:24.5C  HR:OK", "S:48% Agua:OK")):
        for i, ch in enumerate(texto):
            if ch != " ":
                x = cx - 30 + i * 3.75
                z = cz + 1.4 - fila * 6.2
                letras.caja(x, y_panel - 0.85, z - 2.6, x + 2.8, y_panel - 0.8, z + 2.6)
    pcb = Malla("LCD 16x2 (placa)", "#1E7A3A", grupo=grupo).caja(cx - 40, y_panel + 6.5, cz - 18, cx + 40, y_panel + 8.1, cz + 18)
    i2c = Malla("Módulo I2C PCF8574", "#1A1A1A", grupo=grupo).caja(cx - 21, y_panel + 8.1, cz - 17, cx + 21, y_panel + 12, cz + 2)
    pot = Malla("Módulo I2C (contraste)", "#1F62C4", grupo=grupo).caja(cx + 6, y_panel + 12, cz - 12, cx + 12, y_panel + 16, cz - 6)
    puntos = {k: (cx - 21, y_panel + 10, cz - 14 + i * 2.54) for i, k in enumerate(("GND", "VCC", "SDA", "SCL"))}
    return [bisel, pantalla, letras, pcb, i2c, pot], puntos


def led(x, y_panel, z, color, nombre, grupo="caja"):
    cuerpo = Malla(nombre, color, grupo=grupo)
    cuerpo.cilindro((x, y_panel + 3, z), (x, y_panel - 4, z), 2.5, 16)
    cuerpo.esfera((x, y_panel - 4, z), 2.5, n=8)
    cuerpo.cilindro((x, y_panel + 3, z), (x, y_panel + 4, z), 2.9, 16)
    patas = Malla(f"{nombre} (patas)", PLATA, grupo=grupo)
    for dx in (-1.27, 1.27):
        patas.cilindro((x + dx, y_panel + 4, z), (x + dx, y_panel + 14, z), 0.25, 6)
    return [cuerpo, patas], {"pata": (x, y_panel + 14, z)}


def pulsador(x, y_panel, z, grupo="caja"):
    cuerpo = Malla("Pulsador 12 mm", NEGRO, grupo=grupo).caja(x - 6, y_panel + 3, z - 6, x + 6, y_panel + 10, z + 6)
    tapa = Malla("Pulsador (botón)", "#D9DEE1", grupo=grupo).cilindro((x, y_panel + 3, z), (x, y_panel - 4, z), 5.5, 20)
    return [cuerpo, tapa], {"pata": (x, y_panel + 10, z - 4)}


# Zumbador piezoeléctrico activo 3-24 V, carcasa rectangular de ABS negro:
# cuerpo 30 x 20 x 13 mm sobre una pestaña de 44 x 10 x 2 mm con dos orejas
# (agujeros a 38 mm), rejilla de cuatro ranuras arriba y cables de 90 mm
# Se apoya plano sobre una superficie horizontal (rejilla hacia arriba)
def zumbador(xc, yc, z_apoyo, grupo="tapa"):
    z = z_apoyo
    cuerpo = Malla("Zumbador (carcasa)", NEGRO, grupo=grupo)
    cuerpo.caja_c(xc, yc, z, 44, 10, 2)                              # pestaña con las orejas
    cuerpo.caja_c(xc, yc, z, 30, 20, 13)                             # cuerpo
    ranuras = Malla("Zumbador (rejilla)", "#3A403D", grupo=grupo)
    for k in range(4):
        ranuras.caja(xc - 11, yc - 7.5 + k * 4.2, z + 13, xc + 11, yc - 5.5 + k * 4.2, z + 13.25)
    tornillos = Malla("Zumbador (tornillos M2)", PLATA, grupo=grupo)
    for dx in (-19, 19):
        tornillos.cilindro((xc + dx, yc, z + 2), (xc + dx, yc, z + 3.2), 2, 12)
    return [cuerpo, ranuras, tornillos], {"cables": (xc - 4, yc - 10, z + 3), "hueco": (xc - 4, yc - 14)}


def resistencia(a, b, nombre, bandas="#C9A646", grupo="electronica"):
    a, b = np.asarray(a, float), np.asarray(b, float)
    m = (a + b) / 2
    d = (b - a) / np.linalg.norm(b - a)
    cuerpo = Malla(nombre, "#D9C59A", grupo=grupo).cilindro(m - d * 3.2 + (0, 0, 3), m + d * 3.2 + (0, 0, 3), 1.15, 12)
    patas = Malla(f"{nombre} (patas)", PLATA, grupo=grupo)
    patas.tubo([a, a + (0, 0, 3), m - d * 3.2 + (0, 0, 3)], 0.3, 6, uniones=False)
    patas.tubo([m + d * 3.2 + (0, 0, 3), b + (0, 0, 3), b], 0.3, 6, uniones=False)
    banda = Malla(f"{nombre} (bandas)", bandas, grupo=grupo).cilindro(m - d * 1.5 + (0, 0, 3), m - d * 0.8 + (0, 0, 3), 1.2, 12)
    return [cuerpo, patas, banda]


# Sonda DS18B20 sumergible: punta de acero Ø6 x 50 mm
def ds18b20(x, y, z_punta, grupo="interior"):
    acero = Malla("DS18B20 (punta de acero)", "#C9D1D6", grupo=grupo).cilindro((x, y, z_punta), (x, y, z_punta + 50), 3, 18)
    funda = Malla("DS18B20 (termorretráctil)", NEGRO, grupo=grupo).cilindro((x, y, z_punta + 50), (x, y, z_punta + 65), 3.3, 18)
    return [acero, funda], {"cable": (x, y, z_punta + 65)}


