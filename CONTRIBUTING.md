# Contribuir

## Flujo de trabajo

1. Actualizar la copia local con `git pull`.
2. Para cambios grandes, trabajar en una rama: `git checkout -b nombre-del-cambio`.
3. Probar el cambio (ver abajo).
4. Hacer commit con un mensaje en español que diga qué cambió, por ejemplo `Agrega calibración del tanque a la aplicación`.
5. Subir con `git push` y, si se usó una rama, abrir un Pull Request para revisión.

## Verificación

**Firmware:**

```bash
cd firmware
pio test -e native     # pruebas de la lógica en el computador
pio run                # compila para el Arduino Uno, con y sin LCD
```

**Aplicación:**

```bash
cd app
npm install
npm run build          # genera app/dist, que también se sube al repositorio
```

GitHub Actions repite estas verificaciones en cada push; el resultado y el uso de memoria del Arduino aparecen en la pestaña **Actions**.

## Convenciones del firmware

- **Lenguaje:** C++11 para AVR, sin STL. Textos con `F("...")` para que vivan en la memoria flash.
- **Nombres:** `camelCase` para métodos y variables, `PascalCase` para clases y `UPPER_CASE` para constantes.
- **Ubicación:**
  - Decisiones y cálculos en `Logica.h`, sin `Arduino.h`, para poder probarlos en el computador.
  - Acceso a pines y hardware en `GreenhouseCore.hpp`.
  - Pines, umbrales de fábrica y tiempos en `Config.h`.
- **Sin bloqueos:** tiempos con `millis()`, sin `delay()` largos.
- **Pruebas:** cada regla nueva lleva su prueba en `firmware/test/test_logica/test_logica.cpp`.
- **Memoria:** el Uno tiene 2 KB de RAM. El historial y los textos largos pertenecen a la aplicación, no al firmware.

## Convenciones de la aplicación

- Componentes en `app/src/componentes/`, lógica sin interfaz en `app/src/lib/`.
- Todo cambio en el protocolo se aplica a la vez en el firmware, en `protocolo.js`, en `simulador.js` y en `docs/protocolo-serie.md`.
- Cada animación representa un dato real del invernadero.

## Documentación y diseños

- **Diagramas:** editar el diccionario `DIAGRAMAS` de `tools/generar_diagramas.py` y ejecutarlo.
- **Pines:** actualizar `Config.h`, `tools/generar_esquema.py` y `hardware/circuits/conexiones.md`, y regenerar el esquema.
- **Maqueta:** cambiar los parámetros de `tools/generar_maqueta.py` y ejecutarlo.
- **Cambios visibles:** anotarlos en `CHANGELOG.md`.
