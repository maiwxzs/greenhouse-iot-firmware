#!/usr/bin/env python3
"""Convierte los diagramas Mermaid de docs/diagramas/*.mmd en:

  *.svg     imagen vectorial (para ver o insertar en documentos)
  *.png     imagen para presentaciones
  *.drawio  archivo de draw.io con figuras nativas editables. Igual que al insertar un
            diagrama con Arrange > Insert > Advanced > Mermaid: el código Mermaid queda guardado
            en el grupo, así que en draw.io se puede volver a editar como Mermaid.

Requisitos: Node.js con @mermaid-js/mermaid-cli (comando mmdc), Python con playwright y Chrome.
Uso:  python3 tools/generar_diagramas.py [--chrome /ruta/a/chrome]
"""
import argparse
import base64
import html
import json
import re
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
DIR = RAIZ / "docs" / "diagramas"

CONFIG_MERMAID = {
    "theme": "base",
    "themeVariables": {
        "primaryColor": "#E8F3EC", "primaryBorderColor": "#2E7A4C", "primaryTextColor": "#1E2D24",
        "lineColor": "#4D5F54", "secondaryColor": "#E3F0FA", "tertiaryColor": "#F8FBF9",
        "clusterBkg": "#F8FBF9", "clusterBorder": "#9DB5A8",
        "fontFamily": "Segoe UI, Roboto, Arial, sans-serif", "fontSize": "15px",
        "noteBkgColor": "#FFF3E0", "noteBorderColor": "#B9790A", "actorBkg": "#E8F3EC", "actorBorder": "#2E7A4C",
    },
    "flowchart": {"htmlLabels": True, "curve": "basis"},
}
FUENTE = "fontFamily=Segoe UI;fontSize=14;fontColor=#1E2D24;"
RELLENO, BORDE = "#E8F3EC", "#2E7A4C"

# Medir cajas y líneas en el navegador (las coordenadas ya incluyen todas las transformaciones)
JS_MEDIR = r"""
() => {
  const svg = document.querySelector('svg');
  const o = svg.getBoundingClientRect();
  const caja = (el) => { const r = el.getBoundingClientRect(); return {x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height}; };
  const res = {ancho: o.width, alto: o.height, clusters: {}, nodos: {}, aristas: []};
  svg.querySelectorAll('g.cluster').forEach(g => {
    const r = g.querySelector(':scope > rect'); if (r) res.clusters[g.id] = caja(r);
  });
  svg.querySelectorAll('g.node').forEach(g => {
    const forma = g.querySelector(':scope > .label-container, :scope > rect, :scope > polygon, :scope > path, :scope > g.label-container, :scope > g.basic');
    res.nodos[g.id] = caja(forma || g);
  });
  svg.querySelectorAll('path[data-id]').forEach(p => {
    let pts = [];
    try { pts = JSON.parse(atob(p.getAttribute('data-points') || '')); } catch (e) {}
    const m = p.getScreenCTM(), mo = svg.getScreenCTM();
    const pt = svg.createSVGPoint();
    const abs = pts.map(q => { pt.x = q.x; pt.y = q.y; const s = pt.matrixTransform(m); return {x: s.x - o.left, y: s.y - o.top}; });
    res.aristas.push({id: p.getAttribute('data-id'), puntos: abs, clase: p.getAttribute('class') || ''});
  });
  return res;
}
"""


def renderizar(mmd: Path, chrome: str):
    with tempfile.TemporaryDirectory() as tmp:
        cfg = Path(tmp) / "c.json"; cfg.write_text(json.dumps(CONFIG_MERMAID))
        pup = Path(tmp) / "p.json"; pup.write_text(json.dumps({"executablePath": chrome, "args": ["--no-sandbox"]}))
        for ext, extra in (("svg", []), ("png", ["-s", "2"])):
            subprocess.run(["mmdc", "-q", "-p", str(pup), "-c", str(cfg), "-b", "#FFFFFF", "-i", str(mmd),
                            "-o", str(mmd.with_suffix("." + ext)), *extra], check=True)


def medir(svg_path: Path, navegador):
    pagina = navegador.new_page()
    pagina.set_content(f"<html><body style='margin:0'>{svg_path.read_text(encoding='utf-8')}</body></html>")
    pagina.evaluate("() => { const s = document.querySelector('svg'); const vb = s.viewBox.baseVal;"
                    " s.removeAttribute('style'); s.setAttribute('width', vb.width); s.setAttribute('height', vb.height); }")
    datos = pagina.evaluate(JS_MEDIR)
    pagina.close()
    return datos


# --------------------------- Lectura del .mmd ---------------------------
def estilos_classdef(texto):
    defs = {}
    for nombre, cuerpo in re.findall(r"^\s*classDef\s+(\w+)\s+(.+)$", texto, re.M):
        props = dict(p.split(":", 1) for p in cuerpo.split(",") if ":" in p)
        defs[nombre] = props
    asignados = {}
    for ids, nombre in re.findall(r"^\s*class\s+([\w,]+)\s+(\w+)\s*$", texto, re.M):
        for i in ids.split(","):
            asignados[i] = defs.get(nombre, {})
    return asignados


def limpiar(etiqueta):
    return etiqueta.replace("<br/>", "<br>").strip()


def nodos_flowchart(texto):
    nodos, clusters = {}, {}
    for cid, et in re.findall(r'^\s*subgraph\s+(\w+)\["([^"]*)"\]', texto, re.M):
        clusters[cid] = limpiar(et)
    patron = r'(\w+)\s*(\(\[|\[\(|\{|\[|\()"([^"]*)"(\]\)|\)\]|\}|\]|\))'
    for nid, abre, et, _ in re.findall(patron, texto):
        if nid in clusters or nid in ("subgraph",):
            continue
        forma = {"([": "estadio", "[(": "cilindro", "{": "rombo", "[": "rect", "(": "redondeado"}[abre]
        nodos.setdefault(nid, (forma, limpiar(et)))
    return nodos, clusters


def miembros_clases(texto):
    clases = {}
    for nombre, cuerpo in re.findall(r"^\s*class\s+(\w+)\s*\{(.*?)^\s*\}", texto, re.M | re.S):
        lineas = [l.strip() for l in cuerpo.strip().splitlines() if l.strip()]
        estereotipo = next((l for l in lineas if l.startswith("<<")), None)
        lineas = [l for l in lineas if not l.startswith("<<")]
        atributos = [l for l in lineas if "(" not in l]
        metodos = [l for l in lineas if "(" in l]
        clases[nombre] = (estereotipo, atributos, metodos)
    for nombre in re.findall(r"^\s*class\s+(\w+)\s*$", texto, re.M):
        clases.setdefault(nombre, (None, [], []))
    return clases


RELACIONES = {
    "<|--": "startArrow=block;startFill=0;startSize=12;endArrow=none;",
    "*--": "startArrow=diamondThin;startFill=1;startSize=16;endArrow=none;",
    "o--": "startArrow=diamondThin;startFill=0;startSize=16;endArrow=none;",
    "-->": "startArrow=none;endArrow=open;endSize=10;",
    "..>": "startArrow=none;endArrow=open;endSize=10;dashed=1;",
    "--": "startArrow=none;endArrow=none;",
    "..": "startArrow=none;endArrow=none;dashed=1;",
}


def relaciones_clases(texto):
    patron = r'^\s*(\w+)\s+(?:"([^"]*)"\s+)?(<\|--|\*--|o--|-->|\.\.>|--|\.\.)\s+(?:"([^"]*)"\s+)?(\w+)\s*(?::\s*(.*))?$'
    return re.findall(patron, texto, re.M)


# ----------------------------- draw.io -----------------------------
class Dibujo:
    def __init__(self, nombre, mermaid):
        self.celdas = []
        self.n = 1
        self.grupo = self.nuevo_id()
        self.mermaid = mermaid
        self.nombre = nombre

    def nuevo_id(self):
        self.n += 1
        return f"mmd-{self.n}"

    def vertice(self, mid, etiqueta, estilo, g, padre=None):
        cid = self.nuevo_id()
        self.celdas.append(
            f'<UserObject label="{html.escape(etiqueta, quote=True)}" mermaidId="{html.escape(mid)}" id="{cid}">'
            f'<mxCell parent="{padre or self.grupo}" style="{estilo}" vertex="1">'
            f'<mxGeometry x="{g["x"]:.1f}" y="{g["y"]:.1f}" width="{g["w"]:.1f}" height="{g["h"]:.1f}" as="geometry"/></mxCell></UserObject>')
        return cid

    def arista(self, mid, origen, destino, etiqueta, estilo, puntos):
        cid = self.nuevo_id()
        pts = "".join(f'<mxPoint x="{p["x"]:.1f}" y="{p["y"]:.1f}"/>' for p in puntos)
        geo = f'<mxGeometry relative="1" as="geometry">{"<Array as=" + chr(34) + "points" + chr(34) + ">" + pts + "</Array>" if pts else ""}</mxGeometry>'
        self.celdas.append(
            f'<UserObject label="{html.escape(etiqueta, quote=True)}" mermaidId="{html.escape(mid)}" id="{cid}">'
            f'<mxCell edge="1" parent="{self.grupo}" source="{origen}" target="{destino}" style="{estilo}">{geo}</mxCell></UserObject>')

    def imagen(self, svg_bytes, ancho, alto):
        datos = base64.b64encode(svg_bytes).decode()
        self.celdas.append(
            f'<mxCell id="{self.nuevo_id()}" parent="{self.grupo}" vertex="1" '
            f'style="shape=image;noLabel=1;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/svg+xml,{datos};">'
            f'<mxGeometry width="{ancho:.1f}" height="{alto:.1f}" as="geometry"/></mxCell>')

    def xml(self, ancho, alto):
        md = html.escape(json.dumps({"data": self.mermaid, "config": None}, ensure_ascii=False, indent=2), quote=True)
        md = md.replace("\n", "&#xa;")
        grupo = (f'<UserObject label="" mermaidData="{md}" id="{self.grupo}">'
                 f'<mxCell connectable="0" parent="1" vertex="1" style="group;transparentBounds=1;editIcon=1;lockedGroup=0;groupPadding=10;">'
                 f'<mxGeometry x="20" y="20" width="{ancho:.1f}" height="{alto:.1f}" as="geometry"/></mxCell></UserObject>')
        return ('<mxfile host="app.diagrams.net">\n'
                f'  <diagram name="{html.escape(self.nombre)}" id="{self.nombre}">\n'
                f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
                f'fold="1" page="1" pageScale="1" pageWidth="{max(827, int(ancho) + 60)}" pageHeight="{max(1169, int(alto) + 60)}" math="0" shadow="0">\n'
                '      <root>\n        <mxCell id="0" />\n        <mxCell id="1" parent="0" />\n        '
                + grupo + "\n        " + "\n        ".join(self.celdas) +
                '\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n')


def estilo_nodo(forma, props):
    relleno = props.get("fill", RELLENO); borde = props.get("stroke", BORDE)
    base = f"html=1;whiteSpace=wrap;strokeWidth=1.5;fillColor={relleno};strokeColor={borde};{FUENTE}"
    return {
        "rect": "rounded=0;" + base,
        "redondeado": "rounded=1;" + base,
        "estadio": "rounded=1;arcSize=50;" + base,
        "rombo": "rhombus;" + base,
        "cilindro": "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=8;" + base,
    }[forma]


def flowchart_a_drawio(mmd_texto, medidas, nombre):
    d = Dibujo(nombre, mmd_texto)
    nodos, clusters = nodos_flowchart(mmd_texto)
    estilos = estilos_classdef(mmd_texto)
    ids = {}
    for cid, et in clusters.items():
        g = next((v for k, v in medidas["clusters"].items() if k.endswith("-" + cid) or k == cid), None)
        if g:
            ids[cid] = d.vertice(f"n:{cid}", et, "html=1;whiteSpace=wrap;verticalAlign=top;fillColor=#F8FBF9;"
                                 f"strokeColor=#9DB5A8;strokeWidth=1.5;rounded=1;arcSize=4;fontStyle=1;{FUENTE}", g)
    for nid, (forma, et) in nodos.items():
        g = next((v for k, v in medidas["nodos"].items() if re.search(rf"flowchart-{nid}-\d+$", k)), None)
        if g:
            ids[nid] = d.vertice(f"n:{nid}", et, estilo_nodo(forma, estilos.get(nid, {})), g)
    etiquetas = {}
    for o, flecha, et, t in re.findall(r'(\w+)\s*(-->|<-->|-\.->|---)\s*(?:\|"?([^|"]*)"?\|\s*)?(\w+)', mmd_texto):
        etiquetas.setdefault((o, t), []).append((flecha, et))
    vistos = {}
    for a in medidas["aristas"]:
        m = re.match(r"L_(\w+?)_(\w+?)_(\d+)$", a["id"])
        if not m:
            continue
        o, t = m.group(1), m.group(2)
        if o not in ids or t not in ids:
            continue
        k = vistos.get((o, t), 0); vistos[(o, t)] = k + 1
        flecha, et = (etiquetas.get((o, t)) or [("-->", "")])[min(k, len(etiquetas.get((o, t), [None])) - 1)]
        estilo = f"curved=1;html=1;strokeColor=#4D5F54;strokeWidth=1.5;endArrow=block;endSize=7;{FUENTE}fontSize=12;labelBackgroundColor=#FFFFFF;"
        if flecha == "<-->":
            estilo += "startArrow=block;startSize=7;"
        if flecha == "-.->" or "dotted" in a["clase"] or "dashed" in a["clase"]:
            estilo += "dashed=1;"
        d.arista(f"e:{o}->{t}#{k}", ids[o], ids[t], limpiar(et or ""), estilo, a["puntos"][1:-1])
    return d.xml(medidas["ancho"], medidas["alto"])


def clases_a_drawio(mmd_texto, medidas, nombre):
    d = Dibujo(nombre, mmd_texto)
    ids = {}
    for nombre_clase, (estereo, atributos, metodos) in miembros_clases(mmd_texto).items():
        g = next((v for k, v in medidas["nodos"].items() if re.search(rf"classId-{nombre_clase}-\d+$", k)), None)
        if not g:
            continue
        titulo = (f"<i>«{html.escape(estereo.strip('<>'))}»</i><br>" if estereo else "") + f"<b>{nombre_clase}</b>"
        bloque = lambda filas: "<br>".join(html.escape(f) for f in filas) or "&nbsp;"
        etiqueta = (f'<p style="margin:0;margin-top:4px;text-align:center;">{titulo}</p><hr size="1">'
                    f'<p style="margin:0 6px;">{bloque(atributos)}</p><hr size="1">'
                    f'<p style="margin:0 6px;">{bloque(metodos)}</p>')
        estilo = (f"verticalAlign=top;align=left;overflow=fill;html=1;whiteSpace=wrap;rounded=0;"
                  f"fillColor={'#F3F7F5' if estereo else RELLENO};strokeColor={BORDE};strokeWidth=1.5;"
                  f"fontFamily=Segoe UI;fontSize=12;fontColor=#1E2D24;")
        ids[nombre_clase] = d.vertice(f"n:{nombre_clase}", etiqueta, estilo, g)
    rel = relaciones_clases(mmd_texto)
    puntos = {}
    for a in medidas["aristas"]:
        m = re.match(r"id_(\w+?)_(\w+?)_(\d+)$", a["id"])
        if m:
            puntos.setdefault((m.group(1), m.group(2)), a["puntos"])
    for i, (o, card_o, tipo, card_t, t, et) in enumerate(rel):
        if o not in ids or t not in ids:
            continue
        estilo = (f"curved=1;html=1;strokeColor=#4D5F54;strokeWidth=1.5;{RELACIONES[tipo]}"
                  f"fontFamily=Segoe UI;fontSize=11;fontColor=#1E2D24;labelBackgroundColor=#FFFFFF;")
        etiqueta = et.strip()
        if card_o or card_t:
            etiqueta = f"{card_o or ''} {etiqueta} {card_t or ''}".strip()
        d.arista(f"e:{o}->{t}#{i}", ids[o], ids[t], etiqueta, estilo, puntos.get((o, t), [])[1:-1])
    return d.xml(medidas["ancho"], medidas["alto"])


def imagen_a_drawio(mmd_texto, svg_path, medidas, nombre):
    d = Dibujo(nombre, mmd_texto)
    d.imagen(svg_path.read_bytes(), medidas["ancho"], medidas["alto"])
    return d.xml(medidas["ancho"], medidas["alto"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default="/usr/bin/google-chrome")
    args = ap.parse_args()
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=args.chrome, args=["--no-sandbox"])
        for mmd in sorted(DIR.glob("*.mmd")):
            renderizar(mmd, args.chrome)
            texto = mmd.read_text(encoding="utf-8")
            svg = mmd.with_suffix(".svg")
            medidas = medir(svg, navegador)
            tipo = texto.lstrip().split(None, 1)[0]
            if tipo in ("flowchart", "graph"):
                xml = flowchart_a_drawio(texto, medidas, mmd.stem)
            elif tipo == "classDiagram":
                xml = clases_a_drawio(texto, medidas, mmd.stem)
            else:
                xml = imagen_a_drawio(texto, svg, medidas, mmd.stem)
            mmd.with_suffix(".drawio").write_text(xml, encoding="utf-8")
            print(f"{mmd.name}: svg, png y drawio ({tipo})")
        navegador.close()


if __name__ == "__main__":
    main()
