# Lista de materiales (BOM)

## Ya comprados

| # | Componente | Especificación clave | Uso en el sistema |
|---|---|---|---|
| 1 | Arduino Uno R3 (clon CH340G) + cable USB | 5V, 14 E/S digitales, 6 analógicas | Controlador |
| 1 | Sensor DS18B20 sumergible | 1-Wire, 3.0–5.5V, −55 a 125 °C, ±0.5 °C, cable de ~95 cm | Temperatura |
| 1 | Módulo de humedad HR202 (comparador LM393) | 3.3–5V, 20–95 % HR, salida DO (y AO según módulo) | Humedad del aire |
| 1 | Mini bomba sumergible | 3–6V, 80–120 L/h, elevación 40–110 cm, salida 7.5 mm, **máx. 20 min/hora** | Aspersor |
| 1 | Mini ventilador 40×40×10 mm | 5V DC, 0.1 A, 0.5 W | Ventilación |
| 1 | Módulo relé 1 canal con optoacoplador | Bobina 5V, SPDT, borneras de tornillo | Encender la bomba |
| 1 | Protoboard 830 puntos | | Montaje sin soldar |
| 10 | Cables Dupont macho-macho 20 cm | | Arduino ↔ protoboard |
| 10 | Cables Dupont macho-hembra 30 cm | | Arduino/protoboard ↔ módulos |

## Faltan (necesarios para que el circuito funcione)

| Cant. | Componente | Por qué |
|---|---|---|
| 1 | **Resistencia 4.7 kΩ** | Pull-up del DS18B20. Sin ella el sensor no responde (lee −127 °C). |
| 2 | LED 5 mm (rojo y azul) | Indicadores de humedad baja / alta. |
| 2 | Resistencia 220 Ω | Una por LED, para que no se quemen. |
| 1 | **Segundo módulo relé 5V 1 canal** | El ventilador necesita su propio interruptor. *Alternativa:* transistor 2N2222 + resistencia 1 kΩ + diodo 1N4007. |
| 1 | Fuente externa 5V ≥ 1 A | Alimenta bomba y ventilador sin sobrecargar el Arduino (sirve un cargador de celular con el cable cortado o un conector DC hembra). |

## Recomendados

| Cant. | Componente | Por qué |
|---|---|---|
| 2 | Diodo 1N4007 | En paralelo con bomba y ventilador; protege los relés de los picos del motor (lo recomienda el vendedor del relé). |
| ~1 m | Manguera de silicona 5–8 mm + boquilla/aspersor | Para llevar el agua de la bomba a las plantas. |
| 1 | Recipiente para agua | La bomba es sumergible y no debe trabajar en seco. |
| 5–10 | Cables Dupont adicionales | Con dos relés y el HR202 se usan casi todos los macho-hembra. |
