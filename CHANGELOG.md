# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según [SemVer](https://semver.org/lang/es/).

## [3.0.0] - 2026-11-14

### Agregado
- Aplicación de monitoreo en React (`app/`): escena animada, instrumentos, gráficas en vivo, historial de 180 días en IndexedDB, estadísticas diarias, eventos, ajustes, calibración, consola, exportación CSV, modo demostración e instalación como aplicación.
- Lectura del módulo HR202 como contacto seco en D3, con antirrebote de 3 lecturas.
- Zumbador piezoeléctrico activo de 3–24 V, atornillado sobre la tapa de la caja.
- Maqueta detallada: componentes con forma y medidas reales, cableado completo, renderizador propio, exportación OBJ con colores, planos de corte con todos los huecos y plano de distribución.
- Diagramas nuevos: capas del firmware, arquitectura de la aplicación y mensajes del protocolo.
- Documentación de la maqueta y de la aplicación.

### Cambiado
- La humedad del aire es binaria (normal o alta) y solo activa la ventilación; el riego automático depende de la humedad del suelo.
- Reparto de energía entre bomba y ventilador, con prioridad para la bomba.
- Ajustes en EEPROM, versión 4.
- Telemetría y configuración sin los campos de humedad analógica ni de luz.
- Diagramas rediseñados con disposición ELK y código de colores; las definiciones pasan al generador.
- Sonda del tanque a 35 mm del fondo, por encima de la bomba.

### Eliminado
- Luz de cultivo, tercer relé y comando `LUZ`.
- Comandos `HUMMIN`, `HUMMAX`, `CAL AIRESECO` y `CAL AIREHUMEDO`.
- Dashboard HTML, reemplazado por la aplicación.
- Carpeta `docs/historial` y archivos fuente `.mmd`.

## [2.0.0] - 2026-11-14

### Agregado
- Sondas caseras de humedad del suelo y de nivel del tanque con el pull-up interno del Arduino.
- Pantalla LCD 16×2 I2C con detección de dirección, zumbador de alarma y pulsador de riego manual.
- Comandos serie para umbrales, calibración, hora y riego, con ajustes en EEPROM validados por checksum.
- Lógica separada en `Logica.h` con pruebas unitarias e integración continua.
- Versión para Tinkercad Circuits, esquema de conexiones y maqueta paramétrica.
- Licencias MIT (código) y CC BY 4.0 (documentación y diseños).

### Cambiado
- Alimentación solo por el USB del Arduino, con una carga grande a la vez.

### Eliminado
- ESP32 y backend.

## [1.1.0] - 2026-11-14

### Agregado
- Firmware para DS18B20, módulo de humedad, bomba y ventilador por relé, y LEDs.
- Control con histéresis, riego por pulsos con tope horario, arranque de relés sin clic y modo seguro ante falla del DS18B20.
- Telemetría JSON por el puerto serie.

## [1.0.0] - 2026-09-29

### Agregado
- Diseño inicial: definición del problema, UML y estructura de clases.
