# Cómo trabajar en el proyecto

## Flujo de trabajo

1. Descarga los últimos cambios: `git pull`.
2. Para cambios grandes, crea una rama: `git checkout -b nombre-del-cambio`.
3. Haz el cambio y pruébalo (ver abajo).
4. Commit con un mensaje que diga qué cambió, en español: `git commit -m "Agrega calibración del tanque al dashboard"`.
5. `git push` y, si usaste una rama, abre un Pull Request para que otro integrante lo revise.

## Antes de subir cambios al firmware

```bash
cd firmware
pio test -e native     # pruebas de la lógica, en el computador
pio run                # compila para el Arduino Uno
```

GitHub Actions repite esas dos cosas en cada push. Si algo falla, la pestaña **Actions** del repositorio muestra el error.

Si usas el Arduino IDE en lugar de PlatformIO, al menos compila (botón ✓) antes de subir.

## Convenciones de código

- **Lenguaje:** C++11 para Arduino AVR. No hay `std::string` ni `std::vector`; se usan `const char*`, arreglos de tamaño fijo y `F("...")` para textos.
- **Nombres:** `camelCase` para métodos y variables, `PascalCase` para clases, `UPPER_CASE` para constantes.
- **Dónde va cada cosa:**
  - Las **decisiones** (reglas, cálculos) van en `Logica.h`, sin `Arduino.h`, para poder probarlas en el computador.
  - Lo que toca **pines y hardware** va en `GreenhouseCore.hpp`.
  - Los **pines, umbrales y tiempos** van en `Config.h`.
- **Sin bloqueos:** nada de `delay()` largos; usar `millis()`.
- **Pruebas:** toda regla nueva lleva su prueba en `firmware/test/test_logica/test_logica.cpp`.
- **Memoria:** el Uno tiene 2 KB de RAM. Revisa el resumen de memoria en GitHub Actions; la RAM debería quedar por debajo del 75 %.

## Documentación y diseños

- **Diagramas:** edita el `.mmd` en `docs/diagramas/` y ejecuta `python3 tools/generar_diagramas.py`.
- **Pines:** si los cambias, actualiza `Config.h`, `hardware/circuits/conexiones.md` y `tools/generar_esquema.py`. Luego regenera el esquema.
- **Maqueta:** cambia los PARÁMETROS de `tools/generar_maqueta.py` y ejecútalo.
- **Cambios para el usuario:** anótalos en `CHANGELOG.md`.
