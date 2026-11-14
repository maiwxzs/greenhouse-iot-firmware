# Simulación en Tinkercad Circuits

El circuito completo está reproducido en Tinkercad Circuits, lo que permite probar el control en el navegador y mostrarlo sin el hardware. Tinkercad no tiene todas las piezas del invernadero, así que se usan equivalentes con el mismo comportamiento eléctrico. El código de la simulación es [`tinkercad/invernadero_tinkercad.ino`](../tinkercad/invernadero_tinkercad.ino).

## Piezas equivalentes

| Pieza real | Pieza en Tinkercad | Motivo |
|---|---|---|
| Arduino Uno R3 | Arduino Uno R3 | Igual |
| DS18B20 | Temperature Sensor [TMP36] | Tinkercad no tiene el DS18B20 |
| Módulo HR202 con relé | Slideswitch | Reproduce el contacto NO/COM: una posición es aire húmedo y la otra aire normal |
| Sonda de suelo de dos clavos | Soil Moisture Sensor | Mismo principio resistivo |
| Sonda del tanque | Slideswitch | Una posición es tanque con agua y la otra vacío |
| Módulo relé (×2) | Relay SPDT + NPN Transistor + Diode + Resistor de 1 kΩ | Es el circuito que trae el módulo por dentro |
| Bomba y ventilador | DC Motor (×2) | |
| Zumbador piezoeléctrico | Piezo | |
| LCD 16×2 I2C | LCD 16 x 2 (I2C) | Usa la librería Adafruit_LiquidCrystal de Tinkercad |
| Pulsador | Pushbutton | |
| LEDs y resistencias | LED rojo, LED azul y Resistor de 220 Ω | Igual |

## Circuito

| Pieza | Terminal | Conexión |
|---|---|---|
| TMP36 (cara plana al frente) | Izquierda (+Vs) / centro (Vout) / derecha (GND) | 5 V / **A3** / GND |
| Slideswitch de humedad del aire | Común / un extremo | **D3** / GND |
| Soil Moisture Sensor | VCC / GND / SIG | 5 V / GND / **A1** |
| Slideswitch del tanque | Común / un extremo | **A2** / GND |
| Pushbutton | Una patita / la diagonal | **D4** / GND |
| LED rojo | Ánodo, con 220 Ω / cátodo | **D5** / GND |
| LED azul | Ánodo, con 220 Ω / cátodo | **D6** / GND |
| Piezo | + / − | **D10** / GND |
| LCD 16 x 2 (I2C) | GND / VCC / SDA / SCL | GND / 5 V / **A4** / **A5** |

Cada relé (bomba en **D7** y ventilador en **D8**):

| Pieza | Conexión |
|---|---|
| Resistencia de 1 kΩ | Del pin del Arduino a la base del transistor NPN |
| Transistor NPN | Emisor a GND; colector a un terminal de la bobina |
| Bobina del relé | El otro terminal a 5 V |
| Diodo | En paralelo con la bobina, cátodo (franja) hacia 5 V |
| COM del relé | 5 V |
| NO del relé | + del motor; − del motor a GND |

Los slideswitch usan el pull-up interno del Arduino, igual que el contacto real del módulo HR202: cerrado a GND significa aire húmedo o tanque con agua.

## Comportamiento verificado

| Acción en la simulación | Resultado |
|---|---|
| Temperatura del TMP36 sobre 30 °C | Gira el motor del ventilador |
| Slideswitch de humedad hacia GND | Tras 3 lecturas: LED azul, ventilador y `HR:ALTA` en la pantalla |
| Sensor de suelo seco (deslizador al mínimo) | LED rojo y pulsos del motor de la bomba; el ventilador se pausa durante cada pulso |
| Slideswitch del tanque abierto | «SIN AGUA», bomba bloqueada, LED rojo intermitente y pitidos |
| Pushbutton | Riego manual de 3 s, o silencio si la alarma está sonando |
| `TEMP 25` en el Serial Monitor | Ventila desde 25 °C |

## Diferencias con el equipo real

- **Tiempos más cortos:** pulsos de riego de 3 s con pausas de 10 s (en el real, 5 s y 1 min), porque la simulación corre más lenta que el tiempo real.
- **Muestreo cada segundo** en lugar de cada 2 s.
- **Menos comandos:** `AYUDA`, `ESTADO`, `TEMP`, `SUELOMIN`, `SUELOMAX` y `RIEGO`. No guarda los ajustes en la EEPROM ni tiene calibración.
- **Monitor serie en texto legible** en lugar de JSON, por lo que la aplicación de monitoreo no se conecta a Tinkercad.
- **Relés activos en alto:** el transistor invierte la lógica respecto a los módulos reales, que se activan en bajo.
- **Sensor de temperatura analógico:** el TMP36 se lee por A3 en lugar del bus 1-Wire en D2.

La lógica de decisión es la misma: histéresis, antirrebote del contacto de humedad, prioridad de la bomba sobre el ventilador, bloqueo sin agua y riego manual.
