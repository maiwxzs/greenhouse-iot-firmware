#ifndef GREENHOUSE_CORE_HPP
#define GREENHOUSE_CORE_HPP

// =====================================================================
//  Smart Greenhouse IoT — Núcleo orientado a objetos (hardware)
//
//  Jerarquía (ver docs/diagramas/uml-clases):
//
//    Sensor (abstracta)
//      ├── SensorTemperatura        DS18B20 sumergible (1-Wire)
//      ├── SensorHumedad            Módulo HR202 (humedad del aire)
//      └── SondaResistiva (abstracta, sondas caseras con pull-up interno)
//            ├── SensorHumedadSuelo dos clavos en la maceta
//            └── SensorNivelAgua    dos cables en el tanque
//    Actuador (abstracta)
//      ├── IndicadorLED
//      ├── Zumbador
//      └── ActuadorRele
//            ├── BombaAgua          mini bomba sumergible (aspersor)
//            ├── Ventilador         mini ventilador 5V
//            └── LuzCultivo         lámpara en el tercer relé
//    BotonPulsador, PantallaLCD, AlmacenAjustes
//    ControladorArduino, Invernadero
//
//  La lógica de decisión (sin pines) está en Logica.h.
//  El Arduino Uno no tiene la STL de C++: se usan const char*, arreglos
//  de tamaño fijo y la clase Print de Arduino.
// =====================================================================

#include <Arduino.h>
#include <EEPROM.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "Config.h"
#include "Logica.h"
#if USAR_LCD
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#endif

#define FIRMWARE_VERSION "2.0.0"

// ---------------------------------------------------------------------
//  Utilidades de impresión
// ---------------------------------------------------------------------
inline void imprimirDosDigitos(Print& p, uint8_t v) {
    if (v < 10) p.print('0');
    p.print(v);
}

inline void imprimirHora(Print& p, uint8_t h, uint8_t m, uint8_t s) {
    imprimirDosDigitos(p, h); p.print(':');
    imprimirDosDigitos(p, m); p.print(':');
    imprimirDosDigitos(p, s);
}

// Nombres de estados guardados en la memoria flash (no ocupan RAM)
inline const __FlashStringHelper* textoEstado(EstadoSistema e) {
    switch (e) {
        case ESTADO_HUMEDAD_ALTA:             return F("HUMEDAD_ALTA");
        case ESTADO_SUELO_ENCHARCADO:         return F("SUELO_ENCHARCADO");
        case ESTADO_HUMEDAD_BAJA:             return F("HUMEDAD_BAJA");
        case ESTADO_SUELO_SECO:               return F("SUELO_SECO");
        case ESTADO_TEMPERATURA_ALTA:         return F("TEMPERATURA_ALTA");
        case ESTADO_TEMPERATURA_CRITICA:      return F("TEMPERATURA_CRITICA");
        case ESTADO_SIN_AGUA:                 return F("SIN_AGUA");
        case ESTADO_SIN_DATOS:                return F("SIN_DATOS");
        case ESTADO_FALLA_SENSOR_TEMPERATURA: return F("FALLA_SENSOR_TEMP");
        default:                              return F("NORMAL");
    }
}

inline const __FlashStringHelper* textoNivel(EstadoNivel e) {
    switch (e) {
        case NIVEL_BAJO:     return F("BAJA");
        case NIVEL_NORMAL:   return F("NORMAL");
        case NIVEL_ALTO:     return F("ALTA");
        case NIVEL_NO_USADO: return F("NO_USADO");
        default:             return F("DESCONOCIDA");
    }
}

// ---------------------------------------------------------------------
//  AlmacenAjustes: lee y guarda los ajustes en la EEPROM interna
// ---------------------------------------------------------------------
class AlmacenAjustes {
public:
    static const int DIRECCION = 0;

    static Ajustes deFabrica() {
        Ajustes a;
        memset(&a, 0, sizeof(a));
        a.tempMax        = FABRICA_TEMP_MAX_C;
        a.tempHisteresis = FABRICA_TEMP_HISTERESIS_C;
        a.tempCritica    = FABRICA_TEMP_CRITICA_C;
        a.humAireMin     = FABRICA_HUM_AIRE_MIN;
        a.humAireMax     = FABRICA_HUM_AIRE_MAX;
        a.humSueloMin    = FABRICA_HUM_SUELO_MIN;
        a.humSueloMax    = FABRICA_HUM_SUELO_MAX;
        a.humHisteresis  = FABRICA_HISTERESIS_PCT;
        a.adcAireSeco    = FABRICA_ADC_AIRE_SECO;
        a.adcAireHumedo  = FABRICA_ADC_AIRE_HUMEDO;
        a.adcSueloSeco   = FABRICA_ADC_SUELO_SECO;
        a.adcSueloHumedo = FABRICA_ADC_SUELO_HUMEDO;
        a.adcUmbralAgua  = FABRICA_ADC_UMBRAL_AGUA;
        a.luzHoraInicio  = FABRICA_LUZ_HORA_INICIO;
        a.luzHoraFin     = FABRICA_LUZ_HORA_FIN;
        a.modoLuz        = LUZ_AUTO;
        sellarAjustes(a);
        return a;
    }

    // Devuelve true si había ajustes guardados válidos.
    static bool cargar(Ajustes& a) {
        EEPROM.get(DIRECCION, a);
        if (ajustesValidos(a)) return true;
        a = deFabrica();
        guardar(a);
        return false;
    }

    // EEPROM.put solo escribe los bytes que cambiaron (cuida la memoria).
    static void guardar(Ajustes& a) {
        sellarAjustes(a);
        EEPROM.put(DIRECCION, a);
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

    Sensor(uint8_t pin, const char* nom, bool usado = true)
        : idPin(pin), nombre(nom), activo(usado), contadorLecturas(0) {}
    virtual ~Sensor() {}

    virtual void inicializar() = 0;
    virtual void obtenerLectura(unsigned long ahora) = 0;

    LecturaDato ultimaLectura() const { return lectura; }

protected:
    LecturaDato lectura;
    uint16_t contadorLecturas;

    void registrarLectura(unsigned long ahora, float valor, const char* unidad, bool ok) {
        lectura = LecturaDato(++contadorLecturas, ahora, valor, unidad, ok);
    }
};

// ---------------------------------------------------------------------
//  SensorTemperatura: DS18B20 sumergible (bus 1-Wire), lectura no bloqueante
// ---------------------------------------------------------------------
class SensorTemperatura : public Sensor {
public:
    float temperatura;

    explicit SensorTemperatura(uint8_t pin)
        : Sensor(pin, "DS18B20"), temperatura(NAN),
          bus(pin), dallas(&bus), conversionPendiente(false), inicioConversion(0) {}

    void inicializar() override {
        dallas.begin();
        dallas.setResolution(RESOLUCION_DS18B20_BITS);
        dallas.setWaitForConversion(false);
        solicitarConversion(millis());
    }

    uint8_t sensoresDetectados() { return dallas.getDeviceCount(); }

    void obtenerLectura(unsigned long ahora) override {
        if (conversionPendiente && (ahora - inicioConversion) >= tiempoConversionMs()) {
            leerTemperatura(ahora);
        }
        if (!conversionPendiente) solicitarConversion(ahora);
    }

    void leerTemperatura(unsigned long ahora) {
        const float t = dallas.getTempCByIndex(0);
        conversionPendiente = false;
        // -127 °C = desconectado. Fuera de -55..125 °C = lectura corrupta.
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
        return 750UL >> (12 - RESOLUCION_DS18B20_BITS);   // 12 bits: 750 ms
    }
};

// ---------------------------------------------------------------------
//  SensorHumedad: módulo HR202 + LM393 (humedad relativa del AIRE)
// ---------------------------------------------------------------------
class SensorHumedad : public Sensor {
public:
    uint8_t pinAnalogico;
    float humedad;        // 0-100 %
    bool superaUmbral;    // estado de DO
    int valorAdc;         // lectura cruda de AO, -1 si no se usa

    SensorHumedad(uint8_t pinDigital, uint8_t pinAnalog, const Ajustes& ajustes)
        : Sensor(pinDigital, "HR202"), pinAnalogico(pinAnalog),
          humedad(0.0f), superaUmbral(false), valorAdc(-1), cfg(ajustes) {}

    void inicializar() override { pinMode(idPin, INPUT); }

    void obtenerLectura(unsigned long ahora) override { leerHumedad(ahora); }

    void leerHumedad(unsigned long ahora) {
        const int d = digitalRead(idPin);
        superaUmbral = HR202_DO_ACTIVO_EN_BAJO ? (d == LOW) : (d == HIGH);
        if (HR202_USAR_SALIDA_ANALOGICA) {
            valorAdc = medirAdc();
            humedad = adcAPorcentaje(valorAdc, cfg.adcAireSeco, cfg.adcAireHumedo);
        } else {
            valorAdc = -1;
            humedad = superaUmbral ? 100.0f : 0.0f;   // solo DO: arriba o abajo del potenciómetro
        }
        registrarLectura(ahora, humedad, "%", true);
    }

    float porcentajeHumedad() const { return humedad; }

    int medirAdc() {
        long suma = 0;
        for (uint8_t i = 0; i < 8; i++) suma += analogRead(pinAnalogico);
        return (int)(suma / 8);
    }

private:
    const Ajustes& cfg;
};

// ---------------------------------------------------------------------
//  SondaResistiva: dos electrodos (clavos o cables) entre un pin
//  analógico y GND. El pull-up interno del Arduino (~35 kΩ) forma un
//  divisor con la resistencia del medio: más agua = lectura más baja.
//  Solo se energiza durante la medición para reducir la corrosión.
// ---------------------------------------------------------------------
class SondaResistiva : public Sensor {
public:
    int valorAdc;

    SondaResistiva(uint8_t pin, const char* nom, bool usada)
        : Sensor(pin, nom, usada), valorAdc(-1) {}

    void inicializar() override { descansar(); }

    int medirAdc() {
        pinMode(idPin, INPUT_PULLUP);
        delay(2);                       // deja que se estabilice
        analogRead(idPin);              // la primera lectura se descarta
        long suma = 0;
        for (uint8_t i = 0; i < 4; i++) suma += analogRead(idPin);
        descansar();
        valorAdc = (int)(suma / 4);
        return valorAdc;
    }

protected:
    // Pin en LOW: los dos electrodos quedan a 0 V, sin corriente.
    void descansar() {
        pinMode(idPin, OUTPUT);
        digitalWrite(idPin, LOW);
    }
};

class SensorHumedadSuelo : public SondaResistiva {
public:
    float humedad;

    SensorHumedadSuelo(uint8_t pin, const Ajustes& ajustes, bool usada)
        : SondaResistiva(pin, "Sonda suelo", usada), humedad(0.0f), cfg(ajustes) {}

    void obtenerLectura(unsigned long ahora) override {
        const int adc = medirAdc();
        // Sonda al aire o cable suelto: lectura no válida (no provoca riego)
        const bool ok = adc < SONDA_SUELO_ADC_DESCONECTADA;
        humedad = ok ? adcAPorcentaje(adc, cfg.adcSueloSeco, cfg.adcSueloHumedo) : 0.0f;
        registrarLectura(ahora, humedad, "%", ok);
    }

private:
    const Ajustes& cfg;
};

class SensorNivelAgua : public SondaResistiva {
public:
    bool hayAgua;

    SensorNivelAgua(uint8_t pin, const Ajustes& ajustes, bool usada)
        : SondaResistiva(pin, "Sonda tanque", usada), hayAgua(true), cfg(ajustes) {}

    void obtenerLectura(unsigned long ahora) override {
        const int adc = medirAdc();
        hayAgua = adc < cfg.adcUmbralAgua;
        registrarLectura(ahora, hayAgua ? 1.0f : 0.0f, "", true);
    }

private:
    const Ajustes& cfg;
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
    virtual void actualizar(unsigned long ahora) { (void)ahora; }

    void fijar(bool on) { if (on) encender(); else apagar(); }
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

    void inicializar() override { pinMode(idPin, OUTPUT); escribir(false); }
    void encender() override    { parpadeo = false; escribir(true); }
    void apagar() override      { parpadeo = false; escribir(false); }
    void cambiarEstado()        { parpadeo = false; escribir(!estado); }

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
//  Zumbador: pitidos no bloqueantes
// ---------------------------------------------------------------------
class Zumbador : public Actuador {
public:
    bool pasivo;

    Zumbador(uint8_t pin, bool esPasivo)
        : Actuador(pin), pasivo(esPasivo), pendientes(0), sonando(false),
          duracionMs(150), tCambio(0), ultimoAhora(0) {}

    void inicializar() override { pinMode(idPin, OUTPUT); escribir(false); }
    void encender() override    { escribir(true); }
    void apagar() override      { pendientes = 0; sonando = false; escribir(false); }

    void pitar(uint8_t veces, unsigned long duracion = 150) {
        if (veces == 0) return;
        pendientes = veces;
        duracionMs = duracion;
        sonando = true;
        tCambio = ultimoAhora;
        escribir(true);
    }

    void actualizar(unsigned long ahora) override {
        ultimoAhora = ahora;
        if (pendientes == 0) return;
        if ((ahora - tCambio) < duracionMs) return;
        tCambio = ahora;
        if (sonando) {
            sonando = false;
            escribir(false);
            pendientes--;
        } else {
            sonando = true;
            escribir(true);
        }
    }

private:
    uint8_t pendientes;
    bool sonando;
    unsigned long duracionMs;
    unsigned long tCambio;
    unsigned long ultimoAhora;

    void escribir(bool on) {
        estado = on;
        if (pasivo) {
            if (on) tone(idPin, 2500); else noTone(idPin);
        } else {
            digitalWrite(idPin, on ? HIGH : LOW);
        }
    }
};

// ---------------------------------------------------------------------
//  ActuadorRele: carga controlada por un módulo relé
// ---------------------------------------------------------------------
class ActuadorRele : public Actuador {
public:
    bool activoEnBajo;
    const char* nombre;

    ActuadorRele(uint8_t pin, bool activoBajo, const char* nom)
        : Actuador(pin), activoEnBajo(activoBajo), nombre(nom) {}

    void inicializar() override {
        // Primero el nivel "apagado" y luego salida: el relé no hace clic al arrancar.
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

    uint8_t nivelPin(bool on) const { return (on != activoEnBajo) ? HIGH : LOW; }
};

class Ventilador : public ActuadorRele {
public:
    Ventilador(uint8_t pin, bool activoBajo) : ActuadorRele(pin, activoBajo, "Ventilador") {}
};

class LuzCultivo : public ActuadorRele {
public:
    LuzCultivo(uint8_t pin, bool activoBajo) : ActuadorRele(pin, activoBajo, "Luz") {}
};

// ---------------------------------------------------------------------
//  BombaAgua: riego por pulsos respetando el ciclo de trabajo
// ---------------------------------------------------------------------
class BombaAgua : public ActuadorRele {
public:
    BombaAgua(uint8_t pin, bool activoBajo)
        : ActuadorRele(pin, activoBajo, "Bomba"),
          ciclo(BOMBA_PULSO_MS, BOMBA_PAUSA_MIN_MS, BOMBA_MAX_MS_POR_HORA, VENTANA_HORA_MS),
          manual(false), ultimoAhora(0) {}

    // forzado = riego manual (botón o comando): ignora la pausa entre pulsos.
    bool solicitarPulso(unsigned long ahora, bool forzado = false) {
        ultimoAhora = ahora;
        if (!ciclo.solicitarPulso(ahora, forzado)) return false;
        manual = forzado;
        ActuadorRele::encender();
        return true;
    }

    void actualizar(unsigned long ahora) override {
        ultimoAhora = ahora;
        if (ciclo.actualizar(ahora)) {
            manual = false;
            ActuadorRele::apagar();
        }
    }

    void encender() override { solicitarPulso(ultimoAhora); }

    void apagar() override {
        ciclo.detener(ultimoAhora);
        manual = false;
        ActuadorRele::apagar();
    }

    bool esManual() const                      { return manual; }
    unsigned long segundosUsadosEnHora() const { return ciclo.msUsadosEnHora() / 1000UL; }

private:
    CicloTrabajoBomba ciclo;
    bool manual;
    unsigned long ultimoAhora;
};

// ---------------------------------------------------------------------
//  BotonPulsador: con antirrebote. Pulsación corta y larga.
// ---------------------------------------------------------------------
enum EventoBoton : uint8_t { BOTON_NADA = 0, BOTON_CORTO, BOTON_LARGO };

class BotonPulsador {
public:
    uint8_t idPin;

    explicit BotonPulsador(uint8_t pin)
        : idPin(pin), estable(false), lecturaAnterior(false),
          tCambio(0), tPresion(0), largoEmitido(false) {}

    void inicializar() { pinMode(idPin, INPUT_PULLUP); }

    EventoBoton actualizar(unsigned long ahora) {
        const bool presionado = digitalRead(idPin) == LOW;
        if (presionado != lecturaAnterior) {
            lecturaAnterior = presionado;
            tCambio = ahora;
        }
        if ((ahora - tCambio) < 30UL) return BOTON_NADA;           // antirrebote
        if (presionado != estable) {
            estable = presionado;
            if (estable) { tPresion = ahora; largoEmitido = false; return BOTON_NADA; }
            return largoEmitido ? BOTON_NADA : BOTON_CORTO;        // al soltar
        }
        if (estable && !largoEmitido && (ahora - tPresion) >= BOTON_PULSACION_LARGA_MS) {
            largoEmitido = true;
            return BOTON_LARGO;
        }
        return BOTON_NADA;
    }

private:
    bool estable;
    bool lecturaAnterior;
    unsigned long tCambio;
    unsigned long tPresion;
    bool largoEmitido;
};

// ---------------------------------------------------------------------
//  ResumenEstado: lo que se muestra en la pantalla
// ---------------------------------------------------------------------
struct ResumenEstado {
    bool tempValida;
    float temperatura;
    float humAire;
    bool sueloUsado;
    bool sueloValido;
    float humSuelo;
    bool aguaUsada;
    bool hayAgua;
    const __FlashStringHelper* estado;
    bool ventilador;
    bool bomba;
    bool luz;
    uint8_t hora;
    uint8_t minuto;
};

// ---------------------------------------------------------------------
//  PantallaLCD: LCD 16x2 con módulo I2C (dirección 0x27 o 0x3F, se detecta)
// ---------------------------------------------------------------------
#if USAR_LCD
class PantallaLCD {
public:
    PantallaLCD() : lcd(nullptr), pagina(0), tPagina(0) {}

    bool inicializar() {
        Wire.begin();
#if defined(WIRE_HAS_TIMEOUT)
        Wire.setWireTimeout(3000, true);
#endif
        const uint8_t direcciones[2] = {0x27, 0x3F};
        for (uint8_t i = 0; i < 2 && lcd == nullptr; i++) {
            Wire.beginTransmission(direcciones[i]);
            if (Wire.endTransmission() == 0) lcd = (i == 0) ? &lcd27 : &lcd3F;
        }
        if (lcd == nullptr) return false;
        lcd->init();
        lcd->backlight();
        lcd->clear();
        lcd->setCursor(0, 0); lcd->print(F("Invernadero IoT"));
        lcd->setCursor(0, 1); lcd->print(F("v" FIRMWARE_VERSION " iniciando"));
        return true;
    }

    bool disponible() const { return lcd != nullptr; }

    // Devuelve true si toca cambiar de página.
    bool tocaCambiarPagina(unsigned long ahora) const {
        return (ahora - tPagina) >= CAMBIO_PAGINA_LCD_MS;
    }

    void mostrar(const ResumenEstado& r, unsigned long ahora) {
        if (lcd == nullptr) return;
        if (tocaCambiarPagina(ahora)) {
            pagina = (uint8_t)((pagina + 1) % 2);
            tPagina = ahora;
        }
        size_t n;
        if (pagina == 0) {
            // T:24.5C  HA:55%
            // S:48% Agua:OK
            lcd->setCursor(0, 0);
            n = lcd->print(F("T:"));
            if (r.tempValida) { n += lcd->print(r.temperatura, 1); n += lcd->print('C'); }
            else              { n += lcd->print(F("--.-C")); }
            n += lcd->print(F(" HA:"));
            n += lcd->print((int)(r.humAire + 0.5f));
            n += lcd->print('%');
            rellenar(n);
            lcd->setCursor(0, 1);
            n = lcd->print(F("S:"));
            if (!r.sueloUsado)       n += lcd->print(F("--"));
            else if (!r.sueloValido) n += lcd->print(F("??"));
            else { n += lcd->print((int)(r.humSuelo + 0.5f)); n += lcd->print('%'); }
            n += lcd->print(F(" Agua:"));
            if (!r.aguaUsada) n += lcd->print(F("--"));
            else              n += lcd->print(r.hayAgua ? F("OK") : F("NO"));
            rellenar(n);
        } else {
            // TEMPERATURA_ALTA
            // V1 B0 L1   12:30
            lcd->setCursor(0, 0);
            n = 0;
            const char* p = reinterpret_cast<const char*>(r.estado);
            for (char ch = (char)pgm_read_byte(p); ch != '\0' && n < 16; ch = (char)pgm_read_byte(++p)) {
                n += lcd->print(ch == '_' ? ' ' : ch);
            }
            rellenar(n);
            lcd->setCursor(0, 1);
            n = lcd->print('V'); n += lcd->print(r.ventilador ? '1' : '0');
            n += lcd->print(F(" B")); n += lcd->print(r.bomba ? '1' : '0');
            n += lcd->print(F(" L")); n += lcd->print(r.luz ? '1' : '0');
            n += lcd->print(F("   "));
            if (r.hora < 10) n += lcd->print('0');
            n += lcd->print(r.hora);
            n += lcd->print(':');
            if (r.minuto < 10) n += lcd->print('0');
            n += lcd->print(r.minuto);
            rellenar(n);
        }
    }

private:
    LiquidCrystal_I2C lcd27{0x27, 16, 2};
    LiquidCrystal_I2C lcd3F{0x3F, 16, 2};
    LiquidCrystal_I2C* lcd;
    uint8_t pagina;
    unsigned long tPagina;

    // Borra lo que quedaba de la línea anterior
    void rellenar(size_t escritos) {
        while (escritos++ < 16) lcd->print(' ');
    }
};
#endif

// ---------------------------------------------------------------------
//  Componentes que maneja el controlador
// ---------------------------------------------------------------------
struct Componentes {
    SensorTemperatura&  temperatura;
    SensorHumedad&      humedadAire;
    SensorHumedadSuelo& humedadSuelo;
    SensorNivelAgua&    nivelAgua;
    BombaAgua&          bomba;
    Ventilador&         ventilador;
    LuzCultivo&         luz;
    IndicadorLED&       ledHumedadBaja;
    IndicadorLED&       ledHumedadAlta;
    IndicadorLED&       ledEstado;
    Zumbador&           zumbador;
    BotonPulsador&      boton;
};

// ---------------------------------------------------------------------
//  ControladorArduino: lee sensores, evalúa reglas, mueve actuadores,
//  atiende comandos y envía telemetría (una línea JSON por muestra).
// ---------------------------------------------------------------------
class ControladorArduino {
public:
    unsigned long puertoSerie;
    unsigned long frecuenciaMuestreo;
    EstadoSistema estadoActual;

    static const uint8_t MAX_SENSORES = 4;
    static const uint8_t MAX_ACTUADORES = 8;

    ControladorArduino(const Componentes& componentes, Ajustes& ajustes, ReglaControl& reglaControl,
                       unsigned long puerto = VELOCIDAD_SERIE,
                       unsigned long freq = INTERVALO_MUESTREO_MS)
        : puertoSerie(puerto), frecuenciaMuestreo(freq), estadoActual(ESTADO_SIN_DATOS),
          c(componentes), cfg(ajustes), regla(reglaControl),
          numSensores(0), numActuadores(0), ultimoMuestreo(0),
          deseoVentilador(false), deseoLuz(false), alarmaActiva(false),
          ultimaAlarma(0), silencioHasta(0), silenciado(false), largoLinea(0), lineaDescartada(false) {
        agregarSensor(&c.temperatura);
        agregarSensor(&c.humedadAire);
        agregarSensor(&c.humedadSuelo);
        agregarSensor(&c.nivelAgua);
        agregarActuador(&c.bomba);
        agregarActuador(&c.ventilador);
        agregarActuador(&c.luz);
        agregarActuador(&c.ledHumedadBaja);
        agregarActuador(&c.ledHumedadAlta);
        agregarActuador(&c.ledEstado);
        agregarActuador(&c.zumbador);
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
        // Actuadores primero: relés apagados lo antes posible.
        for (uint8_t i = 0; i < numActuadores; i++) actuadores[i]->inicializar();
        Serial.begin(puertoSerie);
        const bool habiaAjustes = AlmacenAjustes::cargar(cfg);
        for (uint8_t i = 0; i < numSensores; i++) sensores[i]->inicializar();
        if (USAR_BOTON) c.boton.inicializar();
        reloj.ajustar(HORA_AL_ARRANCAR, 0, 0, millis(), false);

        Serial.println(F("# Smart Greenhouse IoT v" FIRMWARE_VERSION));
        Serial.println(habiaAjustes ? F("# Ajustes cargados de la EEPROM")
                                    : F("# Ajustes de fabrica (EEPROM vacia o de otra version)"));
        Serial.print(F("# DS18B20 detectados: "));
        Serial.println(c.temperatura.sensoresDetectados());
        if (c.temperatura.sensoresDetectados() == 0) {
            Serial.println(F("# AVISO: no se detecta el DS18B20. Revisa el cable de datos y la resistencia de 4.7k"));
        }
#if USAR_LCD
        Serial.println(pantalla.inicializar() ? F("# Pantalla LCD detectada")
                                              : F("# Pantalla LCD no detectada (se continua sin ella)"));
#endif
        Serial.println(F("# Escribe AYUDA para ver los comandos"));
        enviarAjustes();
        if (USAR_ZUMBADOR) c.zumbador.pitar(1, 80);
        ultimoMuestreo = millis();
    }

    // Se llama en cada vuelta del loop.
    void ciclo(unsigned long ahora) {
        reloj.mantener(ahora);
        if (USAR_BOTON) atenderBoton(c.boton.actualizar(ahora), ahora);
        atenderSerie(ahora);
        for (uint8_t i = 0; i < numActuadores; i++) actuadores[i]->actualizar(ahora);
        aplicarCargas();

        if ((ahora - ultimoMuestreo) >= frecuenciaMuestreo) {
            ultimoMuestreo = ahora;
            leerSensores(ahora);
            ejecutarLogica(ahora);
            enviarTelemetria(ahora);
            mostrarPantalla(ahora);
        }
#if USAR_LCD
        else if (pantalla.disponible() && pantalla.tocaCambiarPagina(ahora)) {
            mostrarPantalla(ahora);
        }
#endif
    }

    void leerSensores(unsigned long ahora) {
        for (uint8_t i = 0; i < numSensores; i++) {
            if (sensores[i]->activo) sensores[i]->obtenerLectura(ahora);
        }
    }

    void ejecutarLogica(unsigned long ahora) {
        regla.evaluarTemperatura(c.temperatura.ultimaLectura());
        regla.evaluarHumedad(c.humedadAire.ultimaLectura());
        regla.evaluarHumedadSuelo(c.humedadSuelo.ultimaLectura(), USAR_SONDA_SUELO);
        regla.evaluarNivelAgua(c.nivelAgua.hayAgua, USAR_SONDA_NIVEL_AGUA);
        estadoActual = regla.obtenerEstado();

        deseoVentilador = regla.requiereVentilacion();
        deseoLuz = USAR_LUZ && luzDeseada(ahora);

        // Bomba: pulsos mientras haga falta. Un riego manual termina su pulso,
        // salvo que se acabe el agua.
        if (regla.requiereRiego()) {
            if (!c.bomba.estado) {
                // Con alimentación solo-Arduino, primero se apagan las otras cargas.
                if (ALIMENTACION_SOLO_ARDUINO) { c.ventilador.apagar(); c.luz.apagar(); }
                c.bomba.solicitarPulso(ahora);
            }
        } else if (c.bomba.estado && (!c.bomba.esManual() || regla.riegoBloqueadoPorTanque())) {
            c.bomba.apagar();
        }
        aplicarCargas();

        actualizarIndicadores();
        actualizarAlarma(ahora);
        c.ledEstado.cambiarEstado();   // latido: el sistema sigue vivo
    }

    // Una línea JSON por muestra. Las líneas que empiezan con '#' son mensajes.
    void enviarTelemetria(unsigned long ahora) {
        const LecturaDato t = c.temperatura.ultimaLectura();
        const LecturaDato s = c.humedadSuelo.ultimaLectura();
        Serial.print(F("{\"tipo\":\"tel\",\"t_ms\":"));   Serial.print(ahora);
        Serial.print(F(",\"hora\":\""));
        imprimirHora(Serial, reloj.hora(ahora), reloj.minuto(ahora), reloj.segundo(ahora));
        Serial.print(F("\",\"hora_sync\":"));             Serial.print(reloj.estaSincronizado() ? 1 : 0);
        Serial.print(F(",\"temp_c\":"));
        if (t.esValida()) Serial.print(t.valor, 2); else Serial.print(F("null"));
        Serial.print(F(",\"hum_aire\":"));                Serial.print(c.humedadAire.porcentajeHumedad(), 1);
        Serial.print(F(",\"adc_aire\":"));
        if (c.humedadAire.valorAdc >= 0) Serial.print(c.humedadAire.valorAdc); else Serial.print(F("null"));
        Serial.print(F(",\"do_aire\":"));                 Serial.print(c.humedadAire.superaUmbral ? 1 : 0);
        Serial.print(F(",\"hum_suelo\":"));
        if (USAR_SONDA_SUELO && s.esValida()) Serial.print(s.valor, 1); else Serial.print(F("null"));
        Serial.print(F(",\"adc_suelo\":"));
        if (USAR_SONDA_SUELO) Serial.print(c.humedadSuelo.valorAdc); else Serial.print(F("null"));
        Serial.print(F(",\"agua\":"));
        if (USAR_SONDA_NIVEL_AGUA) Serial.print(c.nivelAgua.hayAgua ? 1 : 0); else Serial.print(F("null"));
        Serial.print(F(",\"adc_agua\":"));
        if (USAR_SONDA_NIVEL_AGUA) Serial.print(c.nivelAgua.valorAdc); else Serial.print(F("null"));
        Serial.print(F(",\"estado\":\""));                Serial.print(textoEstado(estadoActual));
        Serial.print(F("\",\"aire\":\""));                Serial.print(textoNivel(regla.obtenerEstadoAire()));
        Serial.print(F("\",\"suelo\":\""));               Serial.print(textoNivel(regla.obtenerEstadoSuelo()));
        Serial.print(F("\",\"ventilador\":"));            Serial.print(c.ventilador.estado ? 1 : 0);
        Serial.print(F(",\"bomba\":"));                   Serial.print(c.bomba.estado ? 1 : 0);
        Serial.print(F(",\"luz\":"));                     Serial.print(c.luz.estado ? 1 : 0);
        Serial.print(F(",\"alarma\":"));                  Serial.print(alarmaActiva ? (silenciado ? 2 : 1) : 0);
        Serial.print(F(",\"bomba_s_hora\":"));            Serial.print(c.bomba.segundosUsadosEnHora());
        Serial.println('}');
    }

    void enviarAjustes() {
        Serial.print(F("{\"tipo\":\"cfg\",\"version\":\"" FIRMWARE_VERSION "\""));
        Serial.print(F(",\"temp_max\":"));       Serial.print(cfg.tempMax, 1);
        Serial.print(F(",\"temp_hist\":"));      Serial.print(cfg.tempHisteresis, 1);
        Serial.print(F(",\"temp_crit\":"));      Serial.print(cfg.tempCritica, 1);
        Serial.print(F(",\"hum_min\":"));        Serial.print(cfg.humAireMin, 1);
        Serial.print(F(",\"hum_max\":"));        Serial.print(cfg.humAireMax, 1);
        Serial.print(F(",\"suelo_min\":"));      Serial.print(cfg.humSueloMin, 1);
        Serial.print(F(",\"suelo_max\":"));      Serial.print(cfg.humSueloMax, 1);
        Serial.print(F(",\"hist\":"));           Serial.print(cfg.humHisteresis, 1);
        Serial.print(F(",\"adc_aire_seco\":"));  Serial.print(cfg.adcAireSeco);
        Serial.print(F(",\"adc_aire_hum\":"));   Serial.print(cfg.adcAireHumedo);
        Serial.print(F(",\"adc_suelo_seco\":")); Serial.print(cfg.adcSueloSeco);
        Serial.print(F(",\"adc_suelo_hum\":"));  Serial.print(cfg.adcSueloHumedo);
        Serial.print(F(",\"umbral_agua\":"));    Serial.print(cfg.adcUmbralAgua);
        Serial.print(F(",\"luz_ini\":"));        Serial.print(cfg.luzHoraInicio);
        Serial.print(F(",\"luz_fin\":"));        Serial.print(cfg.luzHoraFin);
        Serial.print(F(",\"luz_modo\":\""));
        Serial.print(cfg.modoLuz == LUZ_SIEMPRE_ON ? F("ON") : cfg.modoLuz == LUZ_SIEMPRE_OFF ? F("OFF") : F("AUTO"));
        Serial.print(F("\",\"solo_arduino\":")); Serial.print(ALIMENTACION_SOLO_ARDUINO ? 1 : 0);
        Serial.print(F(",\"sonda_suelo\":"));    Serial.print(USAR_SONDA_SUELO ? 1 : 0);
        Serial.print(F(",\"sonda_agua\":"));     Serial.print(USAR_SONDA_NIVEL_AGUA ? 1 : 0);
        Serial.print(F(",\"usa_luz\":"));        Serial.print(USAR_LUZ ? 1 : 0);
        Serial.print(F(",\"lcd\":"));
#if USAR_LCD
        Serial.print(pantalla.disponible() ? 1 : 0);
#else
        Serial.print(0);
#endif
        Serial.println('}');
    }

private:
    Componentes c;
    Ajustes& cfg;
    ReglaControl& regla;
    RelojSoftware reloj;
#if USAR_LCD
    PantallaLCD pantalla;
#endif
    Sensor* sensores[MAX_SENSORES];
    Actuador* actuadores[MAX_ACTUADORES];
    uint8_t numSensores;
    uint8_t numActuadores;
    unsigned long ultimoMuestreo;
    bool deseoVentilador;
    bool deseoLuz;
    bool alarmaActiva;
    unsigned long ultimaAlarma;
    unsigned long silencioHasta;
    bool silenciado;
    char linea[40];
    uint8_t largoLinea;
    bool lineaDescartada;

    bool luzDeseada(unsigned long ahora) const {
        if (cfg.modoLuz == LUZ_SIEMPRE_ON)  return true;
        if (cfg.modoLuz == LUZ_SIEMPRE_OFF) return false;
        return luzEnHorario(reloj.segundosDelDia(ahora), cfg.luzHoraInicio, cfg.luzHoraFin);
    }

    // Respeta el límite de energía cada vez que cambia algo.
    void aplicarCargas() {
        const CargasPermitidas p = repartirEnergia(c.bomba.estado, deseoVentilador, deseoLuz,
                                                   ALIMENTACION_SOLO_ARDUINO);
        if (c.ventilador.estado != p.ventilador) c.ventilador.fijar(p.ventilador);
        if (c.luz.estado != p.luz)               c.luz.fijar(p.luz);
    }

    void actualizarIndicadores() {
        if (regla.hayFallaSensor()) {
            c.ledHumedadBaja.parpadear(PERIODO_PARPADEO_MS, false);
            c.ledHumedadAlta.parpadear(PERIODO_PARPADEO_MS, true);
            return;
        }
        if (regla.estaTanqueVacio()) {
            c.ledHumedadBaja.parpadear(PERIODO_PARPADEO_MS / 2);   // rojo rápido: sin agua
            c.ledHumedadAlta.apagar();
            return;
        }
        const bool baja = regla.obtenerEstadoAire() == NIVEL_BAJO || regla.obtenerEstadoSuelo() == NIVEL_BAJO;
        const bool alta = regla.obtenerEstadoAire() == NIVEL_ALTO;
        c.ledHumedadBaja.fijar(baja);
        c.ledHumedadAlta.fijar(alta);
    }

    void actualizarAlarma(unsigned long ahora) {
        const bool hay = regla.hayAlarma();
        if (silenciado && (long)(ahora - silencioHasta) >= 0) silenciado = false;
        if (!hay) { alarmaActiva = false; return; }
        const bool nueva = !alarmaActiva;
        alarmaActiva = true;
        if (!USAR_ZUMBADOR || silenciado) return;
        if (nueva || (ahora - ultimaAlarma) >= REPETIR_ALARMA_MS) {
            ultimaAlarma = ahora;
            c.zumbador.pitar(3);
        }
    }

    void silenciarAlarma(unsigned long ahora) {
        silenciado = true;
        silencioHasta = ahora + SILENCIO_ALARMA_MS;
        c.zumbador.apagar();
    }

    void riegoManual(unsigned long ahora) {
        if (regla.riegoBloqueadoPorTanque()) {
            Serial.println(F("{\"tipo\":\"error\",\"msg\":\"Sin agua en el tanque\"}"));
            if (USAR_ZUMBADOR) c.zumbador.pitar(2, 300);
            return;
        }
        if (ALIMENTACION_SOLO_ARDUINO) { c.ventilador.apagar(); c.luz.apagar(); }
        if (c.bomba.solicitarPulso(ahora, true)) {
            Serial.println(F("{\"tipo\":\"ok\",\"cmd\":\"RIEGO\"}"));
            if (USAR_ZUMBADOR) c.zumbador.pitar(1, 60);
        } else {
            Serial.println(F("{\"tipo\":\"error\",\"msg\":\"La bomba esta regando o se agoto el cupo de la hora\"}"));
        }
        aplicarCargas();
    }

    void atenderBoton(EventoBoton e, unsigned long ahora) {
        if (e == BOTON_NADA) return;
        if (e == BOTON_LARGO) {
            silenciarAlarma(ahora);
            Serial.println(F("# Alarma silenciada 10 min (boton)"));
            return;
        }
        // Pulsación corta: si la alarma está sonando, la silencia; si no, riega.
        if (alarmaActiva && !silenciado && USAR_ZUMBADOR) {
            silenciarAlarma(ahora);
            Serial.println(F("# Alarma silenciada 10 min (boton)"));
        } else {
            riegoManual(ahora);
        }
    }

    void mostrarPantalla(unsigned long ahora) {
#if USAR_LCD
        if (!pantalla.disponible()) return;
        ResumenEstado r;
        const LecturaDato t = c.temperatura.ultimaLectura();
        const LecturaDato s = c.humedadSuelo.ultimaLectura();
        r.tempValida  = t.esValida();
        r.temperatura = t.valor;
        r.humAire     = c.humedadAire.porcentajeHumedad();
        r.sueloUsado  = USAR_SONDA_SUELO;
        r.sueloValido = s.esValida();
        r.humSuelo    = s.valor;
        r.aguaUsada   = USAR_SONDA_NIVEL_AGUA;
        r.hayAgua     = c.nivelAgua.hayAgua;
        r.estado      = textoEstado(estadoActual);
        r.ventilador  = c.ventilador.estado;
        r.bomba       = c.bomba.estado;
        r.luz         = c.luz.estado;
        r.hora        = reloj.hora(ahora);
        r.minuto      = reloj.minuto(ahora);
        pantalla.mostrar(r, ahora);
#else
        (void)ahora;
#endif
    }

    // ----------------------- Comandos serie -----------------------

    void atenderSerie(unsigned long ahora) {
        while (Serial.available() > 0) {
            const char ch = (char)Serial.read();
            if (ch == '\n' || ch == '\r') {
                if (largoLinea > 0 && !lineaDescartada) {
                    linea[largoLinea] = '\0';
                    ejecutarComando(ahora);
                } else if (lineaDescartada) {
                    Serial.println(F("{\"tipo\":\"error\",\"msg\":\"Comando demasiado largo\"}"));
                }
                largoLinea = 0;
                lineaDescartada = false;
            } else if (largoLinea < sizeof(linea) - 1) {
                linea[largoLinea++] = ch;
            } else {
                lineaDescartada = true;
            }
        }
    }

    void responderOk(const char* cmd) {
        Serial.print(F("{\"tipo\":\"ok\",\"cmd\":\""));
        Serial.print(cmd);
        Serial.println(F("\"}"));
    }

    void responderError(const __FlashStringHelper* msg) {
        Serial.print(F("{\"tipo\":\"error\",\"msg\":\""));
        Serial.print(msg);
        Serial.println(F("\"}"));
    }

    // Aplica un cambio solo si el resultado es válido; luego lo guarda.
    bool confirmarCambio(Ajustes& nuevo, const char* cmd) {
        sellarAjustes(nuevo);
        if (!ajustesValidos(nuevo)) {
            responderError(F("Valor fuera de rango"));
            return false;
        }
        cfg = nuevo;
        AlmacenAjustes::guardar(cfg);
        responderOk(cmd);
        enviarAjustes();
        return true;
    }

    void ejecutarComando(unsigned long ahora) {
        Comando cmd;
        if (!parsearComando(linea, cmd)) return;
        const char* n = cmd.nombre;
        Ajustes nuevo = cfg;
        const bool hayNumero = cmd.cantidadNumeros >= 1;
        const float v = cmd.numeros[0];

        if (!strcmp(n, "AYUDA") || !strcmp(n, "?")) { imprimirAyuda(); return; }
        if (!strcmp(n, "ESTADO"))   { enviarAjustes(); return; }
        if (!strcmp(n, "RIEGO"))    { riegoManual(ahora); return; }
        if (!strcmp(n, "SILENCIO")) { silenciarAlarma(ahora); responderOk(n); return; }
        if (!strcmp(n, "FABRICA"))  { Ajustes f = AlmacenAjustes::deFabrica(); confirmarCambio(f, n); return; }

        if (!strcmp(n, "HORA")) {
            if (cmd.cantidadNumeros < 2 || v < 0 || v > 23 || cmd.numeros[1] < 0 || cmd.numeros[1] > 59) {
                responderError(F("Uso: HORA hh:mm[:ss]"));
                return;
            }
            const float sg = cmd.cantidadNumeros >= 3 ? cmd.numeros[2] : 0;
            reloj.ajustar((uint8_t)v, (uint8_t)cmd.numeros[1], (uint8_t)(sg >= 0 && sg < 60 ? sg : 0), ahora);
            responderOk(n);
            return;
        }

        if (!strcmp(n, "LUZ")) {
            if (!strcmp(cmd.texto, "ON"))        nuevo.modoLuz = LUZ_SIEMPRE_ON;
            else if (!strcmp(cmd.texto, "OFF"))  nuevo.modoLuz = LUZ_SIEMPRE_OFF;
            else if (!strcmp(cmd.texto, "AUTO")) nuevo.modoLuz = LUZ_AUTO;
            else if (cmd.cantidadNumeros >= 2 && v >= 0 && v <= 23 && cmd.numeros[1] >= 0 && cmd.numeros[1] <= 23) {
                nuevo.luzHoraInicio = (uint8_t)v;
                nuevo.luzHoraFin = (uint8_t)cmd.numeros[1];
                nuevo.modoLuz = LUZ_AUTO;
            } else {
                responderError(F("Uso: LUZ ON | LUZ OFF | LUZ AUTO | LUZ inicio fin"));
                return;
            }
            confirmarCambio(nuevo, n);
            return;
        }

        if (!strcmp(n, "CAL")) { calibrar(cmd.texto, nuevo); return; }

        // Comandos de un número: NOMBRE valor
        float* destino = nullptr;
        if      (!strcmp(n, "TEMP"))      destino = &nuevo.tempMax;
        else if (!strcmp(n, "TEMPCRIT"))  destino = &nuevo.tempCritica;
        else if (!strcmp(n, "TEMPHIST"))  destino = &nuevo.tempHisteresis;
        else if (!strcmp(n, "HUMMIN"))    destino = &nuevo.humAireMin;
        else if (!strcmp(n, "HUMMAX"))    destino = &nuevo.humAireMax;
        else if (!strcmp(n, "SUELOMIN"))  destino = &nuevo.humSueloMin;
        else if (!strcmp(n, "SUELOMAX"))  destino = &nuevo.humSueloMax;
        else if (!strcmp(n, "HIST"))      destino = &nuevo.humHisteresis;

        if (destino != nullptr) {
            if (!hayNumero) { responderError(F("Falta el valor")); return; }
            *destino = v;
            confirmarCambio(nuevo, n);
            return;
        }
        if (!strcmp(n, "UMBRALAGUA")) {
            if (!hayNumero) { responderError(F("Falta el valor")); return; }
            nuevo.adcUmbralAgua = (int16_t)v;
            confirmarCambio(nuevo, n);
            return;
        }
        responderError(F("Comando desconocido. Escribe AYUDA"));
    }

    // CAL AIRESECO | AIREHUMEDO | SUELOSECO | SUELOHUMEDO | TANQUE
    void calibrar(const char* que, Ajustes& nuevo) {
        if (!strcmp(que, "AIRESECO"))         nuevo.adcAireSeco = (int16_t)c.humedadAire.medirAdc();
        else if (!strcmp(que, "AIREHUMEDO"))  nuevo.adcAireHumedo = (int16_t)c.humedadAire.medirAdc();
        else if (!strcmp(que, "SUELOSECO"))   nuevo.adcSueloSeco = (int16_t)c.humedadSuelo.medirAdc();
        else if (!strcmp(que, "SUELOHUMEDO")) nuevo.adcSueloHumedo = (int16_t)c.humedadSuelo.medirAdc();
        else if (!strcmp(que, "TANQUE")) {
            // Con los dos cables DENTRO del agua: el umbral queda a mitad de camino
            // entre la lectura con agua y la lectura al aire (1023).
            nuevo.adcUmbralAgua = (int16_t)((c.nivelAgua.medirAdc() + 1023) / 2);
        } else {
            responderError(F("Uso: CAL AIRESECO|AIREHUMEDO|SUELOSECO|SUELOHUMEDO|TANQUE"));
            return;
        }
        confirmarCambio(nuevo, "CAL");
    }

    void imprimirAyuda() {
        Serial.println(F("# Comandos (mayusculas o minusculas):"));
        Serial.println(F("#  ESTADO              ver ajustes actuales"));
        Serial.println(F("#  TEMP 30             temperatura para ventilar (C)"));
        Serial.println(F("#  TEMPCRIT 35         temperatura de alarma (C)"));
        Serial.println(F("#  TEMPHIST 2          histeresis de temperatura (C)"));
        Serial.println(F("#  HUMMIN 40 / HUMMAX 80   humedad del aire baja / alta (%)"));
        Serial.println(F("#  SUELOMIN 30 / SUELOMAX 85  suelo seco / encharcado (%)"));
        Serial.println(F("#  HIST 5              histeresis de humedad (%)"));
        Serial.println(F("#  LUZ 6 18 | LUZ ON | LUZ OFF | LUZ AUTO"));
        Serial.println(F("#  HORA 14:30          poner el reloj en hora"));
        Serial.println(F("#  RIEGO               riego manual (un pulso)"));
        Serial.println(F("#  SILENCIO            silenciar la alarma 10 min"));
        Serial.println(F("#  CAL AIRESECO | CAL AIREHUMEDO | CAL SUELOSECO | CAL SUELOHUMEDO | CAL TANQUE"));
        Serial.println(F("#  UMBRALAGUA 700      umbral de la sonda del tanque (ADC)"));
        Serial.println(F("#  FABRICA             volver a los valores de fabrica"));
    }
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

    void asignarControlador(ControladorArduino* c) { controlador = c; }

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
        if (sistemaActivo && controlador != nullptr) controlador->ciclo(ahora);
    }
};

#endif // GREENHOUSE_CORE_HPP
