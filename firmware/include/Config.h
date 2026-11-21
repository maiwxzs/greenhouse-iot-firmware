#ifndef GREENHOUSE_CONFIG_H
#define GREENHOUSE_CONFIG_H

// Configuración del invernadero
//
// Pines, partes instaladas y valores de fábrica. Los umbrales también se
// cambian en funcionamiento por comandos serie o desde la aplicación de
// monitoreo; esos cambios se guardan en la EEPROM (docs/protocolo-serie.md)

#include <Arduino.h>

// Partes instaladas
#ifndef USAR_LCD
#define USAR_LCD 1                         // Pantalla LCD 16x2 I2C (requiere LiquidCrystal_I2C)
#endif
const bool USAR_SONDA_SUELO      = true;   // Sonda resistiva de humedad del suelo
const bool USAR_SONDA_NIVEL_AGUA = true;   // Sonda resistiva de nivel del tanque
const bool USAR_ZUMBADOR         = true;   // Zumbador de alarma
const bool USAR_BOTON            = true;   // Pulsador de riego manual / silencio

// Pines (Arduino Uno R3)
const uint8_t PIN_DS18B20          = 2;   // Bus 1-Wire del DS18B20 (pull-up de 4.7 kΩ a 5 V)
const uint8_t PIN_HUMEDAD_AIRE     = 3;   // Contacto NO del módulo HR202 (COM a GND)
const uint8_t PIN_BOTON            = 4;   // Pulsador a GND
const uint8_t PIN_LED_HUMEDAD_BAJA = 5;   // LED rojo, 220 Ω
const uint8_t PIN_LED_HUMEDAD_ALTA = 6;   // LED azul, 220 Ω
const uint8_t PIN_RELE_BOMBA       = 7;   // IN del relé 1
const uint8_t PIN_RELE_VENTILADOR  = 8;   // IN del relé 2
const uint8_t PIN_ZUMBADOR         = 10;  // + del zumbador
const uint8_t PIN_LED_ESTADO       = LED_BUILTIN; // D13: parpadea en cada muestra
const uint8_t PIN_SONDA_SUELO      = A1;  // Electrodo de la sonda de suelo (el otro a GND)
const uint8_t PIN_SONDA_AGUA       = A2;  // Electrodo de la sonda del tanque (el otro a GND)
// LCD I2C: A4 (SDA) y A5 (SCL)

// Lógica eléctrica
const bool RELES_ACTIVOS_EN_BAJO       = true;   // Módulos con optoacoplador: IN = LOW activa el relé
const bool HUMEDAD_CONTACTO_EN_BAJO    = true;   // Contacto cerrado (humedad alta) lleva el pin a LOW
const uint8_t HUMEDAD_MUESTRAS_ESTABLES = 3;     // Lecturas iguales seguidas para aceptar un cambio
const bool ZUMBADOR_PASIVO             = false;  // Zumbador piezoeléctrico activo 3-24 V (oscilador interno)

// Alimentación
// true: todo se alimenta desde el USB del Arduino (máx. 500 mA). Solo una
// carga grande funciona a la vez, con prioridad bomba > ventilador
const bool ALIMENTACION_SOLO_ARDUINO = true;

// Valores de fábrica
const float FABRICA_TEMP_MAX_C        = 30.0f;  // Ventilar por encima
const float FABRICA_TEMP_HISTERESIS_C = 2.0f;
const float FABRICA_TEMP_CRITICA_C    = 35.0f;  // Alarma por encima
const float FABRICA_HUM_SUELO_MIN     = 30.0f;  // % suelo: por debajo, SECO (riego)
const float FABRICA_HUM_SUELO_MAX     = 85.0f;  // % suelo: por encima, ENCHARCADO
const float FABRICA_HISTERESIS_PCT    = 5.0f;
const int   FABRICA_ADC_SUELO_SECO    = 1000;   // Calibración de la sonda de suelo
const int   FABRICA_ADC_SUELO_HUMEDO  = 250;
const int   FABRICA_ADC_UMBRAL_AGUA   = 700;    // Sonda del tanque: por debajo = hay agua
const uint8_t HORA_AL_ARRANCAR        = 8;      // Hora supuesta hasta sincronizar el reloj

// Bomba (lapsos cortos: máx. 20 min por hora según el fabricante)
const unsigned long BOMBA_PULSO_MS        = 5000UL;
const unsigned long BOMBA_PAUSA_MIN_MS    = 60000UL;
const unsigned long BOMBA_MAX_MS_POR_HORA = 15UL * 60UL * 1000UL;
const unsigned long VENTANA_HORA_MS       = 60UL * 60UL * 1000UL;

// Sondas resistivas
// Lectura igual o mayor: sonda de suelo al aire o desconectada (no válida)
const int SONDA_SUELO_ADC_DESCONECTADA = 1015;

// Tiempos
const unsigned long VELOCIDAD_SERIE          = 9600UL;
const unsigned long INTERVALO_MUESTREO_MS    = 2000UL;
const unsigned long PERIODO_PARPADEO_MS      = 500UL;
const unsigned long CAMBIO_PAGINA_LCD_MS     = 4000UL;
const unsigned long BOTON_PULSACION_LARGA_MS = 3000UL;
const unsigned long SILENCIO_ALARMA_MS       = 10UL * 60UL * 1000UL;
const unsigned long REPETIR_ALARMA_MS        = 30000UL;
const uint8_t       RESOLUCION_DS18B20_BITS  = 12;

#endif // GREENHOUSE_CONFIG_H
