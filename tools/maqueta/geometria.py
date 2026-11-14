"""Primitivas 3D (mallas de triángulos) y exportación a STL y OBJ."""
import math
import struct

import numpy as np


class Malla:
    """Conjunto de triángulos con nombre, grupo, color y transparencia."""

    def __init__(self, nombre, color, alfa=1.0, grupo="general"):
        self.nombre, self.color, self.alfa, self.grupo = nombre, color, alfa, grupo
        self.tris = []

    # ---------------------------- básicos ----------------------------
    def tri(self, a, b, c):
        self.tris.append((np.asarray(a, float), np.asarray(b, float), np.asarray(c, float)))
        return self

    def quad(self, a, b, c, d):
        return self.tri(a, b, c).tri(a, c, d)

    def caja(self, x0, y0, z0, x1, y1, z1):
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        for i in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
            self.quad(*[p[j] for j in i])
        return self

    def caja_c(self, cx, cy, z0, dx, dy, dz):
        """Caja centrada en (cx, cy) apoyada en z0."""
        return self.caja(cx - dx / 2, cy - dy / 2, z0, cx + dx / 2, cy + dy / 2, z0 + dz)

    def cilindro(self, a, b, r, n=24, r2=None, tapas=True):
        """Cilindro (o tronco de cono si r2) entre los puntos a y b."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        r2 = r if r2 is None else r2
        eje = b - a
        largo = np.linalg.norm(eje)
        if largo == 0:
            return self
        eje /= largo
        aux = np.array([1.0, 0, 0]) if abs(eje[0]) < 0.9 else np.array([0, 1.0, 0])
        u = np.cross(eje, aux); u /= np.linalg.norm(u)
        v = np.cross(eje, u)
        ang = [2 * math.pi * k / n for k in range(n)]
        aro_a = [a + r * (math.cos(t) * u + math.sin(t) * v) for t in ang]
        aro_b = [b + r2 * (math.cos(t) * u + math.sin(t) * v) for t in ang]
        for k in range(n):
            j = (k + 1) % n
            self.quad(aro_a[k], aro_a[j], aro_b[j], aro_b[k])
            if tapas:
                if r > 0: self.tri(a, aro_a[j], aro_a[k])
                if r2 > 0: self.tri(b, aro_b[k], aro_b[j])
        return self

    def esfera(self, c, r, n=12, escala=(1, 1, 1)):
        c = np.asarray(c, float)
        sx, sy, sz = escala
        pts = [[c + r * np.array([sx * math.sin(math.pi * i / n) * math.cos(2 * math.pi * j / (2 * n)),
                                  sy * math.sin(math.pi * i / n) * math.sin(2 * math.pi * j / (2 * n)),
                                  sz * math.cos(math.pi * i / n)]) for j in range(2 * n)] for i in range(n + 1)]
        for i in range(n):
            for j in range(2 * n):
                k = (j + 1) % (2 * n)
                self.quad(pts[i][j], pts[i][k], pts[i + 1][k], pts[i + 1][j])
        return self

    def placa(self, puntos, grosor, normal):
        """Polígono convexo con espesor."""
        n = np.asarray(normal, float) * grosor
        base = [np.asarray(p, float) for p in puntos]
        tapa = [p + n for p in base]
        for i in range(1, len(base) - 1):
            self.tri(base[0], base[i + 1], base[i])
            self.tri(tapa[0], tapa[i], tapa[i + 1])
        for i in range(len(base)):
            j = (i + 1) % len(base)
            self.quad(base[i], base[j], tapa[j], tapa[i])
        return self

    def tubo(self, puntos, r, n=10, uniones=True):
        """Tubo que sigue una polilínea (cables, mangueras)."""
        for a, b in zip(puntos, puntos[1:]):
            self.cilindro(a, b, r, n, tapas=False)
        if uniones:
            for p in puntos[1:-1]:
                self.esfera(p, r, n=4)
        return self

    def viga(self, a, b, ancho, alto, arriba=(0, 0, 1)):
        """Prisma rectangular a lo largo del segmento a-b (listones inclinados)."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        eje = b - a; eje /= np.linalg.norm(eje)
        up = np.asarray(arriba, float)
        lado = np.cross(eje, up); lado /= np.linalg.norm(lado)
        up = np.cross(lado, eje)
        w, h = lado * ancho / 2, up * alto / 2
        esq = lambda p: [p - w - h, p + w - h, p + w + h, p - w + h]
        A, B = esq(a), esq(b)
        for i in range(4):
            j = (i + 1) % 4
            self.quad(A[i], A[j], B[j], B[i])
        self.quad(A[3], A[2], A[1], A[0])
        self.quad(B[0], B[1], B[2], B[3])
        return self

    def transformar(self, rot_z_grados=0, mover=(0, 0, 0), centro=(0, 0, 0)):
        """Rota alrededor de z (en torno a 'centro') y desplaza."""
        t = math.radians(rot_z_grados)
        R = np.array([[math.cos(t), -math.sin(t), 0], [math.sin(t), math.cos(t), 0], [0, 0, 1]])
        c, m = np.asarray(centro, float), np.asarray(mover, float)
        self.tris = [tuple(R @ (p - c) + c + m for p in t3) for t3 in self.tris]
        return self

    def arreglo(self):
        return np.array([[p for p in t] for t in self.tris], float).reshape(-1, 3, 3) if self.tris else np.zeros((0, 3, 3))


def pared_con_huecos(ancho, alto, huecos):
    """Divide un rectángulo (0..ancho, 0..alto) en celdas que no tocan los huecos.
    huecos: [(u0, v0, u1, v1)]. Devuelve [(u0, v0, u1, v1)] de material."""
    us = sorted({0, ancho, *[h[0] for h in huecos], *[h[2] for h in huecos]})
    vs = sorted({0, alto, *[h[1] for h in huecos], *[h[3] for h in huecos]})
    celdas = []
    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            cu, cv = (us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2
            if not any(h[0] < cu < h[2] and h[1] < cv < h[3] for h in huecos):
                celdas.append((us[i], vs[j], us[i + 1], vs[j + 1]))
    return celdas


def curva_cable(a, b, alto=12, pasos=10):
    """Cable Dupont: sube desde a, hace un arco y baja hasta b."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    pts = []
    for i in range(pasos + 1):
        s = i / pasos
        p = a + (b - a) * s
        p[2] = a[2] + (b[2] - a[2]) * s + alto * math.sin(math.pi * s) + max(0, 4 * (1 - abs(2 * s - 1)))
        pts.append(p)
    return pts


# ------------------------------- Exportación -------------------------------
def guardar_stl(ruta, mallas):
    tris = [t for m in mallas for t in m.tris]
    with open(ruta, "wb") as f:
        f.write(b"Invernadero IoT - maqueta (mm)".ljust(80, b" "))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            n = np.cross(b - a, c - a)
            l = np.linalg.norm(n)
            n = n / l if l else n
            f.write(struct.pack("<12fH", *n, *a, *b, *c, 0))
    return len(tris)


def guardar_obj(ruta_obj, mallas):
    """OBJ con materiales (colores): se ve en color en visores 3D y Blender."""
    ruta_mtl = ruta_obj.with_suffix(".mtl")
    materiales = {}
    with open(ruta_mtl, "w", encoding="utf-8") as fm:
        for m in mallas:
            clave = f"{m.color}_{int(m.alfa * 100)}"
            if clave in materiales:
                continue
            nombre = f"mat_{len(materiales)}"
            materiales[clave] = nombre
            r, g, b = (int(m.color[i:i + 2], 16) / 255 for i in (1, 3, 5))
            fm.write(f"newmtl {nombre}\nKd {r:.3f} {g:.3f} {b:.3f}\nKa 0.1 0.1 0.1\nd {m.alfa:.2f}\nillum 1\n\n")
    with open(ruta_obj, "w", encoding="utf-8") as fo:
        fo.write(f"# Invernadero IoT - maqueta (unidades: mm)\nmtllib {ruta_mtl.name}\n")
        base = 1
        for m in mallas:
            if not m.tris:
                continue
            fo.write(f"o {m.nombre.replace(' ', '_')}\nusemtl {materiales[f'{m.color}_{int(m.alfa * 100)}']}\n")
            for t in m.tris:
                for p in t:
                    fo.write(f"v {p[0]:.2f} {p[1]:.2f} {p[2]:.2f}\n")
            for i in range(len(m.tris)):
                k = base + 3 * i
                fo.write(f"f {k} {k + 1} {k + 2}\n")
            base += 3 * len(m.tris)
