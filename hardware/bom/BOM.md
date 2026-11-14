# Lista de materiales (BOM)

## Electrónica

### Ya comprado

| Cant. | Componente | Especificación clave | Uso |
|---|---|---|---|
| 1 | Sensor DS18B20 sumergible | 1-Wire, 3.0–5.5 V, −55 a 125 °C, ±0.5 °C, cable de ~95 cm | Temperatura |
| 1 | Módulo HR202 con comparador LM393 | 3.3–5 V, 20–95 % HR, salidas DO y AO | Humedad del aire |
| 1 | Mini bomba sumergible | 3–6 V, 80–120 L/h, salida de 7.5 mm, **máx. 20 min/hora** | Aspersor |
| 1 | Mini ventilador 40×40×10 mm | 5 V, 0.1 A | Ventilación |
| 3 | Módulo relé de 1 canal con optoacoplador | Bobina de 5 V, borneras COM/NO/NC | Bomba, ventilador y luz |
| 1 | Protoboard de 830 puntos | | Montaje sin soldar |
| 10 | Cables Dupont macho-macho de 20 cm | | Arduino y protoboard |
| 10 | Cables Dupont macho-hembra de 30 cm | | Módulos |

### Por comprar

| Cant. | Componente | Por qué | Obligatorio |
|---|---|---|---|
| 1 | **Arduino Uno R3** (clon con CH340G sirve) y su cable USB | Controlador | Sí |
| 1 | **Resistencia de 4.7 kΩ** (sirve también 10 kΩ) | Pull-up del DS18B20; sin ella lee −127 °C | Sí |
| 2 | LED de 5 mm (rojo y azul) | Indicadores de humedad | Sí |
| 2 | Resistencia de 220 Ω (o 330 Ω) | Una por LED | Sí |
| 1 | Pantalla LCD 16×2 **con módulo I2C** ya soldado | Ver datos sin computador | Recomendado |
| 1 | Zumbador (buzzer) activo de 5 V | Alarma sonora | Recomendado |
| 1 | Pulsador de 12 mm (o un pulsador pequeño de protoboard) | Riego manual | Recomendado |
| 1 | Lámpara LED USB pequeña (≤ 1 W) | Luz de cultivo en el relé 3 | Opcional |
| 2 | Diodo 1N4007 | Protege los relés de los picos de los motores | Recomendado |
| 10 | Cables Dupont hembra-hembra o más macho-hembra | Con LCD, zumbador y relés no alcanzan los 10 macho-hembra | Recomendado |

### Hecho en casa (sin costo)

| Cant. | Componente | Uso |
|---|---|---|
| 2 | Clavos galvanizados o tornillos de 5–7 cm | Sonda de humedad del suelo |
| 2 | Cables con la punta pelada | Sonda de nivel del tanque |

## Maqueta

Medidas y piezas en [`hardware/maqueta/planos-de-corte.svg`](../maqueta/planos-de-corte.svg) y guía en [`docs/montaje-maqueta.md`](../../docs/montaje-maqueta.md).

| Cant. | Material | Uso |
|---|---|---|
| 1 | Tablero de MDF de 3 mm o cartón paja de 5 mm, 46 × 30 cm o más | Base |
| 1 | Lámina de MDF de 3 mm o cartón paja, unos 40 × 40 cm | Caja de la electrónica |
| ≈ 3.5 m | Palitos de balso de 10 × 10 mm | Estructura del invernadero |
| 2 pliegos | Acetato o acrílico transparente de 1.5–2 mm | Paredes y techo |
| 1 | Recipiente plástico de unos 12 × 8.5 × 10 cm | Tanque de agua |
| 1 | Maceta pequeña (Ø ≈ 11 cm) con tierra y una planta | Cultivo |
| ≈ 1 m | Manguera de silicona de 5–8 mm | De la bomba al aspersor |
| 1 | Boquilla o aspersor pequeño (o una tapa perforada) | Salida del agua |
| 1 | Trozo de malla de tela (8 × 3 cm) | Rejilla de entrada de aire |
| — | Silicona caliente, cinta doble faz, bisturí, regla metálica | Armado |
