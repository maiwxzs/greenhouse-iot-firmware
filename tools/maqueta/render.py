"""Renderizador por software con z-buffer, sombreado, contornos y transparencias.

No necesita tarjeta gráfica ni programas externos: solo numpy y Pillow.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def _hex(c):
    return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float) / 255.0


def render(mallas, ojo, objetivo, ancho=1600, alto=1050, fov=32, ss=2, fondo="#F4F8F6", ortografica=None,
           ocultar=(), titulo=None, etiquetas=()):
    """Devuelve una imagen PIL.

    ojo, objetivo: posición de la cámara y punto al que mira (mm).
    ortografica: ancho visible en mm para una vista sin perspectiva (planos).
    ocultar: nombres de grupo que no se dibujan (por ejemplo la tapa de la caja).
    etiquetas: [(punto3d, texto)] que se dibujan con una línea guía.
    """
    W, H = ancho * ss, alto * ss
    ojo, objetivo = np.asarray(ojo, float), np.asarray(objetivo, float)
    f = objetivo - ojo; f /= np.linalg.norm(f)
    arriba = np.array([0, 0, 1.0]) if abs(f[2]) < 0.99 else np.array([0, 1.0, 0])
    s = np.cross(f, arriba); s /= np.linalg.norm(s)
    u = np.cross(s, f)
    focal = (H / 2) / math.tan(math.radians(fov) / 2)

    def proyectar(P):
        d = P - ojo
        xc, yc, zc = d @ s, d @ u, d @ f
        if ortografica:
            k = W / ortografica
            return W / 2 + xc * k, H / 2 - yc * k, zc
        return W / 2 + xc / zc * focal, H / 2 - yc / zc * focal, zc

    luz1 = np.array([-0.45, -0.6, 0.75]); luz1 /= np.linalg.norm(luz1)
    luz2 = np.array([0.6, 0.4, 0.3]); luz2 /= np.linalg.norm(luz2)

    zbuf = np.full((H, W), np.inf)
    img = np.ones((H, W, 3)) * _hex(fondo)
    nbuf = np.zeros((H, W, 3))
    transparentes = []

    for m in mallas:
        if m.grupo in ocultar or not m.tris:
            continue
        T = m.arreglo()
        base = _hex(m.color)
        n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
        ln = np.linalg.norm(n, axis=1, keepdims=True); ln[ln == 0] = 1
        n = n / ln
        # Normales hacia la cámara (dos caras)
        centro = T.mean(axis=1)
        hacia = (ojo - centro) if not ortografica else -f[None, :]
        n = np.where((np.sum(n * hacia, axis=1) < 0)[:, None], -n, n)
        luz = 0.42 + 0.5 * np.clip(n @ luz1, 0, 1) + 0.16 * np.clip(n @ luz2, 0, 1)
        cols = np.clip(base[None, :] * luz[:, None], 0, 1)
        X, Y, Z = proyectar(T.reshape(-1, 3))
        X, Y, Z = X.reshape(-1, 3), Y.reshape(-1, 3), Z.reshape(-1, 3)
        for i in range(len(T)):
            if np.any(Z[i] <= 1):
                continue
            item = (X[i], Y[i], Z[i], cols[i], n[i])
            if m.alfa < 1:
                transparentes.append((Z[i].mean(), item, m.alfa))
            else:
                _rasterizar(item, zbuf, img, nbuf, None)

    # Contornos: cambios bruscos de profundidad o de orientación
    profundo = np.where(np.isinf(zbuf), 1e9, zbuf)
    logz = np.log(profundo)
    borde = np.zeros((H, W), bool)
    for dy, dx in ((0, 1), (1, 0)):
        dz = np.abs(logz - np.roll(np.roll(logz, dy, 0), dx, 1)) > 0.012
        dn = np.sum(nbuf * np.roll(np.roll(nbuf, dy, 0), dx, 1), axis=2) < 0.8
        borde |= dz | (dn & ~np.isinf(zbuf))
    img[borde] *= 0.55

    for _, item, alfa in sorted(transparentes, key=lambda x: -x[0]):
        _rasterizar(item, zbuf, img, None, alfa)

    imagen = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((ancho, alto), Image.LANCZOS)
    if titulo or etiquetas:
        _anotar(imagen, titulo, [(proyectar(np.asarray(e[0], float)[None, :]), e[1], e[2] if len(e) > 2 else (34, -46))
                                  for e in etiquetas], ss)
    return imagen


def _rasterizar(item, zbuf, img, nbuf, alfa):
    xs, ys, zs, col, normal = item
    H, W = zbuf.shape
    x0, x1 = max(int(math.floor(xs.min())), 0), min(int(math.ceil(xs.max())), W - 1)
    y0, y1 = max(int(math.floor(ys.min())), 0), min(int(math.ceil(ys.max())), H - 1)
    if x0 > x1 or y0 > y1:
        return
    px, py = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    (ax, bx, cx), (ay, by, cy) = xs, ys
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9:
        return
    w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
    w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
    w2 = 1 - w0 - w1
    dentro = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
    if not dentro.any():
        return
    iz = w0 / zs[0] + w1 / zs[1] + w2 / zs[2]           # interpolación correcta en perspectiva
    z = 1 / np.where(iz == 0, 1e-9, iz)
    zona = zbuf[y0:y1 + 1, x0:x1 + 1]
    visible = dentro & (z < zona - 1e-3)
    if not visible.any():
        return
    bloque = img[y0:y1 + 1, x0:x1 + 1]
    if alfa is None:
        zona[visible] = z[visible]
        bloque[visible] = col
        nbuf[y0:y1 + 1, x0:x1 + 1][visible] = normal
    else:
        bloque[visible] = bloque[visible] * (1 - alfa) + col * alfa


def _fuente(tam):
    for nombre in ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(nombre, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def _anotar(imagen, titulo, etiquetas, ss):
    d = ImageDraw.Draw(imagen)
    if titulo:
        d.text((28, 22), titulo, fill=(30, 45, 36), font=_fuente(30))
    f = _fuente(19)
    for ((x, y, _), texto, (dx, dy)) in etiquetas:
        x, y = float(x[0]) / ss, float(y[0]) / ss
        w = d.textlength(texto, font=f)
        tx, ty = x + dx, y + dy
        if dx < 0:
            tx -= w
        d.line([(x, y), (tx - 4, ty + 12)], fill=(30, 45, 36), width=2)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(30, 45, 36))
        d.rounded_rectangle([tx - 6, ty, tx + w + 8, ty + 26], radius=6, fill=(255, 255, 255), outline=(30, 45, 36), width=2)
        d.text((tx + 1, ty + 2), texto, fill=(30, 45, 36), font=f)
