# Protocolo serie

El Arduino y el computador se comunican por el cable USB a **9600 baudios**, con una línea de texto por mensaje (terminada en salto de línea). Lo usan el dashboard web, el Monitor Serie del Arduino IDE y cualquier otro programa que quiera leer los datos.

- **Del Arduino al computador:**
  - Las líneas que empiezan por `{` son JSON.
  - Las que empiezan por `#` son mensajes para personas.
- **Del computador al Arduino:** comandos de texto, en mayúsculas o minúsculas.

## Comandos

En el Monitor Serie del Arduino IDE, elige **9600 baudios** y **«Nueva línea»** como final de línea.

| Comando | Qué hace | Ejemplo |
|---|---|---|
| `AYUDA` o `?` | Lista los comandos | `AYUDA` |
| `ESTADO` | Envía la configuración actual (línea `cfg`) | `ESTADO` |
| `TEMP valor` | Temperatura a la que empieza a ventilar (°C) | `TEMP 28` |
| `TEMPCRIT valor` | Temperatura de alarma (°C); debe ser mayor o igual que `TEMP` | `TEMPCRIT 35` |
| `TEMPHIST valor` | Histéresis de temperatura (°C, de 0.1 a 10) | `TEMPHIST 2` |
| `HUMMIN valor` | Humedad del aire por debajo de la cual es BAJA (%) | `HUMMIN 40` |
| `HUMMAX valor` | Humedad del aire por encima de la cual es ALTA (%) | `HUMMAX 80` |
| `SUELOMIN valor` | Humedad del suelo por debajo de la cual está SECO (%) | `SUELOMIN 30` |
| `SUELOMAX valor` | Humedad del suelo por encima de la cual está ENCHARCADO (%) | `SUELOMAX 85` |
| `HIST valor` | Histéresis de humedad, para aire y suelo (%, de 0 a 30) | `HIST 5` |
| `LUZ inicio fin` | Horario de la luz (horas 0–23); puede cruzar la medianoche | `LUZ 6 18`, `LUZ 20 6` |
| `LUZ ON` / `LUZ OFF` / `LUZ AUTO` | Luz siempre encendida, siempre apagada o según el horario | `LUZ AUTO` |
| `HORA hh:mm[:ss]` | Pone en hora el reloj interno | `HORA 14:30` |
| `RIEGO` | Un pulso de riego manual (no lo hace si el tanque está vacío) | `RIEGO` |
| `SILENCIO` | Silencia la alarma durante 10 minutos | `SILENCIO` |
| `CAL AIRESECO` | Guarda la lectura actual del HR202 como «aire seco» | `CAL AIRESECO` |
| `CAL AIREHUMEDO` | Guarda la lectura actual del HR202 como «aire húmedo» | `CAL AIREHUMEDO` |
| `CAL SUELOSECO` | Guarda la lectura actual de la sonda como «suelo seco» | `CAL SUELOSECO` |
| `CAL SUELOHUMEDO` | Guarda la lectura actual de la sonda como «suelo húmedo» | `CAL SUELOHUMEDO` |
| `CAL TANQUE` | Con los cables de la sonda **dentro del agua**, calcula el umbral del tanque | `CAL TANQUE` |
| `UMBRALAGUA valor` | Umbral de la sonda del tanque, en lectura del ADC (1–1022) | `UMBRALAGUA 700` |
| `FABRICA` | Vuelve a los valores de fábrica de `Config.h` | `FABRICA` |

Todos los cambios se validan antes de aplicarse y se guardan en la EEPROM, así que se mantienen aunque se desconecte el Arduino. Si un valor no tiene sentido (por ejemplo, `HUMMAX` menor que `HUMMIN`), el Arduino lo rechaza y deja la configuración como estaba.

## Mensajes del Arduino

### Telemetría (`tel`), cada 2 segundos

```json
{"tipo":"tel","t_ms":2000,"hora":"08:00:02","hora_sync":0,"temp_c":24.00,"hum_aire":55.1,"adc_aire":597,"do_aire":0,"hum_suelo":50.0,"adc_suelo":625,"agua":1,"adc_agua":250,"estado":"NORMAL","aire":"NORMAL","suelo":"NORMAL","ventilador":0,"bomba":0,"luz":1,"alarma":0,"bomba_s_hora":0}
```

| Campo | Tipo | Significado |
|---|---|---|
| `t_ms` | entero | Milisegundos desde que arrancó el Arduino |
| `hora` | texto | Hora del reloj interno (`hh:mm:ss`) |
| `hora_sync` | 0/1 | 1 si alguien puso la hora (comando `HORA` o el dashboard) |
| `temp_c` | número o `null` | Temperatura del DS18B20; `null` si el sensor no responde |
| `hum_aire` | número | Humedad del aire, 0–100 % (según la calibración) |
| `adc_aire` | entero o `null` | Lectura cruda de AO del HR202 (0–1023) |
| `do_aire` | 0/1 | Salida digital del HR202 (1 = supera el umbral del potenciómetro) |
| `hum_suelo` | número o `null` | Humedad del suelo; `null` si la sonda no está instalada o no toca tierra |
| `adc_suelo` | entero o `null` | Lectura cruda de la sonda de suelo |
| `agua` | 0/1 o `null` | 1 si hay agua en el tanque; `null` si la sonda no está instalada |
| `adc_agua` | entero o `null` | Lectura cruda de la sonda del tanque |
| `estado` | texto | Estado general (ver tabla de abajo) |
| `aire`, `suelo` | texto | `BAJA`, `NORMAL`, `ALTA`, `DESCONOCIDA` o `NO_USADO` |
| `ventilador`, `bomba`, `luz` | 0/1 | 1 = encendido |
| `alarma` | 0/1/2 | 0 = sin alarma, 1 = sonando, 2 = silenciada |
| `bomba_s_hora` | entero | Segundos de bomba usados en la hora actual (máximo 900) |

**Estados posibles**, de mayor a menor prioridad:

| `estado` | Significa |
|---|---|
| `FALLA_SENSOR_TEMP` | El DS18B20 no responde; el ventilador queda encendido por seguridad |
| `SIN_DATOS` | Todavía no hay lectura de humedad del aire |
| `SIN_AGUA` | El tanque está vacío; la bomba queda bloqueada |
| `TEMPERATURA_CRITICA` | La temperatura alcanzó `TEMPCRIT` |
| `TEMPERATURA_ALTA` | Hace calor; se ventila |
| `SUELO_SECO` | La tierra está seca; se riega |
| `HUMEDAD_BAJA` | El aire está seco; se nebuliza |
| `SUELO_ENCHARCADO` | La tierra tiene demasiada agua; no se riega |
| `HUMEDAD_ALTA` | El aire está muy húmedo; se ventila |
| `NORMAL` | Todo dentro del rango |

### Configuración (`cfg`)

Se envía al arrancar, con el comando `ESTADO` y después de cada cambio.

```json
{"tipo":"cfg","version":"2.0.0","temp_max":30.0,"temp_hist":2.0,"temp_crit":35.0,"hum_min":40.0,"hum_max":80.0,"suelo_min":30.0,"suelo_max":85.0,"hist":5.0,"adc_aire_seco":900,"adc_aire_hum":350,"adc_suelo_seco":1000,"adc_suelo_hum":250,"umbral_agua":700,"luz_ini":6,"luz_fin":18,"luz_modo":"AUTO","solo_arduino":1,"sonda_suelo":1,"sonda_agua":1,"usa_luz":1,"lcd":1}
```

Los últimos campos (`solo_arduino`, `sonda_suelo`, `sonda_agua`, `usa_luz`, `lcd`) indican qué partes están activadas en `Config.h` y si se detectó la pantalla.

### Respuestas a comandos

```json
{"tipo":"ok","cmd":"TEMP"}
{"tipo":"error","msg":"Valor fuera de rango"}
```

## Ejemplo de sesión

```text
> HORA 14:30
{"tipo":"ok","cmd":"HORA"}
> temp 28
{"tipo":"ok","cmd":"TEMP"}
{"tipo":"cfg","version":"2.0.0","temp_max":28.0, ...}
> HUMMAX 20
{"tipo":"error","msg":"Valor fuera de rango"}
> RIEGO
{"tipo":"ok","cmd":"RIEGO"}
```
