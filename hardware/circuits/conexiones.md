# Conexiones — Arduino Uno R3

Todos los pines se pueden cambiar en `firmware/include/Config.h`.

## Tabla de pines

| Componente | Pin del componente | Va a | Notas |
|---|---|---|---|
| **DS18B20** (temperatura) | Rojo (VCC) | 5V | |
| | Negro (GND) | GND | |
| | Amarillo o blanco (DATA) | **D2** | **Resistencia de 4.7 kΩ entre DATA y 5V** (obligatoria) |
| **Módulo HR202** (humedad del aire) | VCC | 5V | |
| | GND | GND | |
| | DO | **D3** | Salida digital del comparador |
| | AO | **A0** | Salida analógica (si tu módulo no la tiene, ver abajo) |
| **LED rojo** (humedad baja) | Ánodo (pata larga) | **D5** → resistencia 220 Ω → LED | |
| | Cátodo (pata corta) | GND | |
| **LED azul** (humedad alta) | Ánodo (pata larga) | **D6** → resistencia 220 Ω → LED | |
| | Cátodo (pata corta) | GND | |
| **Relé 1** (bomba) | VCC / DC+ | 5V del Arduino | |
| | GND / DC− | GND del Arduino | |
| | IN | **D7** | |
| **Relé 2** (ventilador) | VCC / DC+ | 5V del Arduino | |
| | GND / DC− | GND del Arduino | |
| | IN | **D8** | |

## Lado de potencia (bomba y ventilador)

La bomba y el ventilador **no** se alimentan desde el Arduino: usan una fuente externa de 5V
(un cargador de celular de 5V / 1A o más sirve). Cada relé funciona como un interruptor en el
cable positivo:

```
 Fuente 5V (+) ──┬──> COM [Relé 1] NO ──> (+) Bomba      (−) ──┐
                 │                                             │
                 └──> COM [Relé 2] NO ──> (+) Ventilador (−) ──┤
                                                               │
 Fuente 5V (−) <───────────────────────────────────────────────┘
```

- Usa siempre el borne **NO** (normalmente abierto): si el Arduino se apaga o se reinicia, la bomba queda apagada.
- **Diodo 1N4007 recomendado** en paralelo con la bomba y con el ventilador (franja del diodo hacia el +).
  Absorbe el pico de voltaje del motor al apagarse y alarga la vida del relé.
- Con relés no hace falta unir la tierra de la fuente externa con la del Arduino.

### Si solo tienes un relé

Hay un solo módulo relé en la lista de compras, pero el sistema controla dos cargas. Opciones:

1. **Comprar un segundo módulo relé de 5V** (lo más sencillo, mismo cableado que arriba).
2. Manejar el ventilador con un **transistor NPN** (2N2222 o TIP120) + resistencia de 1 kΩ en la base
   + diodo 1N4007 en paralelo con el ventilador. En este caso la tierra de la fuente externa **sí** se une
   a GND del Arduino, y en `Config.h` se pone `RELE_VENTILADOR_ACTIVO_EN_BAJO = false`.

## Comprobaciones antes de energizar

- [ ] La resistencia de 4.7 kΩ del DS18B20 está entre DATA y 5V.
- [ ] Cada LED tiene su resistencia de 220 Ω en serie.
- [ ] Ningún motor está conectado a los pines 5V/GND del Arduino.
- [ ] La bomba está **sumergida** en agua antes de encenderla (no debe trabajar en seco).
- [ ] El relé se activa con nivel bajo (lo normal). Si al arrancar la bomba queda encendida y se apaga
      cuando debería encenderse, cambia `RELE_BOMBA_ACTIVO_EN_BAJO` a `false` (o mueve el jumper
      High/Low del módulo, si lo tiene).

## Calibración del HR202

El HR202 no viene calibrado de fábrica: el porcentaje que calcula el firmware es una aproximación
entre dos puntos que tú defines.

1. Carga el firmware y abre el monitor serie a **9600 baudios**.
2. Deja el sensor al aire en un sitio seco unos minutos y anota el valor de `hum_adc`.
   Ese valor va en `HR202_ADC_AIRE_SECO`.
3. Mete el sensor en un recipiente cerrado con una toalla de papel mojada (sin tocar el agua)
   durante 10 minutos y anota `hum_adc`. Ese valor va en `HR202_ADC_AIRE_HUMEDO`.
4. Vuelve a cargar el firmware. Ahora `hum_pct` debe moverse entre ~0 % (seco) y ~100 % (muy húmedo).

**Potenciómetro azul (DO):** gíralo hasta que el LED de señal del módulo cambie justo en la humedad
que consideres "alta". Si tu módulo **no tiene pin AO**, el sistema funciona solo con DO: pon
`HR202_USAR_SALIDA_ANALOGICA = false` y el potenciómetro será el único límite (por encima = ALTA,
por debajo = BAJA).

## Prueba rápida de cada parte

| Qué probar | Cómo | Qué debe pasar |
|---|---|---|
| Temperatura | Sostén la punta del DS18B20 en la mano (o baja `TEMP_MAX_C` a 27 para probar) | `temp_c` sube; por encima del umbral el ventilador arranca |
| Humedad alta | Sopla sobre el HR202 | LED azul + ventilador |
| Humedad baja | Aleja el sensor de fuentes de humedad o ajusta `HUMEDAD_MIN_PCT` | LED rojo + pulso de 5 s de la bomba cada ~1 min |
| Falla de sensor | Desconecta el cable de datos del DS18B20 | LEDs rojo y azul parpadean alternados, ventilador encendido |
