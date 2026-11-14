#ifndef GREENHOUSE_CONFIG_H
#define GREENHOUSE_CONFIG_H

// =====================================================================
//  Configuración del invernadero
//  Todo lo que normalmente se ajusta (pines, umbrales, tiempos) está aquí,
//  para no tener que tocar la lógica en GreenhouseCore.hpp.
// =====================================================================

#include <Arduino.h>

// ---------------------------------------------------------------------
//  Pines (Arduino Uno R3)
// ---------------------------------------------------------------------
const uint8_t PIN_DS18B20          = 2;   // Datos del DS18B20 (cable amarillo/blanco) + resistencia 4.7 kΩ a 5V
const uint8_t PIN_HR202_DO         = 3;   // Salida digital del módulo HR202 (comparador LM393)
const uint8_t PIN_HR202_AO         = A0;  // Salida analógica del módulo HR202 (si tu módulo la tiene)
const uint8_t PIN_LED_HUMEDAD_BAJA = 5;   // LED rojo  + resistencia 220 Ω
const uint8_t PIN_LED_HUMEDAD_ALTA = 6;   // LED azul  + resistencia 220 Ω
const uint8_t PIN_RELE_BOMBA       = 7;   // IN del módulo relé de la bomba
const uint8_t PIN_RELE_VENTILADOR  = 8;   // IN del relé (o transistor) del ventilador
const uint8_t PIN_LED_ESTADO       = LED_BUILTIN; // LED de la placa (pin 13): parpadea = sistema vivo

// ---------------------------------------------------------------------
//  Lógica eléctrica de los actuadores
// ---------------------------------------------------------------------
// Los módulos relé con optoacoplador casi siempre se activan con nivel BAJO
// (IN = LOW -> relé encendido). Si el tuyo se activa con ALTO, pon false.
const bool RELE_BOMBA_ACTIVO_EN_BAJO      = true;
// Si el ventilador va por un segundo módulo relé igual: true.
// Si va por un transistor NPN (2N2222 / TIP120): false.
const bool RELE_VENTILADOR_ACTIVO_EN_BAJO = true;

// ---------------------------------------------------------------------
//  Sensor de humedad HR202
// ---------------------------------------------------------------------
// true  -> se usa la salida analógica AO (permite distinguir BAJA / NORMAL / ALTA).
// false -> solo se usa DO: el potenciómetro azul del módulo marca el límite
//          y el sistema solo distingue BAJA / ALTA.
const bool HR202_USAR_SALIDA_ANALOGICA = true;
// En la mayoría de módulos LM393, DO se pone en LOW cuando se supera el umbral
// (y se enciende su LED de señal). Compruébalo soplando sobre el sensor.
const bool HR202_DO_ACTIVO_EN_BAJO     = true;
// Calibración de AO (ver docs: hardware/circuits/conexiones.md -> Calibración).
// Lectura del ADC (0-1023) con aire seco y con aire muy húmedo.
// El orden no importa: si el valor sube o baja con la humedad, el mapeo lo resuelve.
const int HR202_ADC_AIRE_SECO   = 900;
const int HR202_ADC_AIRE_HUMEDO = 350;

// ---------------------------------------------------------------------
//  Umbrales de control
// ---------------------------------------------------------------------
const float TEMP_MAX_C              = 30.0f; // Por encima: ventilar
const float TEMP_HISTERESIS_C       = 2.0f;  // Deja de ventilar por debajo de TEMP_MAX_C - histéresis
const float HUMEDAD_MIN_PCT         = 40.0f; // Por debajo: humedad BAJA -> LED rojo + aspersor
const float HUMEDAD_MAX_PCT         = 80.0f; // Por encima: humedad ALTA -> LED azul + ventilador
const float HUMEDAD_HISTERESIS_PCT  = 5.0f;

// ---------------------------------------------------------------------
//  Bomba / aspersor
// ---------------------------------------------------------------------
// El fabricante indica uso en lapsos cortos: no más de 20 min por hora.
const unsigned long BOMBA_PULSO_MS          = 5000UL;            // Cada riego dura 5 s
const unsigned long BOMBA_PAUSA_MIN_MS      = 60000UL;           // Espera 1 min entre pulsos para que la humedad se estabilice
const unsigned long BOMBA_MAX_MS_POR_HORA   = 15UL * 60UL * 1000UL; // 15 min/h (margen bajo el límite de 20 min/h)
const unsigned long VENTANA_HORA_MS         = 60UL * 60UL * 1000UL;

// ---------------------------------------------------------------------
//  Tiempos generales
// ---------------------------------------------------------------------
const unsigned long VELOCIDAD_SERIE         = 9600UL;
const unsigned long INTERVALO_MUESTREO_MS   = 2000UL;  // Cada cuánto se leen sensores y se decide
const unsigned long PERIODO_PARPADEO_MS     = 500UL;   // Parpadeo de LEDs en caso de falla
const uint8_t       RESOLUCION_DS18B20_BITS = 12;      // 12 bits = 0.0625 °C, conversión de 750 ms

#endif // GREENHOUSE_CONFIG_H
