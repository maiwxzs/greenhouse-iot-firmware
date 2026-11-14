// =====================================================================
//  Smart Greenhouse IoT — Punto de entrada (setup / loop)
//
//  Conexiones: hardware/circuits/conexiones.md
//  Ajustes:    include/Config.h (y por comandos: docs/protocolo-serie.md)
//  Clases:    include/GreenhouseCore.hpp  (hardware)
//             include/Logica.h            (decisiones, sin pines)
// =====================================================================

#include <Arduino.h>
#include "Config.h"
#include "Logica.h"
#include "GreenhouseCore.hpp"

// --- Ajustes (se cargan de la EEPROM al arrancar) ---
Ajustes ajustes = AlmacenAjustes::deFabrica();

// --- Sensores ---
SensorTemperatura  sensorTemperatura(PIN_DS18B20);
SensorHumedad      sensorHumedadAire(PIN_HUMEDAD_AIRE);
SensorHumedadSuelo sensorHumedadSuelo(PIN_SONDA_SUELO, ajustes, USAR_SONDA_SUELO);
SensorNivelAgua    sensorNivelAgua(PIN_SONDA_AGUA, ajustes, USAR_SONDA_NIVEL_AGUA);

// --- Actuadores ---
BombaAgua    bomba(PIN_RELE_BOMBA, RELES_ACTIVOS_EN_BAJO);
Ventilador   ventilador(PIN_RELE_VENTILADOR, RELES_ACTIVOS_EN_BAJO);
IndicadorLED ledHumedadBaja(PIN_LED_HUMEDAD_BAJA, "rojo");
IndicadorLED ledHumedadAlta(PIN_LED_HUMEDAD_ALTA, "azul");
IndicadorLED ledEstado(PIN_LED_ESTADO, "placa");
Zumbador     zumbador(PIN_ZUMBADOR, ZUMBADOR_PASIVO);
BotonPulsador boton(PIN_BOTON);

// --- Reglas y control ---
ReglaControl regla(ajustes);

ControladorArduino controlador(
    Componentes{sensorTemperatura, sensorHumedadAire, sensorHumedadSuelo, sensorNivelAgua,
                bomba, ventilador,
                ledHumedadBaja, ledHumedadAlta, ledEstado, zumbador, boton},
    ajustes, regla);

Invernadero invernadero("INV-01", "Invernadero piloto");

void setup() {
    invernadero.asignarControlador(&controlador);
    invernadero.iniciarSistema();
}

void loop() {
    invernadero.monitorear(millis());
}
