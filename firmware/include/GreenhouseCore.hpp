#ifndef GREENHOUSE_CORE_HPP
#define GREENHOUSE_CORE_HPP

// =====================================================================
//  Smart Greenhouse IoT — Núcleo orientado a objetos
//
//  Traducción del diagrama UML (docs/assets/uml-domain-model-diagram) a C++
//  para Arduino Uno, adaptada al hardware real del proyecto:
//
//    Sensor (abstracta)    -> SensorTemperatura (DS18B20)
//                          -> SensorHumedad     (módulo HR202 + LM393)
//    Actuador (abstracta)  -> IndicadorLED
//                          -> ActuadorRele -> BombaAgua   (mini bomba sumergible)
//                                          -> Ventilador  (mini ventilador 5V 40x40)
//    ReglaControl, LecturaDato, ControladorArduino, Invernadero
//
//  Nota: el Arduino Uno (AVR) no tiene la librería estándar de C++
//  (std::string, std::vector). Por eso se usan const char*, arreglos de
//  tamaño fijo y la clase Print de Arduino.
// =====================================================================

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "Config.h"

static_assert(HR202_ADC_AIRE_SECO != HR202_ADC_AIRE_HUMEDO,
              "HR202_ADC_AIRE_SECO y HR202_ADC_AIRE_HUMEDO no pueden ser iguales");

// ---------------------------------------------------------------------
//  LecturaDato: una medición con su marca de tiempo y validez
// ---------------------------------------------------------------------
class LecturaDato {
public:
    uint16_t idLectura;
    unsigned long timestamp;   // millis() en el momento de la lectura
    float valor;
    const char* unidad;
    bool valida;

    LecturaDato()
        : idLectura(0), timestamp(0), valor(0.0f), unidad(""), valida(false) {}

    LecturaDato(uint16_t id, unsigned long ts, float val, const char* uni, bool ok)
        : idLectura(id), timestamp(ts), valor(val), unidad(uni), valida(ok) {}

    bool esValida() const {
        return valida;
    }

    void formatearSalida(Print& salida) const {
        salida.print(F("Lectura #"));
        salida.print(idLectura);
        salida.print(F(": "));
        if (valida) {
            salida.print(valor, 2);
            salida.print(' ');
            salida.println(unidad);
        } else {
            salida.println(F("INVALIDA"));
        }
    }
};

// ---------------------------------------------------------------------
//  Estados de humedad y reglas de control (sin dependencias de hardware)
// ---------------------------------------------------------------------
enum EstadoHumedad : uint8_t {
    HUMEDAD_DESCONOCIDA = 0,
    HUMEDAD_BAJA,
    HUMEDAD_NORMAL,
    HUMEDAD_ALTA
};

class ReglaControl {
public:
    float umbralTempMax;
    float histeresisTemp;
    float umbralHumedadMin;
    float umbralHumedadMax;
    float histeresisHumedad;

    ReglaControl(float tempMax, float histTemp, float humMin, float humMax, float histHum)
        : umbralTempMax(tempMax), histeresisTemp(histTemp),
          umbralHumedadMin(humMin), umbralHumedadMax(humMax), histeresisHumedad(histHum),
          calor(false), fallaTemperatura(false), estadoHumedad(HUMEDAD_DESCONOCIDA) {}

    // Con histéresis: empieza a ventilar por encima de umbralTempMax y
    // deja de hacerlo por debajo de (umbralTempMax - histeresisTemp).
    void evaluarTemperatura(const LecturaDato& t) {
        if (!t.esValida()) {
            fallaTemperatura = true;
            return;
        }
        fallaTemperatura = false;
        if (!calor && t.valor > umbralTempMax) {
            calor = true;
        } else if (calor && t.valor < umbralTempMax - histeresisTemp) {
            calor = false;
        }
    }

    // Para salir de BAJA o ALTA hay que superar la histéresis; para entrar no.
    void evaluarHumedad(const LecturaDato& h) {
        if (!h.esValida()) {
            estadoHumedad = HUMEDAD_DESCONOCIDA;
            return;
        }
        const float v = h.valor;
        switch (estadoHumedad) {
            case HUMEDAD_BAJA:
                if (v >= umbralHumedadMin + histeresisHumedad) estadoHumedad = clasificarHumedad(v);
                break;
            case HUMEDAD_ALTA:
                if (v <= umbralHumedadMax - histeresisHumedad) estadoHumedad = clasificarHumedad(v);
                break;
            default:
                estadoHumedad = clasificarHumedad(v);
                break;
        }
    }

    // Si el sensor de temperatura falla, se ventila por seguridad
    // (un ventilador encendido de más no daña las plantas; el calor sí).
    bool requiereVentilacion() const {
        return calor || fallaTemperatura || estadoHumedad == HUMEDAD_ALTA;
    }

    bool requiereRiego() const {
        return estadoHumedad == HUMEDAD_BAJA;
    }

    bool hayFallaSensor() const {
        return fallaTemperatura || estadoHumedad == HUMEDAD_DESCONOCIDA;
    }

    bool hayCalor() const { return calor; }
    EstadoHumedad obtenerEstadoHumedad() const { return estadoHumedad; }

    // Estado general, de mayor a menor prioridad.
    const char* obtenerEstado() const {
        if (fallaTemperatura)                     return "FALLA_SENSOR_TEMPERATURA";
        if (estadoHumedad == HUMEDAD_DESCONOCIDA) return "SIN_DATOS_HUMEDAD";
        if (calor)                                return "ALERTA_TEMPERATURA_ALTA";
        if (estadoHumedad == HUMEDAD_BAJA)        return "HUMEDAD_BAJA";
        if (estadoHumedad == HUMEDAD_ALTA)        return "HUMEDAD_ALTA";
        return "NORMAL";
    }

    static const char* nombreEstadoHumedad(EstadoHumedad e) {
        switch (e) {
            case HUMEDAD_BAJA:   return "BAJA";
            case HUMEDAD_NORMAL: return "NORMAL";
            case HUMEDAD_ALTA:   return "ALTA";
            default:             return "DESCONOCIDA";
        }
    }

private:
    bool calor;
    bool fallaTemperatura;
    EstadoHumedad estadoHumedad;

    EstadoHumedad clasificarHumedad(float v) const {
        if (v < umbralHumedadMin) return HUMEDAD_BAJA;
        if (v > umbralHumedadMax) return HUMEDAD_ALTA;
        return HUMEDAD_NORMAL;
    }
};

// ---------------------------------------------------------------------
//  Sensor: clase base abstracta
// ---------------------------------------------------------------------
class Sensor {
public:
    uint8_t idPin;
    const char* nombre;
    bool activo;

    Sensor(uint8_t pin, const char* nom)
        : idPin(pin), nombre(nom), activo(true), contadorLecturas(0) {}
    virtual ~Sensor() {}

    virtual void inicializar() = 0;
    virtual void obtenerLectura(unsigned long ahora) = 0;

    LecturaDato ultimaLectura() const {
        return lectura;
    }

protected:
    LecturaDato lectura;
    uint16_t contadorLecturas;

    void registrarLectura(unsigned long ahora, float valor, const char* unidad, bool ok) {
        lectura = LecturaDato(++contadorLecturas, ahora, valor, unidad, ok);
    }
};

// ---------------------------------------------------------------------
//  SensorTemperatura: DS18B20 sumergible (bus 1-Wire)
//  Lectura no bloqueante: se pide la conversión y se lee en el siguiente
//  ciclo, así el loop nunca se queda 750 ms esperando.
// ---------------------------------------------------------------------
class SensorTemperatura : public Sensor {
public:
    float temperatura;

    explicit SensorTemperatura(uint8_t pin)
        : Sensor(pin, "DS18B20 Temperatura"), temperatura(NAN),
          bus(pin), dallas(&bus), conversionPendiente(false), inicioConversion(0) {}

    void inicializar() override {
        dallas.begin();
        dallas.setResolution(RESOLUCION_DS18B20_BITS);
        dallas.setWaitForConversion(false);
        solicitarConversion(millis());
    }

    uint8_t sensoresDetectados() {
        return dallas.getDeviceCount();
    }

    void obtenerLectura(unsigned long ahora) override {
        if (conversionPendiente && (ahora - inicioConversion) >= tiempoConversionMs()) {
            leerTemperatura(ahora);
        }
        if (!conversionPendiente) {
            solicitarConversion(ahora);
        }
    }

    void leerTemperatura(unsigned long ahora) {
        const float t = dallas.getTempCByIndex(0);
        conversionPendiente = false;
        // -127 °C = sensor desconectado. Fuera de -55..125 °C = lectura corrupta.
        const bool ok = (t != DEVICE_DISCONNECTED_C) && t >= -55.0f && t <= 125.0f;
        temperatura = ok ? t : NAN;
        registrarLectura(ahora, t, "C", ok);
    }

private:
    OneWire bus;               // debe declararse antes que 'dallas'
    DallasTemperature dallas;
    bool conversionPendiente;
    unsigned long inicioConversion;

    void solicitarConversion(unsigned long ahora) {
        dallas.requestTemperatures();
        conversionPendiente = true;
        inicioConversion = ahora;
    }

    static unsigned long tiempoConversionMs() {
        // 9 bits: 94 ms, 10: 188 ms, 11: 375 ms, 12: 750 ms
        return 750UL >> (12 - RESOLUCION_DS18B20_BITS);
    }
};

// ---------------------------------------------------------------------
//  SensorHumedad: módulo HR202 (humedad relativa del AIRE) con LM393
//    DO -> digital: supera / no supera el umbral del potenciómetro
//    AO -> analógica: se convierte a un porcentaje aproximado (0-100)
//  El HR202 no es un sensor calibrado de fábrica: el porcentaje es un
//  índice útil para comparar, no una medida de laboratorio.
// ---------------------------------------------------------------------
class SensorHumedad : public Sensor {
public:
    uint8_t pinAnalogico;
    float humedad;        // 0-100 %
    bool superaUmbral;    // estado de DO
    int valorAdc;         // lectura cruda de AO (0-1023), -1 si no se usa

    SensorHumedad(uint8_t pinDigital, uint8_t pinAnalog)
        : Sensor(pinDigital, "HR202 Humedad aire"), pinAnalogico(pinAnalog),
          humedad(0.0f), superaUmbral(false), valorAdc(-1) {}

    void inicializar() override {
        pinMode(idPin, INPUT);
    }

    void obtenerLectura(unsigned long ahora) override {
        leerHumedad(ahora);
    }

    void leerHumedad(unsigned long ahora) {
        const int d = digitalRead(idPin);
        superaUmbral = HR202_DO_ACTIVO_EN_BAJO ? (d == LOW) : (d == HIGH);

        if (HR202_USAR_SALIDA_ANALOGICA) {
            valorAdc = leerAdcPromediado();
            humedad = adcAPorcentaje(valorAdc);
        } else {
            // Solo DO: 100 = por encima del umbral, 0 = por debajo.
            valorAdc = -1;
            humedad = superaUmbral ? 100.0f : 0.0f;
        }
        registrarLectura(ahora, humedad, "%", true);
    }

    float porcentajeHumedad() const {
        return humedad;
    }

    // Mapeo lineal entre los dos puntos de calibración, recortado a 0-100.
    static float adcAPorcentaje(int adc) {
        float pct = (float)(adc - HR202_ADC_AIRE_SECO) * 100.0f
                  / (float)(HR202_ADC_AIRE_HUMEDO - HR202_ADC_AIRE_SECO);
        if (pct < 0.0f)   pct = 0.0f;
        if (pct > 100.0f) pct = 100.0f;
        return pct;
    }

private:
    int leerAdcPromediado() {
        long suma = 0;
        for (uint8_t i = 0; i < 8; i++) {
            suma += analogRead(pinAnalogico);
        }
        return (int)(suma / 8);
    }
};

// ---------------------------------------------------------------------
//  Actuador: clase base abstracta
// ---------------------------------------------------------------------
class Actuador {
public:
    uint8_t idPin;
    bool estado;

    explicit Actuador(uint8_t pin) : idPin(pin), estado(false) {}
    virtual ~Actuador() {}

    virtual void inicializar() = 0;
    virtual void encender() = 0;
    virtual void apagar() = 0;

    // Tareas que dependen del tiempo (parpadeos, fin de un pulso de riego).
    // Se llama en cada vuelta del loop.
    virtual void actualizar(unsigned long ahora) { (void)ahora; }
};

// ---------------------------------------------------------------------
//  IndicadorLED: LED con resistencia de 220 Ω
// ---------------------------------------------------------------------
class IndicadorLED : public Actuador {
public:
    const char* color;
    bool parpadeo;

    IndicadorLED(uint8_t pin, const char* col)
        : Actuador(pin), color(col), parpadeo(false), periodoMs(PERIODO_PARPADEO_MS), faseInvertida(false) {}

    void inicializar() override {
        pinMode(idPin, OUTPUT);
        escribir(false);
    }

    void encender() override { parpadeo = false; escribir(true); }
    void apagar() override   { parpadeo = false; escribir(false); }

    void cambiarEstado() {
        parpadeo = false;
        escribir(!estado);
    }

    // Dos LEDs con fase invertida parpadean alternados.
    void parpadear(unsigned long periodo, bool invertido = false) {
        parpadeo = true;
        periodoMs = periodo;
        faseInvertida = invertido;
    }

    void actualizar(unsigned long ahora) override {
        if (!parpadeo || periodoMs == 0) return;
        const bool fase = ((ahora / periodoMs) % 2UL) == 0;
        escribir(fase != faseInvertida);
    }

private:
    unsigned long periodoMs;
    bool faseInvertida;

    void escribir(bool on) {
        estado = on;
        digitalWrite(idPin, on ? HIGH : LOW);
    }
};

// ---------------------------------------------------------------------
//  ActuadorRele: carga controlada a través de un módulo relé
//  (o de un transistor, si activoEnBajo = false)
// ---------------------------------------------------------------------
class ActuadorRele : public Actuador {
public:
    bool activoEnBajo;
    const char* nombre;

    ActuadorRele(uint8_t pin, bool activoBajo, const char* nom)
        : Actuador(pin), activoEnBajo(activoBajo), nombre(nom) {}

    void inicializar() override {
        // Primero se fija el nivel "apagado" y luego se configura como salida.
        // Así el relé no hace clic (ni arranca la bomba) al encender el Arduino.
        digitalWrite(idPin, nivelPin(false));
        pinMode(idPin, OUTPUT);
        escribir(false);
    }

    void encender() override { escribir(true); }
    void apagar() override   { escribir(false); }

protected:
    void escribir(bool on) {
        estado = on;
        digitalWrite(idPin, nivelPin(on));
    }

    uint8_t nivelPin(bool on) const {
        return (on != activoEnBajo) ? HIGH : LOW;
    }
};

// ---------------------------------------------------------------------
//  Ventilador: mini ventilador 5V 0.1A (40x40x10 mm)
// ---------------------------------------------------------------------
class Ventilador : public ActuadorRele {
public:
    Ventilador(uint8_t pin, bool activoBajo)
        : ActuadorRele(pin, activoBajo, "Ventilador") {}
};

// ---------------------------------------------------------------------
//  BombaAgua: mini bomba sumergible 3-6V (aspersor)
//  Riega por pulsos y respeta el ciclo de trabajo del fabricante
//  (lapsos cortos, no más de 20 min por hora).
// ---------------------------------------------------------------------
class BombaAgua : public ActuadorRele {
public:
    BombaAgua(uint8_t pin, bool activoBajo)
        : ActuadorRele(pin, activoBajo, "Bomba"),
          inicioPulso(0), duracionPulso(0), finUltimoPulso(0),
          inicioVentana(0), msUsadosEnVentana(0), ultimoAhora(0), haRegado(false) {}

    // Intenta iniciar un pulso de riego. Devuelve false si todavía no se puede
    // (ya está regando, falta pausa entre pulsos o se agotó el cupo de la hora).
    bool solicitarPulso(unsigned long ahora) {
        renovarVentana(ahora);
        if (estado) return false;
        if (haRegado && (ahora - finUltimoPulso) < BOMBA_PAUSA_MIN_MS) return false;
        if (msUsadosEnVentana >= BOMBA_MAX_MS_POR_HORA) return false;

        const unsigned long disponible = BOMBA_MAX_MS_POR_HORA - msUsadosEnVentana;
        duracionPulso = (BOMBA_PULSO_MS < disponible) ? BOMBA_PULSO_MS : disponible;
        if (duracionPulso < 1000UL) return false;   // un pulso de menos de 1 s no sirve

        inicioPulso = ahora;
        ActuadorRele::encender();
        return true;
    }

    void actualizar(unsigned long ahora) override {
        renovarVentana(ahora);
        if (estado && (ahora - inicioPulso) >= duracionPulso) {
            terminarPulso(ahora);
        }
    }

    // encender() siempre pasa por las protecciones de solicitarPulso().
    void encender() override { solicitarPulso(ultimoAhora); }
    void apagar() override   { if (estado) terminarPulso(ultimoAhora); }

    unsigned long segundosUsadosEnHora() const {
        return msUsadosEnVentana / 1000UL;
    }

private:
    unsigned long inicioPulso;
    unsigned long duracionPulso;
    unsigned long finUltimoPulso;
    unsigned long inicioVentana;
    unsigned long msUsadosEnVentana;
    unsigned long ultimoAhora;
    bool haRegado;

    void terminarPulso(unsigned long ahora) {
        msUsadosEnVentana += (ahora - inicioPulso);
        finUltimoPulso = ahora;
        haRegado = true;
        ActuadorRele::apagar();
    }

    void renovarVentana(unsigned long ahora) {
        ultimoAhora = ahora;
        if ((ahora - inicioVentana) >= VENTANA_HORA_MS) {
            inicioVentana = ahora;
            msUsadosEnVentana = 0;
        }
    }
};

// ---------------------------------------------------------------------
//  ControladorArduino: lee sensores, evalúa reglas, mueve actuadores
//  y envía telemetría por el puerto serie (una línea JSON por muestra).
// ---------------------------------------------------------------------
class ControladorArduino {
public:
    unsigned long puertoSerie;
    unsigned long frecuenciaMuestreo;
    const char* estadoActual;

    static const uint8_t MAX_SENSORES = 4;
    static const uint8_t MAX_ACTUADORES = 6;

    ControladorArduino(SensorTemperatura& st, SensorHumedad& sh,
                       Ventilador& vent, BombaAgua& bom,
                       IndicadorLED& ledBaja, IndicadorLED& ledAlta, IndicadorLED& ledVivo,
                       ReglaControl& reglaControl,
                       unsigned long puerto = VELOCIDAD_SERIE,
                       unsigned long freq = INTERVALO_MUESTREO_MS)
        : puertoSerie(puerto), frecuenciaMuestreo(freq), estadoActual("INICIANDO"),
          numSensores(0), numActuadores(0),
          sensorTemp(st), sensorHum(sh), ventilador(vent), bomba(bom),
          ledHumedadBaja(ledBaja), ledHumedadAlta(ledAlta), ledEstado(ledVivo),
          regla(reglaControl), ultimoMuestreo(0) {
        agregarSensor(&st);
        agregarSensor(&sh);
        agregarActuador(&vent);
        agregarActuador(&bom);
        agregarActuador(&ledBaja);
        agregarActuador(&ledAlta);
        agregarActuador(&ledVivo);
    }

    bool agregarSensor(Sensor* s) {
        if (numSensores >= MAX_SENSORES) return false;
        sensores[numSensores++] = s;
        return true;
    }

    bool agregarActuador(Actuador* a) {
        if (numActuadores >= MAX_ACTUADORES) return false;
        actuadores[numActuadores++] = a;
        return true;
    }

    void inicializar() {
        // Actuadores primero: deja relés apagados lo antes posible.
        for (uint8_t i = 0; i < numActuadores; i++) actuadores[i]->inicializar();
        Serial.begin(puertoSerie);
        for (uint8_t i = 0; i < numSensores; i++) sensores[i]->inicializar();

        Serial.println(F("# Smart Greenhouse IoT - firmware iniciado"));
        Serial.print(F("# DS18B20 detectados: "));
        Serial.println(sensorTemp.sensoresDetectados());
        if (sensorTemp.sensoresDetectados() == 0) {
            Serial.println(F("# AVISO: no se detecta el DS18B20. Revisa el cable de datos y la resistencia de 4.7k"));
        }
        estadoActual = "ESPERANDO_PRIMERA_LECTURA";
        ultimoMuestreo = millis();
    }

    // Se llama en cada vuelta del loop.
    void ciclo(unsigned long ahora) {
        for (uint8_t i = 0; i < numActuadores; i++) actuadores[i]->actualizar(ahora);

        if ((ahora - ultimoMuestreo) >= frecuenciaMuestreo) {
            ultimoMuestreo = ahora;
            leerSensores(ahora);
            ejecutarLogica(ahora);
            enviarTelemetria(ahora);
        }
    }

    void leerSensores(unsigned long ahora) {
        for (uint8_t i = 0; i < numSensores; i++) {
            if (sensores[i]->activo) sensores[i]->obtenerLectura(ahora);
        }
    }

    void ejecutarLogica(unsigned long ahora) {
        regla.evaluarTemperatura(sensorTemp.ultimaLectura());
        regla.evaluarHumedad(sensorHum.ultimaLectura());
        estadoActual = regla.obtenerEstado();

        // Aspersor: pulsos mientras la humedad siga baja
        if (regla.requiereRiego()) bomba.solicitarPulso(ahora);
        else                       bomba.apagar();

        // Ventilador: calor, humedad alta o falla del sensor de temperatura.
        // Si todo se alimenta del Arduino, se pausa mientras la bomba riega.
        const bool pausaPorBomba = ALIMENTACION_SOLO_ARDUINO && bomba.estado;
        if (regla.requiereVentilacion() && !pausaPorBomba) ventilador.encender();
        else                                               ventilador.apagar();

        // LEDs de humedad
        if (regla.hayFallaSensor()) {
            ledHumedadBaja.parpadear(PERIODO_PARPADEO_MS, false);
            ledHumedadAlta.parpadear(PERIODO_PARPADEO_MS, true);
        } else {
            const EstadoHumedad h = regla.obtenerEstadoHumedad();
            if (h == HUMEDAD_BAJA) ledHumedadBaja.encender(); else ledHumedadBaja.apagar();
            if (h == HUMEDAD_ALTA) ledHumedadAlta.encender(); else ledHumedadAlta.apagar();
        }

        ledEstado.cambiarEstado();   // latido: el sistema sigue vivo
    }

    // Una línea JSON por muestra. Las líneas que empiezan con '#' son mensajes.
    void enviarTelemetria(unsigned long ahora) {
        const LecturaDato t = sensorTemp.ultimaLectura();
        Serial.print(F("{\"t_ms\":"));          Serial.print(ahora);
        Serial.print(F(",\"temp_c\":"));
        if (t.esValida()) Serial.print(t.valor, 2); else Serial.print(F("null"));
        Serial.print(F(",\"hum_pct\":"));       Serial.print(sensorHum.porcentajeHumedad(), 1);
        Serial.print(F(",\"hum_adc\":"));
        if (sensorHum.valorAdc >= 0) Serial.print(sensorHum.valorAdc); else Serial.print(F("null"));
        Serial.print(F(",\"hum_do\":"));        Serial.print(sensorHum.superaUmbral ? 1 : 0);
        Serial.print(F(",\"estado\":\""));      Serial.print(estadoActual);
        Serial.print(F("\",\"humedad\":\""));   Serial.print(ReglaControl::nombreEstadoHumedad(regla.obtenerEstadoHumedad()));
        Serial.print(F("\",\"ventilador\":"));  Serial.print(ventilador.estado ? 1 : 0);
        Serial.print(F(",\"bomba\":"));         Serial.print(bomba.estado ? 1 : 0);
        Serial.print(F(",\"bomba_s_hora\":"));  Serial.print(bomba.segundosUsadosEnHora());
        Serial.println('}');
    }

private:
    Sensor* sensores[MAX_SENSORES];
    Actuador* actuadores[MAX_ACTUADORES];
    uint8_t numSensores;
    uint8_t numActuadores;

    SensorTemperatura& sensorTemp;
    SensorHumedad& sensorHum;
    Ventilador& ventilador;
    BombaAgua& bomba;
    IndicadorLED& ledHumedadBaja;
    IndicadorLED& ledHumedadAlta;
    IndicadorLED& ledEstado;
    ReglaControl& regla;
    unsigned long ultimoMuestreo;
};

// ---------------------------------------------------------------------
//  Invernadero: entidad principal del sistema
// ---------------------------------------------------------------------
class Invernadero {
public:
    const char* idInvernadero;
    const char* nombre;
    bool sistemaActivo;
    ControladorArduino* controlador;

    Invernadero(const char* id, const char* nom)
        : idInvernadero(id), nombre(nom), sistemaActivo(false), controlador(nullptr) {}

    void asignarControlador(ControladorArduino* c) {
        controlador = c;
    }

    void iniciarSistema() {
        if (controlador == nullptr) return;
        controlador->inicializar();
        Serial.print(F("# Invernadero "));
        Serial.print(idInvernadero);
        Serial.print(F(" - "));
        Serial.println(nombre);
        sistemaActivo = true;
    }

    void monitorear(unsigned long ahora) {
        if (sistemaActivo && controlador != nullptr) {
            controlador->ciclo(ahora);
        }
    }
};

#endif // GREENHOUSE_CORE_HPP
