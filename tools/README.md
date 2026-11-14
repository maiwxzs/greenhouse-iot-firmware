# Herramientas

Generadores de los archivos de diseño del repositorio. Se ejecutan desde la raíz; cuando cambian pines, medidas o diagramas, los archivos generados se suben junto con el cambio.

| Script | Genera | Requisitos |
|---|---|---|
| `python3 tools/generar_diagramas.py` | `docs/diagramas/*.svg`, `*.png` y `*.drawio` | Node.js con `@mermaid-js/mermaid-cli`, Python con `playwright`, Google Chrome |
| `python3 tools/generar_esquema.py` | `hardware/circuits/esquema-conexiones.svg` | Python 3 |
| `python3 tools/generar_maqueta.py` | Modelos 3D, renders, planos de corte y distribución de la maqueta | Python 3 con `numpy` y `Pillow` |

```bash
pip install numpy pillow playwright
npm install -g @mermaid-js/mermaid-cli
```

Si Chrome no está en `/usr/bin/google-chrome`, se indica su ruta:

```bash
python tools/generar_diagramas.py --chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

## Diagramas

Las definiciones están en el diccionario `DIAGRAMAS` del script, con una paleta común (`PALETA`) y la configuración de Mermaid (`CONFIG_MERMAID`: tema, diseño ELK y aspecto neo). El script renderiza cada diagrama a SVG y PNG con `mmdc`. Después mide en Chrome la posición de cada caja y cada flecha, y escribe un `.drawio` con figuras nativas en esas posiciones.

## Maqueta

| Archivo | Contenido |
|---|---|
| `generar_maqueta.py` | Dimensiones, huecos, ubicación de cada componente, cableado, vistas y planos |
| `maqueta/geometria.py` | Mallas de triángulos: cajas, cilindros, esferas, placas, tubos y vigas; paneles con huecos; exportación a STL y OBJ |
| `maqueta/componentes.py` | Componentes con su forma y medidas reales: Arduino Uno, protoboard, módulos relé, módulo HR202, bomba, ventilador, LCD, LEDs, pulsador, zumbador, resistencias y DS18B20 |
| `maqueta/render.py` | Renderizador por software con z-buffer, iluminación, bordes, transparencias y etiquetas |

Las medidas están en milímetros. `--sin-renders` regenera solo los modelos y los planos.

## Aplicación

La aplicación se construye desde `app/` con `npm install` y `npm run build` ([detalles](../app/README.md)).
