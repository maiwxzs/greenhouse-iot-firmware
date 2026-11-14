#ifndef GREENHOUSE_CONFIG_H
#define GREENHOUSE_CONFIG_H

// =====================================================================
//  Configuración del invernadero
//
//  Aquí está todo lo que normalmente se ajusta: pines, qué partes están
//  instaladas y los valores de fábrica. Los umbrales también se pueden
//  cambiar sin reprogramar, con comandos por el puerto serie o desde el
//  dashboard (se guardan en la EEPROM). Ver docs/protocolo-serie.md.
// =====================================================================

#include <Arduino.h>

// ---------------------------------------------------------------------
//  ¿Qué partes están conectadas?
//  Si una parte no está instalada, pon false (o 0) para que no se use.
// ---------------------------------------------------------------------
#ifndef USAR_LCD
#define USAR_LCD 1                               // Pantalla LCD 16x2 I2C (1 = sí, 0 = no). Requiere la librería LiquidCrystal_I2C.
#endif
const bool USAR_SONDA_SUELO      = true;         // Sonda de humedad de suelo hecha con dos clavos
const bool USAR_SONDA_NIVEL_AGUA = true;         // Sonda de nivel del tanque hecha con dos cables
const bool USAR_LUZ              = true;         // Luz de cultivo en el tercer relé
const bool USAR_ZUMBADOR         = true;         // Zumbador (buzzer) de alarma
const bool USAR_BOTON            = true;         // Pulsador de riego manual

// ---------------------------------------------------------------------
//  Pines (Arduino Uno R3)
// ---------------------------------------------------------------------
const uint8_t PIN_DS18B20          = 2;   // Datos del DS18B20 + resistencia 4.7 kΩ a 5V
const uint8_t PIN_HR202_DO         = 3;   // Salida digital del módulo HR202
const uint8_t PIN_BOTON            = 4;   // Pulsador (la otra pata a GND)
const uint8_t PIN_LED_HUMEDAD_BAJA = 5;   // LED rojo  + 220 Ω
const uint8_t PIN_LED_HUMEDAD_ALTA = 6;   // LED azul  + 220 Ω
const uint8_t PIN_RELE_BOMBA       = 7;   // IN del relé 1
const uint8_t PIN_RELE_VENTILADOR  = 8;   // IN del relé 2
const uint8_t PIN_RELE_LUZ         = 9;   // IN del relé 3
const uint8_t PIN_ZUMBADOR         = 10;  // + del zumbador (el − a GND)
const uint8_t PIN_LED_ESTADO       = LED_BUILTIN; // LED de la placa (pin 13): parpadea = sistema vivo
const uint8_t PIN_HR202_AO         = A0;  // Salida analógica del HR202
const uint8_t PIN_SONDA_SUELO      = A1;  // Un clavo a A1, el otro a GND
const uint8_t PIN_SONDA_AGUA       = A2;  // Un cable a A2, el otro a GND (ambos dentro del tanque)
// La pantalla LCD I2C va a A4 (SDA) y A5 (SCL).

// ---------------------------------------------------------------------
//  Lógica eléctrica
// ---------------------------------------------------------------------
const bool RELES_ACTIVOS_EN_BAJO    = true;   // Módulos con optoacoplador: IN = LOW enciende el relé
const bool HR202_USAR_SALIDA_ANALOGICA = true; // false si tu módulo HR202 solo tiene 3 pines (sin AO)
const bool HR202_DO_ACTIVO_EN_BAJO  = true;   // DO = LOW cuando se supera el umbral del potenciómetro
const bool ZUMBADOR_PASIVO          = false;  // true si es un zumbador pasivo (necesita tono)

// ---------------------------------------------------------------------
//  Alimentación
// ---------------------------------------------------------------------
// true  -> TODO se alimenta desde el USB del Arduino. Solo una carga grande
//          (bomba, ventilador o luz) funciona a la vez, con prioridad
//          bomba > ventilador > luz, para no pasar de 500 mA.
// false -> bomba, ventilador y luz con fuente externa: pueden ir a la vez.
const bool ALIMENTACION_SOLO_ARDUINO = true;

// ---------------------------------------------------------------------
//  Valores de fábrica (se pueden cambiar luego por comandos)
// ---------------------------------------------------------------------
const float FABRICA_TEMP_MAX_C          = 30.0f;  // Por encima: ventilar
const float FABRICA_TEMP_HISTERESIS_C   = 2.0f;   // Deja de ventilar 2 °C por debajo
const float FABRICA_TEMP_CRITICA_C      = 35.0f;  // Por encima: alarma
const float FABRICA_HUM_AIRE_MIN        = 40.0f;  // % aire: por debajo -> BAJA (LED rojo + aspersor)
const float FABRICA_HUM_AIRE_MAX        = 80.0f;  // % aire: por encima -> ALTA (LED azul + ventilador)
const float FABRICA_HUM_SUELO_MIN       = 30.0f;  // % suelo: por debajo -> SECO (riego)
const float FABRICA_HUM_SUELO_MAX       = 85.0f;  // % suelo: por encima -> ENCHARCADO (no se riega)
const float FABRICA_HISTERESIS_PCT      = 5.0f;
const int   FABRICA_ADC_AIRE_SECO       = 900;    // Calibración HR202 (comando CAL AIRESECO / AIREHUMEDO)
const int   FABRICA_ADC_AIRE_HUMEDO     = 350;
const int   FABRICA_ADC_SUELO_SECO      = 1000;   // Calibración sonda de suelo (CAL SUELOSECO / SUELOHUMEDO)
const int   FABRICA_ADC_SUELO_HUMEDO    = 250;
const int   FABRICA_ADC_UMBRAL_AGUA     = 700;    // Sonda del tanque: por debajo = hay agua (CAL TANQUE)
const uint8_t FABRICA_LUZ_HORA_INICIO   = 6;      // Luz encendida de 6:00...
const uint8_t FABRICA_LUZ_HORA_FIN      = 18;     // ...a 18:00
const uint8_t HORA_AL_ARRANCAR          = 8;      // Hora que asume el reloj al encender (sin sincronizar)

// ---------------------------------------------------------------------
//  Bomba / aspersor
// ---------------------------------------------------------------------
// El fabricante indica uso en lapsos cortos: no más de 20 min por hora.
const unsigned long BOMBA_PULSO_MS        = 5000UL;                 // Cada riego dura 5 s
const unsigned long BOMBA_PAUSA_MIN_MS    = 60000UL;                // 1 min entre pulsos
const unsigned long BOMBA_MAX_MS_POR_HORA = 15UL * 60UL * 1000UL;   // 15 min/h (bajo el límite de 20)
const unsigned long VENTANA_HORA_MS       = 60UL * 60UL * 1000UL;

// ---------------------------------------------------------------------
//  Sondas resistivas (suelo y tanque)
// ---------------------------------------------------------------------
// Por encima de este valor se considera que la sonda de suelo está al aire
// o desconectada (lectura no válida). Así un cable suelto no provoca riego.
const int SONDA_SUELO_ADC_DESCONECTADA = 1015;

// ---------------------------------------------------------------------
//  Tiempos generales
// ---------------------------------------------------------------------
const unsigned long VELOCIDAD_SERIE         = 9600UL;
const unsigned long INTERVALO_MUESTREO_MS   = 2000UL;  // Lectura de sensores y decisión
const unsigned long PERIODO_PARPADEO_MS     = 500UL;
const unsigned long CAMBIO_PAGINA_LCD_MS    = 4000UL;  // La pantalla alterna entre 2 páginas
const unsigned long BOTON_PULSACION_LARGA_MS= 3000UL;  // Mantener 3 s: silenciar alarma
const unsigned long SILENCIO_ALARMA_MS      = 10UL * 60UL * 1000UL; // 10 min
const unsigned long REPETIR_ALARMA_MS       = 30000UL; // La alarma pita cada 30 s
const uint8_t       RESOLUCION_DS18B20_BITS = 12;      // 12 bits = 0.0625 °C, 750 ms por lectura

#endif // GREENHOUSE_CONFIG_H
