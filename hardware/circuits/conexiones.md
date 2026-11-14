# Conexiones: Arduino Uno R3

![Esquema de conexiones](esquema-conexiones.svg)

El esquema se genera con `python3 tools/generar_esquema.py`. Todos los pines se pueden cambiar en `firmware/include/Config.h`. Si cambias alguno, actualiza también este documento y el esquema.

## Tabla de pines

| Pin | Va a | Notas |
|---|---|---|
| **5V** | Riel rojo (+) de la protoboard | Alimenta sensores, módulos, pantalla y cargas |
| **GND** | Riel azul o negro (−) de la protoboard | Tierra común de todo |
| **D2** | DS18B20, cable amarillo (DATA) | **Resistencia de 4.7 kΩ entre D2 y 5 V** (obligatoria; también sirve 10 kΩ) |
| **D3** | HR202, pin DO | |
| **D4** | Pulsador | La otra pata del pulsador va a GND. No lleva resistencia (usa el pull-up interno) |
| **D5** | LED rojo, a través de una resistencia de 220 Ω | Pata corta del LED a GND |
| **D6** | LED azul, a través de una resistencia de 220 Ω | Pata corta del LED a GND |
| **D7** | Relé 1, pin IN | Bomba |
| **D8** | Relé 2, pin IN | Ventilador |
| **D9** | Relé 3, pin IN | Luz de cultivo |
| **D10** | Zumbador, pata + | Pata − a GND |
| **D13** | LED de la placa | No se conecta nada; parpadea en cada lectura |
| **A0** | HR202, pin AO | |
| **A1** | Sonda de suelo, clavo 1 | Clavo 2 a GND |
| **A2** | Sonda del tanque, cable 1 | Cable 2 a GND |
| **A4** | Pantalla LCD I2C, pin SDA | |
| **A5** | Pantalla LCD I2C, pin SCL | |

Los módulos (HR202, relés y LCD) se conectan además a **VCC → 5V** y **GND → GND**. El DS18B20 también: **rojo → 5V**, **negro → GND**.

## Relés y cargas

Se usan los tres relés. Cada uno es un interruptor en el cable positivo de su carga. Usa siempre el borne **NO** (normalmente abierto): si el Arduino se apaga o se reinicia, todo queda apagado.

```
 5V del Arduino ──┬──> COM [Relé 1] NO ──> (+) Bomba          (−) ──┐
                  ├──> COM [Relé 2] NO ──> (+) Ventilador     (−) ──┤
                  └──> COM [Relé 3] NO ──> (+) Luz de cultivo (−) ──┤
                                                                    │
 GND del Arduino <──────────────────────────────────────────────────┘
```

- **Luz de cultivo:** una lámpara LED USB pequeña (1 W o menos), a la que se le corta el cable USB: rojo = +, negro = −. También sirve una tira LED de 5 V corta.
- **Diodo 1N4007 (recomendado):** en paralelo con la bomba y con el ventilador, con la franja hacia el +. Protege los relés del pico de voltaje del motor.

### ¿Alcanza la corriente del USB?

Sí, porque el firmware **nunca enciende dos cargas a la vez** (prioridad: bomba, luego ventilador, luego luz). El peor caso es unos 435 mA, por debajo de los 500 mA del USB. El detalle está en la [especificación técnica](../../docs/especificacion-tecnica.md#7-energía).

Conecta el Arduino por **USB**, al computador o a un cargador de celular. No uses una batería de 9 V ni el conector redondo: el regulador interno se calienta.

**Si el Arduino se reinicia cuando arranca la bomba** (en el monitor serie vuelve a salir `# Smart Greenhouse IoT v2.0.0`):

1. Alimenta las cargas con un cargador de 5 V aparte. Su + va a los COM y su − a los − de las cargas. Con relés no hace falta unirlo al GND del Arduino.
2. En `Config.h`, pon `ALIMENTACION_SOLO_ARDUINO = false`. Así las cargas pueden funcionar a la vez.

## Sondas caseras (sin comprar sensores)

Las dos sondas usan el mismo truco: un pin analógico con el **pull-up interno** del Arduino (unos 35 kΩ) y dos electrodos hacia GND. El agua conduce, así que cuanta más agua hay entre los electrodos, más baja es la lectura. El firmware solo energiza la sonda durante la medición (unos milisegundos cada 2 s) para que se corroa lo menos posible.

### Sonda de suelo

- **Materiales:** dos clavos galvanizados o tornillos de 5–7 cm, dos cables Dupont macho-hembra y cinta aislante.
- **Montaje:** enrolla o suelda un cable a la cabeza de cada clavo y aísla la unión con cinta.
- **Instalación:** clávalos en la maceta, separados unos **2–3 cm** y a la misma profundidad. Siempre separados: no deben tocarse.
- **Conexión:** un clavo a **A1** y el otro a **GND**.

### Sonda del tanque

- **Materiales:** dos cables con la punta pelada unos 2 cm.
- **Instalación:** pégalos por dentro del tanque, separados 1–2 cm, a la **altura mínima de agua** que aceptas. Si el agua baja de ese punto, el sistema considera el tanque vacío.
- **Conexión:** un cable a **A2** y el otro a **GND**.

Después de instalarlas, calíbralas (ver el [manual de usuario](../../docs/manual-usuario.md#calibrar-los-sensores)).

## Pantalla LCD 16×2 con módulo I2C

Solo usa 4 cables: **GND, VCC (5 V), SDA (A4) y SCL (A5)**. El firmware detecta solo la dirección (0x27 o 0x3F). Si no se ve texto, gira el potenciómetro azul de atrás del módulo para ajustar el contraste.

Para usar el sistema sin pantalla, pon `#define USAR_LCD 0` en `Config.h`. Así ya no hace falta la librería LiquidCrystal_I2C.

## Zumbador

- **Zumbador activo** (suena con solo darle voltaje; suele tener una etiqueta en la parte de arriba): déjalo como está, con `ZUMBADOR_PASIVO = false`.
- **Zumbador pasivo** (necesita un tono): pon `ZUMBADOR_PASIVO = true`.

## Comprobaciones antes de energizar

- [ ] La resistencia de 4.7 kΩ está entre D2 y 5 V.
- [ ] Cada LED tiene su resistencia de 220 Ω, y la pata larga va hacia el pin.
- [ ] Ningún motor ni lámpara va directo a un pin del Arduino: todos pasan por el borne NO de su relé.
- [ ] Los dos clavos de la sonda de suelo no se tocan entre sí.
- [ ] La bomba está **sumergida** en agua.
- [ ] Si alguna parte no está conectada, está desactivada en `Config.h` (`USAR_SONDA_SUELO`, `USAR_SONDA_NIVEL_AGUA`, `USAR_LUZ`, `USAR_ZUMBADOR`, `USAR_BOTON`, `USAR_LCD`).
