# Smart Greenhouse IoT — Sistema de Monitoreo y Control Automatizado

## Descripción General

Sistema embebido de control y monitoreo en tiempo real diseñado para prevenir pérdidas de cultivos por variaciones térmicas e hídricas. La solución integra adquisición de datos mediante sensores ambientales, control de actuadores (aspersor y ventilador), indicadores visuales y una arquitectura orientada a objetos en C++ bajo principios de ingeniería de sistemas.

**Tecnologías:** C++ | Arduino | Embedded Systems | IoT | UML/POO

---

## Arquitectura del Sistema

```
Sensores (DS18B20 temperatura, HR202 humedad del aire)
         ↓
  Microcontrolador (Arduino Uno R3)
         ↓
  Lógica de Control (C++ POO, con histéresis)
         ↓
Actuadores (bomba/aspersor y ventilador vía relés, LEDs)
         ↓
  Telemetría JSON por puerto serie  →  (futuro) backend Spring Boot vía WiFi
```

Diagramas de bloques, flujo del sistema y modelo UML: carpeta `docs/assets/`.

---

## Componentes de Hardware

| Componente | Tipo | Función |
|------------|------|---------|
| Arduino Uno R3 (CH340G) | Microcontrolador | Procesamiento local y ejecución de reglas de control |
| DS18B20 sumergible | Sensor de temperatura | Temperatura (°C), digital 1-Wire, ±0.5 °C |
| Módulo HR202 (LM393) | Sensor de humedad | Humedad relativa del aire (%), salidas DO y AO |
| Mini bomba sumergible 3–6V | Actuador (relé) | Aspersor cuando la humedad es baja, por pulsos |
| Mini ventilador 5V 40×40 | Actuador (relé) | Ventilación por calor o por humedad alta |
| LED rojo / LED azul | Indicadores | Humedad baja / humedad alta |
| Módulo relé 5V (×2, hay 3) | Interfaz de potencia | Enciende los motores sin pasar su corriente por los pines del Arduino |

- Conexiones pin a pin, cableado de potencia y calibración: [`hardware/circuits/conexiones.md`](hardware/circuits/conexiones.md)
- Lista de materiales (comprados y faltantes): [`hardware/bom/BOM.md`](hardware/bom/BOM.md)

---

## Lógica de Control

Se leen los sensores cada 2 s. Todos los umbrales están en `firmware/include/Config.h`.

| Condición | Ventilador | Bomba (aspersor) | LED rojo | LED azul |
|---|---|---|---|---|
| Temperatura > 30 °C (se apaga < 28 °C) | ON | — | — | — |
| Humedad < 40 % (sale de BAJA al llegar a 45 %) | — | Pulsos de 5 s, 1 min de pausa | ON | OFF |
| Humedad entre 40 % y 80 % | — | OFF | OFF | OFF |
| Humedad > 80 % (sale de ALTA al bajar a 75 %) | ON | OFF | OFF | ON |
| Falla del DS18B20 (desconectado) | ON (por seguridad) | — | Parpadeo alternado | Parpadeo alternado |

- Todo se alimenta desde el Arduino por USB (sin fuente externa): por eso la bomba y el ventilador nunca funcionan a la vez; el ventilador se pausa los 5 s de cada riego. Se cambia con `ALIMENTACION_SOLO_ARDUINO` en `Config.h`.
- La bomba respeta el límite del fabricante (máx. 20 min/hora): el firmware la limita a 15 min/hora y, con los valores por defecto, en la práctica trabaja menos de 5 min/hora.
- Al arrancar, los relés se dejan apagados **antes** de configurar los pines como salida, para que la bomba no se active por un instante.
- El LED de la placa (pin 13) parpadea con cada muestra: indica que el sistema está vivo.

---

## Cómo compilar y cargar

### Opción A — PlatformIO (VS Code)

```bash
cd firmware
pio run -t upload        # compila y carga al Arduino
pio device monitor       # abre el monitor serie (9600 baudios)
```

Las librerías (OneWire, DallasTemperature) se descargan solas según `platformio.ini`.

### Opción B — Arduino IDE

1. Crea una carpeta llamada `Invernadero`.
2. Copia `firmware/src/main.cpp` dentro y renómbralo a `Invernadero.ino`.
3. Copia `firmware/include/Config.h` y `firmware/include/GreenhouseCore.hpp` a esa misma carpeta.
4. En *Herramientas → Administrar bibliotecas*, instala **OneWire** (Paul Stoffregen) y **DallasTemperature** (Miles Burton).
5. Placa: *Arduino Uno*. Si el puerto no aparece, instala el driver **CH340** (la placa es un clon con ese chip).

---

## Telemetría

Cada 2 s se envía una línea JSON por el puerto serie (las líneas que empiezan por `#` son mensajes informativos):

```json
{"t_ms":2000,"temp_c":25.00,"hum_pct":50.0,"hum_adc":625,"hum_do":0,"estado":"NORMAL","humedad":"NORMAL","ventilador":0,"bomba":0,"bomba_s_hora":0}
```

| Campo | Significado |
|---|---|
| `temp_c` | Temperatura del DS18B20 (`null` si el sensor falla) |
| `hum_pct` | Humedad aproximada 0–100 % (según la calibración del HR202) |
| `hum_adc` | Lectura cruda de AO (0–1023), útil para calibrar |
| `hum_do` | Salida digital del módulo (1 = supera el umbral del potenciómetro) |
| `estado` | `NORMAL`, `ALERTA_TEMPERATURA_ALTA`, `HUMEDAD_BAJA`, `HUMEDAD_ALTA`, `FALLA_SENSOR_TEMPERATURA` |
| `ventilador`, `bomba` | 1 = encendido |
| `bomba_s_hora` | Segundos de bomba usados en la hora actual |

Este formato está pensado para que el backend (`TelemetriaController`) lo consuma más adelante cuando se pase a una placa con WiFi (ESP32).

---

## Del UML al código

El código en `firmware/include/GreenhouseCore.hpp` sigue el diagrama de clases de `docs/assets/`, con los cambios que exige el hardware definitivo:

| Clase en el UML | Clase en el código | Cambio |
|---|---|---|
| `Sensor` (abstracta) | `Sensor` | `obtenerLectura()` recibe el tiempo actual y guarda una `LecturaDato` |
| `SensorDHT11` | `SensorTemperatura` | Ahora DS18B20 (solo temperatura) |
| `SensorHumedad` (YL-69) | `SensorHumedad` | Ahora HR202 (humedad del aire, DO + AO) |
| `Actuador` (abstracta) | `Actuador` | Se añaden `inicializar()` y `actualizar()` |
| `ServomotorEscotilla` | `ActuadorRele` → `Ventilador`, `BombaAgua` | El servo se reemplaza por ventilador y aspersor |
| `IndicadorLED` | `IndicadorLED` | Se añade `parpadear()`; `cambiarColor()` se elimina (un LED tiene un solo color) |
| `ReglaControl` | `ReglaControl` | Umbral de humedad máxima e histéresis |
| `LecturaDato` | `LecturaDato` | Campo `valida` (antes se usaba `valor >= 0`, que falla con temperaturas bajo cero) |
| `ControladorArduino`, `Invernadero` | igual | Arreglos de tamaño fijo en lugar de `vector` (el Uno no tiene la STL) |

> El diagrama UML (`docs/assets/uml-domain-model-diagram.jpg`) y los PDF de `docs/` aún muestran DHT11, YL-69 y servomotor; conviene actualizarlos con la tabla anterior.

---

## Estructura del Repositorio

```
greenhouse-iot-firmware/
├── docs/                              # Documentación técnica
│   ├── technical-system-specification.pdf
│   ├── uml-to-oop-mapping-analysis.pdf
│   └── assets/                        # Diagramas (draw.io) y UML
├── firmware/                          # Código embebido C++ (proyecto PlatformIO)
│   ├── platformio.ini
│   ├── include/
│   │   ├── Config.h                   # Pines, umbrales y tiempos
│   │   └── GreenhouseCore.hpp         # Clases POO (Sensores, Actuadores, Control)
│   └── src/
│       └── main.cpp                   # Punto de entrada (setup/loop)
├── hardware/
│   ├── circuits/conexiones.md         # Pines, potencia, calibración, pruebas
│   └── bom/BOM.md                     # Lista de materiales
├── .gitignore
└── README.md
```

---

## Convenciones de Código

- Lenguaje: C++11 (Arduino AVR)
- Estilo: camelCase para métodos y variables, UPPER_CASE para constantes
- Documentación: comentarios en línea explicando la lógica de control

---

## Autores

- **maiwxzs**
- **pautthh**
- **lopezand2701**
- **jdavidortiz2004-tech**
