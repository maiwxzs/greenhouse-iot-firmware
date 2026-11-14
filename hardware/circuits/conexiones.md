# Conexiones — Arduino Uno R3

Todos los pines se pueden cambiar en `firmware/include/Config.h`.

## Tabla de pines

| Componente | Pin del componente | Va a | Notas |
|---|---|---|---|
| **DS18B20** (temperatura) | Rojo (VCC) | 5V | |
| | Negro (GND) | GND | |
| | Amarillo o blanco (DATA) | **D2** | **Resistencia de 4.7 kΩ entre DATA y 5V** (obligatoria; con este cable de 1 m también sirve una de 10 kΩ) |
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

Se usan **2 de tus 3 relés** (el tercero queda de repuesto). Cada relé es un interruptor en el
cable positivo del motor. Usa siempre el borne **NO** (normalmente abierto): si el Arduino se
apaga o se reinicia, la bomba queda apagada.

### Opción A — Todo desde el Arduino (configuración por defecto)

No hace falta fuente externa. El 5V que alimenta los motores sale del propio Arduino:

```
 Arduino 5V ──┬──> COM [Relé 1] NO ──> (+) Bomba      (−) ──┐
              │                                             │
              └──> COM [Relé 2] NO ──> (+) Ventilador (−) ──┤
                                                            │
 Arduino GND <──────────────────────────────────────────────┘
```

Condiciones para que funcione:

1. **El Arduino se alimenta por el cable USB** (computador o cargador de celular de 5V / 1A).
   No uses una batería de 9V ni el conector redondo: el regulador interno se calienta.
2. En `Config.h` debe estar `ALIMENTACION_SOLO_ARDUINO = true` (ya viene así). Con esto el
   ventilador se pausa los 5 segundos que dura cada riego, para no sumar los dos motores.

Por qué alcanza: el USB del Arduino entrega hasta 500 mA. Consumo aproximado con la bomba regando:

| Parte | Corriente aprox. |
|---|---|
| Arduino | 50 mA |
| Bobina de un relé | 70 mA |
| Bomba (este modelo suele consumir 130–220 mA a 5V) | 220 mA |
| 2 LEDs con 220 Ω | 30 mA |
| Sensores | 10 mA |
| **Total** | **≈ 380 mA** |

Bomba + ventilador + dos relés a la vez pasarían de 500 mA; por eso el firmware nunca los enciende juntos.

**Señal de que no alcanza:** si en el monitor serie vuelve a aparecer
`# Smart Greenhouse IoT - firmware iniciado` justo cuando arranca la bomba, el Arduino se está
reiniciando por falta de corriente. En ese caso pasa a la opción B.

### Opción B — Con fuente externa (solo si la A da problemas)

Igual que el dibujo de arriba, pero en lugar de "Arduino 5V" y "Arduino GND" usas el + y el − de
un cargador de celular de 5V con el cable cortado. Pon `ALIMENTACION_SOLO_ARDUINO = false` y la
bomba y el ventilador podrán funcionar a la vez.

### Recomendado en ambas opciones

- **Diodo 1N4007** en paralelo con la bomba y con el ventilador (franja del diodo hacia el +).
  Absorbe el pico de voltaje del motor al apagarse y alarga la vida del relé. Si no tienes, funciona
  igual, pero conviene ponerlo cuando puedas.

## Comprobaciones antes de energizar

- [ ] La resistencia de 4.7 kΩ (o 10 kΩ) del DS18B20 está entre DATA y 5V.
- [ ] Cada LED tiene su resistencia de 220 Ω en serie.
- [ ] Los motores pasan por el borne **NO** de su relé, nunca directo a un pin del Arduino.
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
