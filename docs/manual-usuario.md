# Manual de usuario

## Puesta en marcha

Con el tanque lleno y la bomba sumergida, el invernadero se enciende al conectar el cable USB del Arduino a un computador o a un cargador de celular de 5 V y 1 A. Al arrancar:

- el zumbador da un pitido corto;
- la pantalla muestra «Invernadero IoT» y la versión del firmware;
- a los 2 s aparecen las primeras lecturas, y el LED de la placa (D13) parpadea en cada lectura.

El sistema trabaja solo. El computador se usa para ver gráficas e historial, cambiar ajustes y calibrar.

## Indicadores

### Pantalla

Alterna dos páginas cada 4 s.

| Página 1 | Página 2 |
|---|---|
| `T:24.5C  HR:OK`: temperatura y humedad del aire (`OK` o `ALTA`) | Estado general, por ejemplo `SUELO SECO` |
| `S:48% Agua:OK`: humedad del suelo y tanque | `V:0 B:1    14:30`: ventilador, bomba y hora |

`S:--` indica que la sonda de suelo está desactivada en `Config.h`, y `S:??` que no toca tierra o tiene un cable suelto.

### LEDs

| LED | Significado |
|---|---|
| Rojo encendido | Suelo seco: el sistema está regando |
| Rojo intermitente | Tanque vacío |
| Azul encendido | Aire húmedo: el sistema está ventilando |
| Rojo y azul alternando | El sensor de temperatura no responde |
| Ambos apagados | Condiciones normales |

El módulo HR202 tiene además su propio LED verde, que se enciende junto con el LED azul cuando la humedad supera su umbral.

### Zumbador

- **Un pitido corto:** arranque, o riego manual aceptado.
- **Dos pitidos:** riego manual rechazado porque el tanque está vacío.
- **Tres pitidos cada 30 s:** alarma por tanque vacío, temperatura crítica o sensor de temperatura sin respuesta.

## Pulsador

- **Pulsación corta:** un pulso de riego de 5 s, aunque la tierra no esté seca. No funciona con el tanque vacío.
- **Pulsación corta con la alarma sonando:** silencia la alarma 10 minutos.
- **Pulsación de 3 s:** silencia la alarma 10 minutos.

## Aplicación de monitoreo

La aplicación se abre en **Google Chrome o Microsoft Edge**, que son los navegadores con acceso al puerto USB. Se abre el archivo `app/dist/index.html` o la dirección de GitHub Pages del proyecto. Con el ícono de instalar de la barra de direcciones queda como aplicación de escritorio y abre sin internet.

**Conectar:** el botón **Conectar Arduino** muestra los puertos disponibles; el del Arduino suele llamarse «USB-SERIAL CH340». El Arduino se reinicia al abrir el puerto, así que las lecturas tardan unos segundos. Al conectarse, la aplicación pone en hora el reloj del invernadero. Solo un programa a la vez puede usar el puerto: si aparece ocupado, hay que cerrar el Monitor Serie del Arduino IDE.

**Demostración:** sin el Arduino, **Demostración** inicia un simulador que habla el mismo protocolo. Corre a velocidad real o ×20 y tiene un botón para rellenar el tanque. Sus datos se guardan aparte de los reales.

### Pestañas

| Pestaña | Contenido |
|---|---|
| En vivo | Temperatura y humedad del suelo de los últimos 30 min, y franjas de bomba, ventilador y aire húmedo |
| Historial | Hoy, 7 días o 30 días: estadísticas, gráficas por minuto y resumen diario. Exportación a CSV |
| Eventos | Cambios de estado, riegos, ventilador, aire húmedo, alarmas, comandos y conexiones |
| Ajustes | Umbrales de temperatura y suelo, y botón para poner en hora el reloj |
| Calibración | Sonda de suelo y sonda del tanque, con la lectura cruda en vivo |
| Consola | Comandos escritos a mano y todas las líneas que envía el Arduino |

El historial se llena mientras la aplicación está conectada. Guarda las lecturas detalladas de los últimos 2 días y un resumen por minuto de los últimos 180 días. Los CSV usan punto y coma y coma decimal, el formato que espera Excel en español.

## Ajustes

Se cambian en la pestaña **Ajustes** o con comandos en la consola ([protocolo serie](protocolo-serie.md)). Quedan guardados en la EEPROM del Arduino.

| Para… | Comando |
|---|---|
| Ventilar desde 28 °C | `TEMP 28` |
| Activar la alarma desde 33 °C | `TEMPCRIT 33` |
| Regar cuando la tierra baje de 35 % | `SUELOMIN 35` |
| Poner la hora | `HORA 14:30` |
| Volver a los valores de fábrica | `FABRICA` |

El umbral de humedad del aire se ajusta con el potenciómetro azul del módulo HR202: en sentido horario el umbral sube. El momento en que el contacto se cierra se ve en el LED verde del módulo y en el LED azul del invernadero.

## Calibración

Cada sonda casera conduce distinto según la tierra, el agua y los electrodos, por eso se calibran una vez instaladas. La pestaña **Calibración** tiene un botón para cada punto.

| Punto | Condición | Comando |
|---|---|---|
| Suelo seco | Clavos en tierra seca | `CAL SUELOSECO` |
| Suelo húmedo | La misma tierra recién regada, tras un minuto | `CAL SUELOHUMEDO` |
| Tanque | Los dos cables de la sonda dentro del agua | `CAL TANQUE` |

Las lecturas crudas (0–1023) se ven en los campos `adc_suelo` y `adc_agua` de la consola.

## Pruebas de funcionamiento

| Prueba | Acción | Resultado esperado |
|---|---|---|
| Temperatura | Sostener la punta del DS18B20 en la mano, o enviar `TEMP 26` | La temperatura sube; sobre el límite arranca el ventilador |
| Humedad del aire | Exhalar sobre el sensor del HR202 | LED verde del módulo, LED azul y ventilador tras unos 6 s |
| Suelo seco | Sacar los clavos de la tierra húmeda y ponerlos en tierra seca | LED rojo y pulsos de riego |
| Tanque vacío | Sacar del agua los cables de la sonda | LED rojo intermitente, alarma y bomba bloqueada |
| Pulsador | Pulsación corta | Riego de 5 s |
| Falla de sensor | Desconectar el cable amarillo del DS18B20 | LEDs alternados, ventilador encendido y alarma |
| Energía | Suelo seco y calor a la vez | La bomba riega y el ventilador se pausa durante el pulso |

## Mantenimiento

- **Tanque:** rellenarlo antes de que se vacíe. La bomba no debe trabajar en seco.
- **Clavos de la sonda de suelo:** limpiarlos con lija fina cada 2 o 3 semanas, o cuando la lectura cambie sin motivo.
- **Cables de la sonda del tanque:** revisar que no tengan óxido.
- **Después de un corte de energía:** reconectar la aplicación o usar `HORA` para que la pantalla muestre la hora correcta.

## Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| La temperatura aparece como `--` | El DS18B20 no responde | Revisar el cable amarillo en D2 y la resistencia de 4.7 kΩ entre D2 y 5 V |
| La humedad del aire nunca pasa a alta | Umbral del HR202 muy alto o contacto mal cableado | Girar el potenciómetro en sentido antihorario; revisar COM a GND y NO a D3 |
| La humedad del aire siempre está alta | Umbral muy bajo o cable en NC | Girar el potenciómetro en sentido horario; el cable de D3 va en NO |
| Siempre indica «Tanque vacío» | Sonda fuera del agua o sin calibrar | Sumergir los cables y usar `CAL TANQUE` |
| El Arduino se reinicia al arrancar la bomba | El puerto USB no entrega la corriente | Usar un cargador de 5 V y 2 A |
| La pantalla no muestra nada | Contraste o dirección I2C | Girar el potenciómetro azul del módulo I2C; el mensaje de arranque indica si se detectó |
| La aplicación no muestra el puerto | Navegador o controlador | Usar Chrome o Edge, instalar el controlador CH340 y cerrar el Monitor Serie |
| La hora de la pantalla está mal | Reloj sin sincronizar | Conectar la aplicación o enviar `HORA hh:mm` |
