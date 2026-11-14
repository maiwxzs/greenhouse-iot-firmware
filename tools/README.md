# Herramientas

Scripts que generan los archivos de diseño del repositorio. Si cambias pines, medidas o diagramas, vuelve a ejecutarlos y sube los archivos generados junto con el cambio.

Se ejecutan desde la raíz del repositorio:

| Script | Genera | Necesita |
|---|---|---|
| `python3 tools/generar_esquema.py` | `hardware/circuits/esquema-conexiones.svg` | Solo Python 3 |
| `python3 tools/generar_maqueta.py` | Modelos STL, renders PNG y planos de corte de la maqueta | Python 3 con `numpy` y `matplotlib` |
| `python3 tools/generar_diagramas.py` | SVG, PNG y draw.io de cada `docs/diagramas/*.mmd` | Node.js con `@mermaid-js/mermaid-cli`, Python con `playwright` y Google Chrome |

Para instalar lo que necesitan:

```bash
pip install numpy matplotlib playwright
npm install -g @mermaid-js/mermaid-cli
```

Si Chrome no está en `/usr/bin/google-chrome`, indica la ruta, por ejemplo en Windows:

```bash
python tools/generar_diagramas.py --chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"
```
