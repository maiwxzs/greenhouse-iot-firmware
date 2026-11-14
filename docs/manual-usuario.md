# Manual de usuario

## Encender el sistema

1. Llena el tanque con agua y comprueba que la bomba quede sumergida.
2. Conecta el Arduino por USB al computador o a un cargador de celular de 5 V / 1 A.
3. El zumbador da un pitido corto y la pantalla muestra «Invernadero IoT».
4. A los 2 segundos aparecen las primeras lecturas. El LED de la placa (pin 13) parpadea en cada lectura: eso indica que el sistema está funcionando.

El sistema trabaja solo. El computador solo hace falta para ver gráficas, cambiar ajustes o descargar datos.

## Qué indica cada cosa

### Pantalla

Alterna dos páginas cada 4 segundos.

| Página 1 | Página 2 |
|---|---|
| `T:24.5C HA:55%` temperatura y humedad del aire | Estado general, por ejemplo `SUELO SECO` |
| `S:48% Agua:OK` humedad del suelo y tanque | `V0 B1 L0   14:30` ventilador, bomba, luz y hora |

`S:--` significa que la sonda de suelo está desactivada en `Config.h`; `S:??`, que no toca tierra o tiene un cable suelto.

### LEDs

| LED | Significado |
|---|---|
| Rojo encendido | Humedad baja (aire o suelo): está regando |
| Rojo parpadeando rápido | El tanque está vacío |
| Azul encendido | Aire muy húmedo: está ventilando |
| Rojo y azul alternando | El sensor de temperatura no responde |
| Ambos apagados | Todo en orden |

### Zumbador

- **Un pitido corto:** el sistema arrancó, o se aceptó un riego manual.
- **Tres pitidos, cada 30 segundos:** alarma. Puede ser tanque vacío, temperatura crítica o sensor de temperatura desconectado.

## Pulsador

- **Pulsación corta:** riega 5 segundos, aunque la tierra no esté seca. No funciona si el tanque está vacío.
- **Si la alarma está sonando:** una pulsación corta la silencia durante 10 minutos.
- **Mantener 3 segundos:** silencia la alarma durante 10 minutos.

## Dashboard web

El dashboard muestra todo en el computador: lecturas, un dibujo del invernadero que se anima según lo que esté funcionando, gráficas, ajustes y calibración.

1. Abre `dashboard/index.html` con **Google Chrome o Microsoft Edge** (Firefox y Safari no pueden usar el puerto USB). También puedes abrirlo desde GitHub Pages si el equipo lo activó (ver el README).
2. Pulsa **Conectar Arduino** y elige el puerto. Suele llamarse «USB-SERIAL CH340».
3. Espera unos segundos: el Arduino se reinicia al conectarse. El dashboard le pone la hora del computador de forma automática.

Si el puerto aparece ocupado, cierra el Monitor Serie del Arduino IDE: solo un programa a la vez puede usar el puerto.

Sin el Arduino a mano, **Probar sin Arduino** muestra el dashboard con datos simulados. Sirve para practicar la presentación. En ese modo, los comandos `AGUA NO` y `AGUA SI` simulan el tanque vacío o lleno.

**Descargar datos (CSV)** guarda todas las lecturas de la sesión (hasta 4 horas). El archivo usa punto y coma y coma decimal, así que se abre bien en Excel en español.

## Cambiar los ajustes

Desde el dashboard (sección **Ajustes**) o escribiendo comandos en el Monitor Serie (9600 baudios, «Nueva línea»). La lista completa está en el [protocolo serie](protocolo-serie.md).

| Para… | Comando |
|---|---|
| Ventilar desde 28 °C | `TEMP 28` |
| Considerar seco el aire bajo 45 % | `HUMMIN 45` |
| Regar cuando la tierra baje de 35 % | `SUELOMIN 35` |
| Luz de 7:00 a 19:00 | `LUZ 7 19` |
| Luz siempre encendida | `LUZ ON` |
| Poner la hora | `HORA 14:30` |
| Volver a la configuración original | `FABRICA` |

Los ajustes se guardan en el Arduino y no se pierden al desconectarlo.

## Calibrar los sensores

Hazlo una vez, con todo armado. En el dashboard hay un botón para cada paso; también puedes usar los comandos.

1. **Aire seco:** deja el HR202 unos minutos al aire en un sitio seco. Luego, `CAL AIRESECO`.
2. **Aire húmedo:** mete el HR202 en un frasco cerrado con una toalla de papel mojada, sin que la toque, durante 10 minutos. Luego, `CAL AIREHUMEDO`.
3. **Suelo seco:** clava los dos clavos en tierra seca. Luego, `CAL SUELOSECO`.
4. **Suelo húmedo:** riega bien esa tierra y espera un minuto. Luego, `CAL SUELOHUMEDO`.
5. **Tanque:** con los dos cables de la sonda **dentro del agua**, `CAL TANQUE`.

Para revisar los valores crudos, mira los campos `adc_aire`, `adc_suelo` y `adc_agua` en la consola.

## Probar cada parte

| Qué probar | Cómo | Qué debe pasar |
|---|---|---|
| Temperatura | Sostén la punta del DS18B20 en la mano, o pon `TEMP 26` | La temperatura sube; sobre el límite arranca el ventilador |
| Humedad alta | Sopla sobre el HR202 | LED azul y ventilador |
| Suelo seco | Saca los clavos de la tierra y júntalos en un vaso con tierra seca | LED rojo y pulsos de riego |
| Tanque vacío | Saca del agua los cables de la sonda | LED rojo parpadea, alarma, la bomba no arranca |
| Pulsador | Pulsación corta | Riego de 5 segundos |
| Falla de sensor | Desconecta el cable amarillo del DS18B20 | LEDs alternados, ventilador encendido, alarma |
| Luz | `HORA 12:00` y luego `HORA 20:00` | Encendida y luego apagada (horario de 6 a 18) |

## Mantenimiento

- **Tanque:** rellénalo antes de que se vacíe. La bomba no debe trabajar en seco.
- **Clavos de la sonda de suelo:** límpialos con una lija fina cada 2 o 3 semanas, o cuando las lecturas empiecen a cambiar sin motivo.
- **Cables de la sonda del tanque:** revisa que no tengan óxido.
- **Después de un corte de energía:** reconecta el dashboard o usa `HORA` para que la luz siga el horario correcto.

## Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| La temperatura sale `--` o `null` | El DS18B20 no responde | Revisa el cable amarillo en D2 y la resistencia de 4.7 kΩ entre D2 y 5 V |
| La humedad del aire no cambia | Sin calibrar o AO desconectado | Revisa el cable AO→A0 y calibra |
| Siempre dice «SIN AGUA» | Sonda del tanque fuera del agua o umbral mal calibrado | Mete los cables al agua y usa `CAL TANQUE`. Si no usas la sonda, pon `USAR_SONDA_NIVEL_AGUA = false` en `Config.h` |
| El Arduino se reinicia cuando arranca la bomba | No alcanza la corriente del USB | Usa un cargador de 5 V / 2 A o alimenta las cargas aparte (ver [conexiones](../hardware/circuits/conexiones.md)) |
| La bomba se enciende al revés (encendida cuando debería estar apagada) | El relé se activa con nivel alto | Pon `RELES_ACTIVOS_EN_BAJO = false` en `Config.h`, o mueve el jumper del módulo |
| La pantalla no muestra nada | Contraste o dirección I2C | Gira el potenciómetro azul de atrás del módulo I2C. Al arrancar, el monitor serie dice si se detectó |
| La pantalla muestra cuadros | Contraste demasiado alto | Gira el potenciómetro del módulo I2C |
| El dashboard no ve el puerto | Navegador o driver | Usa Chrome o Edge, instala el driver CH340 y cierra el Monitor Serie |
| La luz no sigue el horario | Reloj sin poner en hora | Conecta el dashboard o usa `HORA hh:mm` |
