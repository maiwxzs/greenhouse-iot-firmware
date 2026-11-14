# Lista de materiales

Componentes instalados en el invernadero, con las especificaciones y medidas usadas en el diseño y en el modelo 3D.

## Electrónica

| Cant. | Componente | Especificaciones | Medidas | Función |
|---|---|---|---|---|
| 1 | Arduino Uno R3, clon con CH340G, y cable USB A-B | ATmega328P, 16 MHz, 5 V, 2 KB RAM, 32 KB flash | 68.6 × 53.3 mm | Controlador |
| 1 | Protoboard MB-102 | 830 puntos, dos pares de rieles | 165 × 55 × 8.5 mm | Montaje sin soldadura |
| 1 | Sonda DS18B20 sumergible | 1-Wire, 3.0–5.5 V, −55 a 125 °C, ±0.5 °C, 12 bits | Punta de acero Ø6 × 50 mm, cable de 1 m (rojo, negro, amarillo) | Temperatura del aire |
| 1 | Módulo de humedad HR202 con relé | 5 V, comparador LM393, potenciómetro de umbral, relé con bornera NO/COM/NC, LEDs de alimentación y de salida | Placa azul de 50 × 26 mm | Humedad del aire alta |
| 2 | Módulo relé de 1 canal con optoacoplador | Bobina de 5 V, relé JQC-3FF-S-Z de 10 A, activo en bajo, jumper JD-VCC, bornera NO/COM/NC | Placa negra de 50 × 26 mm | Bomba y ventilador |
| 1 | Mini bomba sumergible | 3–6 V, 130–220 mA, 80–120 L/h, elevación de 40 a 110 cm, salida Ø7.5 mm, entrada Ø5 mm, uso máximo 20 min por hora | Cuerpo Ø24 × 45 mm, 33 mm de alto con la salida | Riego |
| 1 | Ventilador Pengda 5 V DC | 0.1 A, conector JST de 2 pines | 40 × 40 × 10 mm, agujeros a 32 mm | Ventilación |
| 1 | Zumbador piezoeléctrico activo | 3–24 V DC, unos 12 mA a 5 V, tono continuo de unos 3 kHz, carcasa de ABS negro con rejilla | Cuerpo de 30 × 20 × 13 mm, 44 mm de largo con las orejas, agujeros a 38 mm, cables de 90 mm | Alarma |
| 1 | Pantalla LCD 16×2 con módulo I2C PCF8574 | 5 V, luz de fondo, dirección 0x27 o 0x3F | 80 × 36 mm, ventana de 64 × 14 mm | Pantalla local |
| 1 | LED rojo de 5 mm | | Ø5 mm | Suelo seco, tanque vacío |
| 1 | LED azul de 5 mm | | Ø5 mm | Aire húmedo |
| 2 | Resistencia de 220 Ω, ¼ W | | | LEDs |
| 1 | Resistencia de 4.7 kΩ, ¼ W | | | Pull-up del bus 1-Wire |
| 1 | Pulsador de 12 mm | Normalmente abierto | Ø12 mm | Riego manual y silencio |
| 1 juego | Cables Dupont macho-macho | | 20 cm | Arduino y protoboard |
| 1 juego | Cables Dupont macho-hembra | | 30 cm | Módulos, sensores y cargas |

## Sondas

| Cant. | Material | Uso |
|---|---|---|
| 2 | Clavos galvanizados de 65 mm | Electrodos de la sonda de suelo |
| 2 | Cables de cobre aislados, con 5 mm de punta pelada | Electrodos de la sonda del tanque |
| — | Cinta aislante y termorretráctil | Aislamiento de las uniones |

## Maqueta

Piezas y medidas en [`planos-de-corte.svg`](../maqueta/planos-de-corte.svg); construcción en [`docs/maqueta.md`](../../docs/maqueta.md).

| Cant. | Material | Uso |
|---|---|---|
| 1 | Tablero de MDF de 6 mm, 470 × 310 mm | Base |
| 1 | Lámina de MDF de 3 mm, 450 × 600 mm | Caja de la electrónica |
| 5.3 m | Listón de balso de 10 × 10 mm | Estructura del invernadero |
| 1 | Lámina de acrílico transparente de 2 mm, 600 × 900 mm | Paredes y techo |
| 2 | Bisagras pequeñas de 25 mm | Techo abatible |
| 1 | Recipiente plástico de 1 L, 120 × 85 × 100 mm | Tanque |
| 1 | Maceta Ø110 mm arriba, Ø80 mm abajo, 95 mm de alto, con tierra y una planta | Cultivo |
| 0.6 m | Manguera de silicona de 6 mm de diámetro interior | De la bomba a la boquilla |
| 1 | Boquilla de riego cónica | Salida del agua sobre la maceta |
| 1 | Malla plástica de 80 × 30 mm | Rejilla de entrada de aire |
| 8 | Separadores de 3 mm con tornillo M3 | Arduino y módulos en la caja |
| 2 | Separadores de 6 mm con tornillo M3 | Módulo HR202 en la pared del invernadero |
| 2 | Tornillos M2 × 8 mm con tuerca | Zumbador sobre la tapa |
| 4 | Tornillos M3 × 12 mm con tuerca | Ventilador en la pared |
| — | Pegamento de contacto para balso, silicona transparente, cinta doble faz, bridas plásticas | Uniones y sujeción de cables |
