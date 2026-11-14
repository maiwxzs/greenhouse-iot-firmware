# Diagramas

Cada diagrama está en tres formatos: SVG para la web, PNG para documentos y presentaciones, y draw.io para editar.

| Diagrama | Qué muestra | Archivos |
|---|---|---|
| Arquitectura del sistema | Sensores, actuadores, interfaz local y computador, con el pin o bus de cada conexión | [svg](arquitectura-sistema.svg) · [png](arquitectura-sistema.png) · [drawio](arquitectura-sistema.drawio) |
| Capas del firmware | Archivos y clases, desde `main.cpp` hasta la lógica pura y las librerías | [svg](firmware-capas.svg) · [png](firmware-capas.png) · [drawio](firmware-capas.drawio) |
| Ciclo de control | Una vuelta de `loop()` y las decisiones de cada muestra | [svg](ciclo-control.svg) · [png](ciclo-control.png) · [drawio](ciclo-control.drawio) |
| Estados con histéresis | Temperatura, humedad del suelo y humedad del aire, con sus condiciones de cambio | [svg](estados-control.svg) · [png](estados-control.png) · [drawio](estados-control.drawio) |
| Diagrama de clases | UML del firmware: herencia, composición y métodos | [svg](uml-clases.svg) · [png](uml-clases.png) · [drawio](uml-clases.drawio) |
| Secuencia aplicación ↔ Arduino | Conexión, sincronización de la hora, telemetría, historial y cambio de un ajuste | [svg](secuencia-app-arduino.svg) · [png](secuencia-app-arduino.png) · [drawio](secuencia-app-arduino.drawio) |
| Arquitectura de la aplicación | Conexión, datos, IndexedDB y componentes React | [svg](aplicacion-arquitectura.svg) · [png](aplicacion-arquitectura.png) · [drawio](aplicacion-arquitectura.drawio) |
| Mensajes del protocolo | Campos de `tel`, `cfg`, respuestas, comandos y enumeraciones | [svg](protocolo-mensajes.svg) · [png](protocolo-mensajes.png) · [drawio](protocolo-mensajes.drawio) |

El esquema eléctrico está en [`hardware/circuits/esquema-conexiones.svg`](../../hardware/circuits/esquema-conexiones.svg).

## Código de colores

| Color | Elemento |
|---|---|
| Azul | Sensores y entradas |
| Ámbar | Actuadores y acciones sobre ellos |
| Verde | Control y orquestación |
| Morado | Interfaz local |
| Turquesa | Aplicación y lógica de datos |
| Gris | Datos, memoria y decisiones |

## Edición

**En draw.io:** el `.drawio` se abre en [app.diagrams.net](https://app.diagrams.net) o en draw.io Desktop. En los diagramas de flujo y de clases cada caja y cada flecha es una figura editable. El grupo guarda además la definición original: al seleccionarlo, el ícono de edición permite cambiar el texto del diagrama y regenerarlo. Los diagramas de estados y de secuencia se guardan como imagen dentro del grupo.

**Desde el repositorio:** las definiciones de todos los diagramas están en [`tools/generar_diagramas.py`](../../tools/generar_diagramas.py). Al ejecutar `python3 tools/generar_diagramas.py` se regeneran los tres formatos de cada uno ([requisitos](../../tools/README.md)).
