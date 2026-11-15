# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según [SemVer](https://semver.org/lang/es/).

## [3.1.0] - 2026-11-15

### Agregado
- Aplicación de escritorio para Windows con Electron: instalador `.exe`, acceso directo, selector propio del puerto USB y permisos limitados al puerto serie.
- Maqueta interactiva en la aplicación, con las medidas y materiales de la maqueta física: cada pieza muestra su ficha y su acción, la caja se abre para ver la electrónica y cada animación responde a un dato (ventilador con inercia y flujo de aire, riego con gotas, tierra y hojas según la humedad, calor, rocío, LEDs, zumbador, luz según la hora y datos que viajan por el cable USB).
- Motor de animación a 60 cuadros por segundo con física simple. El agua del tanque tiene nivel con caudal limitado, olas (ecuación de onda), chorro y burbujas al rellenar. La manguera se llena desde la bomba y las gotas caen con gravedad, rebotan en las hojas y salpican la tierra. Las hojas son resortes amortiguados que se marchitan, se recuperan al regar y tiemblan con el viento del ventilador, que tiene inercia y desenfoque de movimiento. Además hay ondas de calor y niebla con el aire húmedo.
- Gráficas con trazo animado, relleno degradado, halo en el último valor y cursor con el valor de cada serie; números del tablero que se deslizan hasta el nuevo valor.
- Réplica de la pantalla LCD con matriz de puntos de 5×8 que muestra las mismas páginas que el firmware.
- Tablero con trazas de 30 minutos y bitácora de los últimos eventos.
- Botones de la demostración para provocar calor, sequía, aire húmedo o tanque vacío.
- Integración continua que construye el instalador en Windows, abre la aplicación empaquetada como prueba de humo y adjunta el instalador a cada versión en Releases.

### Cambiado
- Nueva identidad visual de la aplicación: tema oscuro con base verde y superficies lisas, color reservado para los datos y los materiales de la maqueta; navegación lateral.
- Documentación de la aplicación, manual de usuario y diagrama de arquitectura como aplicación de escritorio.

### Eliminado
- Versión web en GitHub Pages, instalación desde el navegador y service worker.

## [3.0.1] - 2026-11-15

### Corregido
- Simulación de Tinkercad: pantalla con el expansor PCF8574 y la librería LiquidCrystal_I2C; motores en el contacto normalmente abierto del relé (terminal 6).
- Simulación de Tinkercad: el pulsador se lee por interrupción y ya no pierde pulsaciones cortas; los comandos del monitor serie se ejecutan sin necesidad de Enter.

### Cambiado
- Simulación de Tinkercad: avisos en la pantalla con duración mínima de lectura, páginas de 4 s, refresco de la pantalla cinco veces por segundo y línea de estado del monitor solo cuando algo cambia.
- Documentación de Tinkercad con los terminales del relé, el código de colores, los nombres de las piezas, las 13 pruebas verificadas, el enlace al diseño y una captura del circuito.

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
