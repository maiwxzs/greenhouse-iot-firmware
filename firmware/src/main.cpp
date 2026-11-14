// =====================================================================
//  Smart Greenhouse IoT — Punto de entrada (setup / loop)
//
//  Hardware: Arduino Uno R3, DS18B20 (temperatura), módulo HR202
//  (humedad del aire), 2 LEDs, mini bomba sumergible (aspersor) y
//  mini ventilador 5V, ambos a través de módulos relé.
//  Conexiones: hardware/circuits/conexiones.md
//  Ajustes (pines, umbrales, tiempos): include/Config.h
// =====================================================================

#include <Arduino.h>
#include "Config.h"
#include "GreenhouseCore.hpp"

// --- Sensores ---
SensorTemperatura sensorTemperatura(PIN_DS18B20);
SensorHumedad     sensorHumedad(PIN_HR202_DO, PIN_HR202_AO);

// --- Actuadores ---
IndicadorLED ledHumedadBaja(PIN_LED_HUMEDAD_BAJA, "rojo");
IndicadorLED ledHumedadAlta(PIN_LED_HUMEDAD_ALTA, "azul");
IndicadorLED ledEstado(PIN_LED_ESTADO, "placa");
BombaAgua    bomba(PIN_RELE_BOMBA, RELE_BOMBA_ACTIVO_EN_BAJO);
Ventilador   ventilador(PIN_RELE_VENTILADOR, RELE_VENTILADOR_ACTIVO_EN_BAJO);

// --- Reglas y control ---
ReglaControl regla(TEMP_MAX_C, TEMP_HISTERESIS_C,
                   HUMEDAD_MIN_PCT, HUMEDAD_MAX_PCT, HUMEDAD_HISTERESIS_PCT);

ControladorArduino controlador(sensorTemperatura, sensorHumedad,
                               ventilador, bomba,
                               ledHumedadBaja, ledHumedadAlta, ledEstado,
                               regla);

Invernadero invernadero("INV-01", "Invernadero piloto");

void setup() {
    invernadero.asignarControlador(&controlador);
    invernadero.iniciarSistema();
}

void loop() {
    invernadero.monitorear(millis());
}
