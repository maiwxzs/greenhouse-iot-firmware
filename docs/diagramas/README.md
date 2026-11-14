# Diagramas

Cada diagrama tiene su fuente en Mermaid (`.mmd`) y tres versiones generadas a partir de ella:

| Diagrama | Fuente | Imagen | draw.io |
|---|---|---|---|
| Arquitectura del sistema | [mmd](arquitectura-sistema.mmd) | [svg](arquitectura-sistema.svg) · [png](arquitectura-sistema.png) | [drawio](arquitectura-sistema.drawio) |
| Bloques del firmware | [mmd](bloques-firmware.mmd) | [svg](bloques-firmware.svg) · [png](bloques-firmware.png) | [drawio](bloques-firmware.drawio) |
| Flujo de control | [mmd](flujo-control.mmd) | [svg](flujo-control.svg) · [png](flujo-control.png) | [drawio](flujo-control.drawio) |
| Diagrama de clases UML | [mmd](uml-clases.mmd) | [svg](uml-clases.svg) · [png](uml-clases.png) | [drawio](uml-clases.drawio) |
| Estados de humedad (histéresis) | [mmd](estados-humedad.mmd) | [svg](estados-humedad.svg) · [png](estados-humedad.png) | [drawio](estados-humedad.drawio) |
| Secuencia del dashboard | [mmd](secuencia-dashboard.mmd) | [svg](secuencia-dashboard.svg) · [png](secuencia-dashboard.png) | [drawio](secuencia-dashboard.drawio) |

El esquema eléctrico está en [`hardware/circuits/esquema-conexiones.svg`](../../hardware/circuits/esquema-conexiones.svg).

## Cómo editar un diagrama

**Opción A: en draw.io (como antes).** Abre el `.drawio` en [app.diagrams.net](https://app.diagrams.net) o en draw.io Desktop.
- Las cajas y flechas de arquitectura, bloques, flujo y UML son figuras normales, que se pueden mover y editar.
- El grupo guarda el código Mermaid: selecciónalo y usa el ícono de edición para cambiar el código y regenerar el diagrama.
- Los diagramas de estados y de secuencia se guardan como imagen, porque draw.io no los convierte a figuras.

**Opción B: en el código (recomendado para mantenerlos al día).**
1. Edita el `.mmd`. Puedes probarlo en [mermaid.live](https://mermaid.live).
2. Ejecuta, desde la raíz del repositorio:

   ```bash
   python3 tools/generar_diagramas.py
   ```

   Eso regenera el SVG, el PNG y el draw.io de todos los diagramas. Necesita Node.js con `@mermaid-js/mermaid-cli`, Python con `playwright` y Google Chrome (ver [tools/README.md](../../tools/README.md)).

GitHub muestra los bloques ` ```mermaid ` directamente en los archivos Markdown, así que en el README y en la especificación técnica los diagramas también se ven sin abrir ningún archivo.
