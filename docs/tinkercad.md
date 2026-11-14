# Simulación en Tinkercad Circuits

Con Tinkercad puedes armar y probar el circuito en el navegador antes de tener las piezas, o mostrarlo en clase sin el hardware. Tinkercad no tiene todas nuestras piezas, así que se usan equivalentes; el código para esta versión está en [`tinkercad/invernadero_tinkercad.ino`](../tinkercad/invernadero_tinkercad.ino).

## Piezas equivalentes

| Pieza real | En Tinkercad (nombre para buscar) | Por qué |
|---|---|---|
| Arduino Uno R3 | Arduino Uno R3 | Igual |
| DS18B20 | Temperature Sensor [TMP36] | Tinkercad no tiene DS18B20 |
| HR202 | Potentiometer | Simula la salida AO: girarlo = cambiar la humedad |
| Sonda de suelo (dos clavos) | Soil Moisture Sensor | Mismo principio |
| Sonda del tanque | Slideswitch | Una posición = hay agua, la otra = vacío |
| Módulo relé (×3) | Relay SPDT + NPN Transistor (BJT) + Diode + Resistor 1 kΩ | Es lo que el módulo trae por dentro |
| Bomba y ventilador | DC Motor (×2) | |
| Luz de cultivo | Light bulb | |
| LCD 16×2 I2C | LCD 16 x 2 (I2C) | Usa la librería Adafruit_LiquidCrystal de Tinkercad |
| Zumbador | Piezo | |
| Pulsador | Pushbutton | |
| LEDs y resistencias | LED (rojo y azul) + Resistor 220 Ω | Igual |

## Paso a paso

1. Entra a [tinkercad.com](https://www.tinkercad.com) y crea un diseño nuevo de **Circuits**.
2. Arrastra el **Arduino Uno R3** y una **Breadboard**. Une **5V** al riel rojo (+) y **GND** al riel azul (−).
3. Coloca las piezas y cablea según la tabla de abajo.
4. Pulsa **Code**, cambia de «Blocks» a **Text**, borra lo que haya y pega todo el contenido de `tinkercad/invernadero_tinkercad.ino`.
5. Pulsa **Start Simulation** y abre el **Serial Monitor** (abajo, en la ventana de código).

### Cableado

| Pieza | Patita | Va a |
|---|---|---|
| TMP36 (cara plana hacia ti) | izquierda (+Vs) | 5V |
| | centro (Vout) | **A3** |
| | derecha (GND) | GND |
| Potenciómetro (humedad del aire) | extremos | 5V y GND |
| | centro (cursor) | **A0** |
| Soil Moisture Sensor | VCC / GND | 5V / GND |
| | SIG | **A1** |
| Slideswitch (tanque) | central (común) | **A2** |
| | un extremo | GND (el otro queda libre) |
| Pushbutton | una patita | **D4** |
| | patita diagonal | GND |
| LED rojo | ánodo (pata doblada) | **D5**, a través de una resistencia de 220 Ω |
| LED azul | ánodo | **D6**, a través de una resistencia de 220 Ω |
| LEDs | cátodo | GND |
| Piezo | + (rojo) / − | **D10** / GND |
| LCD 16 x 2 (I2C) | GND / VCC / SDA / SCL | GND / 5V / **A4** / **A5** |

**Cada relé** (repítelo tres veces: bomba en **D7**, ventilador en **D8** y luz en **D9**):

| Pieza | Conexión |
|---|---|
| Resistencia de 1 kΩ | Del pin del Arduino (D7, D8 o D9) a la **base** del transistor NPN |
| Transistor NPN | Emisor a GND; colector a una terminal de la **bobina** del relé |
| Bobina del relé | La otra terminal a 5V |
| Diodo | En paralelo con la bobina; la franja (cátodo) hacia 5V |
| Relé COM | 5V |
| Relé NO | + del motor (o de la bombilla) |
| Motor o bombilla | − a GND |

En Tinkercad los relés se activan con nivel **alto** (por el transistor). Los módulos reales se activan con nivel bajo; el firmware real ya lo tiene en cuenta.

## Qué probar durante la simulación

Haz clic sobre una pieza mientras corre la simulación para moverla.

| Acción | Resultado esperado |
|---|---|
| Sube la temperatura del TMP36 sobre 30 °C | Gira el motor del ventilador; la luz se apaga (solo una carga a la vez) |
| Gira el potenciómetro hacia abajo (aire seco) | LED rojo y pulsos del motor de la bomba |
| Gira el potenciómetro hacia arriba (aire húmedo) | LED azul y ventilador |
| Saca la sonda del Soil Moisture Sensor de la tierra | LED rojo y riego |
| Cambia de posición el Slideswitch | «SIN AGUA», la bomba no arranca y el piezo pita |
| Pulsa el botón | Riego manual de 3 segundos |
| Escribe `TEMP 25` en el Serial Monitor | Ventila desde 25 °C |

## Diferencias con el firmware real

- **Tiempos más cortos:** pulsos de riego de 3 s y pausas de 10 s (en el real: 5 s y 1 min), para que se vean en la simulación, que va más lenta que el tiempo real.
- **Un solo archivo y menos comandos:** `AYUDA`, `ESTADO`, `TEMP`, `HUMMIN`, `HUMMAX`, `SUELOMIN`, `RIEGO` y `LUZ`. Tampoco guarda los ajustes en la EEPROM.
- **Monitor serie en texto legible** en lugar de JSON, por eso el dashboard no se conecta a Tinkercad.

La lógica de decisión es la misma: histéresis, prioridad bomba > ventilador > luz, bloqueo sin agua y riego manual.
