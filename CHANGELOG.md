# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según [SemVer](https://semver.org/lang/es/).

## [2.0.0] - 2026-11-14

### Agregado
- Sonda casera de humedad del suelo (dos clavos) y sonda de nivel del tanque (dos cables), usando el pull-up interno del Arduino.
- Luz de cultivo en el tercer relé, con horario configurable y reloj por software.
- Pantalla LCD 16×2 I2C con detección automática de dirección (0x27 o 0x3F).
- Zumbador de alarma (tanque vacío, temperatura crítica, sensor desconectado) y pulsador de riego manual y silencio.
- Comandos por el puerto serie para cambiar umbrales, calibrar sensores, poner la hora y regar. Los ajustes se guardan en la EEPROM con validación y checksum.
- Dashboard web (`dashboard/index.html`): lecturas en vivo, dibujo animado, gráficas, ajustes, calibración, consola, exportación CSV y modo de demostración.
- Lógica separada en `Logica.h`, con 25 pruebas unitarias.
- Compilación y pruebas automáticas en GitHub Actions, con reporte de memoria.
- Versión para Tinkercad Circuits y su guía.
- Maqueta paramétrica: modelos STL, renders y planos de corte.
- Esquema de conexiones y diagramas Mermaid exportados a draw.io.
- Documentación: especificación técnica, manual de usuario, protocolo serie, montaje de la maqueta.
- Licencias: MIT (código) y CC BY 4.0 (documentación y diseños).

### Cambiado
- Reparto de energía: con alimentación solo por USB, una carga grande a la vez (bomba > ventilador > luz).
- El riego considera el suelo: no riega con el suelo encharcado, ni con el tanque vacío.
- Los PDF, el UML y los diagramas iniciales pasan a `docs/historial/`.

### Eliminado
- Referencias al ESP32 y al backend Spring Boot.

## [1.1.0] - 2026-11-14

### Agregado
- Firmware para el hardware comprado: DS18B20, HR202, bomba y ventilador por relé, LEDs.
- Control con histéresis, riego por pulsos con límite de 15 min/hora, arranque sin clic de los relés y modo seguro ante falla del DS18B20.
- Telemetría JSON por el puerto serie.

### Corregido
- `gitignore` renombrado a `.gitignore`; quitadas las extensiones dobles de `docs/`.

## [1.0.0] - 2026-09-29

### Agregado
- Diseño inicial: definición del problema, UML, mapeo UML a POO y estructura de clases (DHT11, YL-69, servomotor).
