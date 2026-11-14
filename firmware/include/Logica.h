#ifndef GREENHOUSE_LOGICA_H
#define GREENHOUSE_LOGICA_H

// =====================================================================
//  Lógica pura del invernadero (sin dependencias de Arduino)
//
//  Todo lo que aquí aparece se puede compilar y probar en el computador
//  (pruebas unitarias en firmware/test/). Las clases que tocan pines,
//  sensores o la pantalla están en GreenhouseCore.hpp.
// =====================================================================

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>

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

    bool esValida() const { return valida; }

    // Funciona con Serial, con la pantalla o con cualquier objeto que tenga print().
    template <class Salida>
    void formatearSalida(Salida& salida) const {
        salida.print("Lectura #");
        salida.print(idLectura);
        salida.print(": ");
        if (valida) {
            salida.print(valor, 1);
            salida.print(' ');
            salida.print(unidad);
        } else {
            salida.print("INVALIDA");
        }
    }
};

// ---------------------------------------------------------------------
//  Conversión de una lectura del ADC (0-1023) a porcentaje (0-100)
//  entre dos puntos de calibración. El orden de los puntos no importa.
// ---------------------------------------------------------------------
inline float adcAPorcentaje(int adc, int adcSeco, int adcHumedo) {
    if (adcSeco == adcHumedo) return 0.0f;
    float pct = (float)(adc - adcSeco) * 100.0f / (float)(adcHumedo - adcSeco);
    if (pct < 0.0f)   pct = 0.0f;
    if (pct > 100.0f) pct = 100.0f;
    return pct;
}

// ---------------------------------------------------------------------
//  Ajustes que se pueden cambiar por comandos y se guardan en la EEPROM
// ---------------------------------------------------------------------
struct Ajustes {
    uint16_t magia;          // identifica que la EEPROM tiene ajustes válidos
    uint8_t  version;
    float tempMax;           // °C: por encima se ventila
    float tempHisteresis;    // °C
    float tempCritica;       // °C: por encima suena la alarma
    float humSueloMin;       // %: por debajo, suelo SECO
    float humSueloMax;       // %: por encima, suelo ENCHARCADO
    float humHisteresis;     // %
    int16_t adcSueloSeco;    // calibración sonda de suelo
    int16_t adcSueloHumedo;
    int16_t adcUmbralAgua;   // sonda del tanque: por debajo = hay agua
    uint8_t checksum;
};

const uint16_t AJUSTES_MAGIA   = 0x1A5E;
const uint8_t  AJUSTES_VERSION = 4;

inline uint8_t calcularChecksum(const Ajustes& a) {
    const uint8_t* p = reinterpret_cast<const uint8_t*>(&a);
    uint8_t suma = 0;
    for (size_t i = 0; i < offsetof(Ajustes, checksum); i++) {   // todo lo anterior al checksum
        suma = (uint8_t)((suma << 1) | (suma >> 7));      // rotación para detectar bytes cambiados de sitio
        suma ^= p[i];
    }
    return suma;
}

inline void sellarAjustes(Ajustes& a) {
    a.magia = AJUSTES_MAGIA;
    a.version = AJUSTES_VERSION;
    a.checksum = calcularChecksum(a);
}

inline bool enRango(float v, float lo, float hi) { return !isnan(v) && v >= lo && v <= hi; }

// Comprueba que los valores tengan sentido (EEPROM vacía, corrupta o de otra versión -> false)
inline bool ajustesValidos(const Ajustes& a) {
    if (a.magia != AJUSTES_MAGIA || a.version != AJUSTES_VERSION) return false;
    if (a.checksum != calcularChecksum(a)) return false;
    if (!enRango(a.tempMax, 0, 60) || !enRango(a.tempHisteresis, 0.1f, 10)) return false;
    if (!enRango(a.tempCritica, a.tempMax, 80)) return false;
    if (!enRango(a.humSueloMin, 0, 100) || !enRango(a.humSueloMax, a.humSueloMin, 100)) return false;
    if (!enRango(a.humHisteresis, 0, 30)) return false;
    if (a.adcSueloSeco == a.adcSueloHumedo) return false;
    if (a.adcSueloSeco < 0 || a.adcSueloSeco > 1023 || a.adcSueloHumedo < 0 || a.adcSueloHumedo > 1023) return false;
    if (a.adcUmbralAgua < 1 || a.adcUmbralAgua > 1022) return false;
    return true;
}

// ---------------------------------------------------------------------
//  Histéresis: para entrar en BAJA/ALTA basta cruzar el umbral; para
//  salir hay que alejarse 'histeresis' unidades. Evita que los relés
//  se enciendan y apaguen a cada rato cuando el valor está en el límite.
// ---------------------------------------------------------------------
enum EstadoNivel : uint8_t {
    NIVEL_DESCONOCIDO = 0,
    NIVEL_BAJO,
    NIVEL_NORMAL,
    NIVEL_ALTO,
    NIVEL_NO_USADO
};

inline EstadoNivel clasificar(float v, float minimo, float maximo) {
    if (v < minimo) return NIVEL_BAJO;
    if (v > maximo) return NIVEL_ALTO;
    return NIVEL_NORMAL;
}

inline EstadoNivel clasificarConHisteresis(EstadoNivel actual, float v,
                                           float minimo, float maximo, float histeresis) {
    switch (actual) {
        case NIVEL_BAJO:
            return (v >= minimo + histeresis) ? clasificar(v, minimo, maximo) : NIVEL_BAJO;
        case NIVEL_ALTO:
            return (v <= maximo - histeresis) ? clasificar(v, minimo, maximo) : NIVEL_ALTO;
        default:
            return clasificar(v, minimo, maximo);
    }
}

// ---------------------------------------------------------------------
//  Estado general del sistema (de mayor a menor prioridad)
// ---------------------------------------------------------------------
enum EstadoSistema : uint8_t {
    ESTADO_NORMAL = 0,
    ESTADO_HUMEDAD_ALTA,
    ESTADO_SUELO_ENCHARCADO,
    ESTADO_SUELO_SECO,
    ESTADO_TEMPERATURA_ALTA,
    ESTADO_TEMPERATURA_CRITICA,
    ESTADO_SIN_AGUA,
    ESTADO_SIN_DATOS,
    ESTADO_FALLA_SENSOR_TEMPERATURA
};

inline const char* nombreEstado(EstadoSistema e) {
    switch (e) {
        case ESTADO_HUMEDAD_ALTA:             return "HUMEDAD_ALTA";
        case ESTADO_SUELO_ENCHARCADO:         return "SUELO_ENCHARCADO";
        case ESTADO_SUELO_SECO:               return "SUELO_SECO";
        case ESTADO_TEMPERATURA_ALTA:         return "TEMPERATURA_ALTA";
        case ESTADO_TEMPERATURA_CRITICA:      return "TEMPERATURA_CRITICA";
        case ESTADO_SIN_AGUA:                 return "SIN_AGUA";
        case ESTADO_SIN_DATOS:                return "SIN_DATOS";
        case ESTADO_FALLA_SENSOR_TEMPERATURA: return "FALLA_SENSOR_TEMP";
        default:                              return "NORMAL";
    }
}

inline const char* nombreNivel(EstadoNivel e) {
    switch (e) {
        case NIVEL_BAJO:     return "BAJA";
        case NIVEL_NORMAL:   return "NORMAL";
        case NIVEL_ALTO:     return "ALTA";
        case NIVEL_NO_USADO: return "NO_USADO";
        default:             return "DESCONOCIDA";
    }
}

// ---------------------------------------------------------------------
//  ReglaControl: decide qué hacer a partir de las lecturas
// ---------------------------------------------------------------------
class ReglaControl {
public:
    explicit ReglaControl(const Ajustes& ajustes)
        : cfg(ajustes), calor(false), critico(false), fallaTemperatura(false),
          estadoAire(NIVEL_DESCONOCIDO), estadoSuelo(NIVEL_NO_USADO),
          tanqueVacio(false) {}

    void evaluarTemperatura(const LecturaDato& t) {
        if (!t.esValida()) {
            fallaTemperatura = true;
            critico = false;
            return;
        }
        fallaTemperatura = false;
        if (!calor && t.valor > cfg.tempMax) calor = true;
        else if (calor && t.valor < cfg.tempMax - cfg.tempHisteresis) calor = false;
        critico = t.valor >= cfg.tempCritica;
    }

    // Humedad del aire: el módulo HR202 entrega un contacto (1 = supera el umbral
    // ajustado con su potenciómetro, 0 = no lo supera). No hay porcentaje.
    void evaluarHumedad(const LecturaDato& h) {
        if (!h.esValida()) { estadoAire = NIVEL_DESCONOCIDO; return; }
        estadoAire = (h.valor > 0.5f) ? NIVEL_ALTO : NIVEL_NORMAL;
    }

    // usada = false si la sonda de suelo no está instalada.
    void evaluarHumedadSuelo(const LecturaDato& s, bool usada) {
        if (!usada)          { estadoSuelo = NIVEL_NO_USADO; return; }
        if (!s.esValida())   { estadoSuelo = NIVEL_DESCONOCIDO; return; }
        if (estadoSuelo == NIVEL_NO_USADO) estadoSuelo = NIVEL_DESCONOCIDO;
        estadoSuelo = clasificarConHisteresis(estadoSuelo, s.valor,
                                              cfg.humSueloMin, cfg.humSueloMax, cfg.humHisteresis);
    }

    void evaluarNivelAgua(bool hayAgua, bool usada) {
        tanqueVacio = usada && !hayAgua;
    }

    // --- Decisiones ---

    // Ventilar por calor, por humedad del aire alta o, por seguridad,
    // si el sensor de temperatura falla.
    bool requiereVentilacion() const {
        return calor || fallaTemperatura || estadoAire == NIVEL_ALTO;
    }

    // Riego automático solo cuando la sonda confirma suelo seco y hay agua.
    // Sin lectura válida del suelo no se riega de forma automática.
    bool requiereRiego() const {
        return !tanqueVacio && estadoSuelo == NIVEL_BAJO;
    }

    bool riegoBloqueadoPorTanque() const { return tanqueVacio; }

    bool hayFallaSensor() const {
        return fallaTemperatura;
    }

    // Situaciones que merecen sonido
    bool hayAlarma() const {
        return fallaTemperatura || critico || tanqueVacio;
    }

    bool hayCalor() const                    { return calor; }
    EstadoNivel obtenerEstadoAire() const    { return estadoAire; }
    EstadoNivel obtenerEstadoSuelo() const   { return estadoSuelo; }
    bool estaTanqueVacio() const             { return tanqueVacio; }

    EstadoSistema obtenerEstado() const {
        if (fallaTemperatura)              return ESTADO_FALLA_SENSOR_TEMPERATURA;
        if (estadoAire == NIVEL_DESCONOCIDO) return ESTADO_SIN_DATOS;
        if (tanqueVacio)                   return ESTADO_SIN_AGUA;
        if (critico)                       return ESTADO_TEMPERATURA_CRITICA;
        if (calor)                         return ESTADO_TEMPERATURA_ALTA;
        if (estadoSuelo == NIVEL_BAJO)     return ESTADO_SUELO_SECO;
        if (estadoSuelo == NIVEL_ALTO)     return ESTADO_SUELO_ENCHARCADO;
        if (estadoAire == NIVEL_ALTO)      return ESTADO_HUMEDAD_ALTA;
        return ESTADO_NORMAL;
    }

private:
    const Ajustes& cfg;
    bool calor;
    bool critico;
    bool fallaTemperatura;
    EstadoNivel estadoAire;
    EstadoNivel estadoSuelo;
    bool tanqueVacio;
};

// ---------------------------------------------------------------------
//  CicloTrabajoBomba: pulsos de riego con pausa mínima y cupo por hora
//  (la bomba solo admite lapsos cortos: máx. 20 min por hora)
// ---------------------------------------------------------------------
class CicloTrabajoBomba {
public:
    CicloTrabajoBomba(unsigned long pulsoMs, unsigned long pausaMs,
                      unsigned long maxMsPorHora, unsigned long ventanaMs)
        : pulso(pulsoMs), pausa(pausaMs), cupo(maxMsPorHora), ventana(ventanaMs),
          encendida(false), haRegado(false), inicioPulso(0), duracionPulso(0),
          finUltimoPulso(0), inicioVentana(0), usadoEnVentana(0) {}

    // forzado = riego manual: ignora la pausa, pero respeta el cupo por hora.
    bool solicitarPulso(unsigned long ahora, bool forzado = false) {
        renovarVentana(ahora);
        if (encendida) return false;
        if (!forzado && haRegado && (ahora - finUltimoPulso) < pausa) return false;
        if (usadoEnVentana >= cupo) return false;
        const unsigned long disponible = cupo - usadoEnVentana;
        duracionPulso = (pulso < disponible) ? pulso : disponible;
        if (duracionPulso < 1000UL) return false;   // un pulso de menos de 1 s no sirve
        inicioPulso = ahora;
        encendida = true;
        return true;
    }

    // Devuelve true si el pulso acaba de terminar.
    bool actualizar(unsigned long ahora) {
        renovarVentana(ahora);
        if (encendida && (ahora - inicioPulso) >= duracionPulso) {
            detener(ahora);
            return true;
        }
        return false;
    }

    void detener(unsigned long ahora) {
        if (!encendida) return;
        usadoEnVentana += (ahora - inicioPulso);
        finUltimoPulso = ahora;
        haRegado = true;
        encendida = false;
    }

    bool estaEncendida() const               { return encendida; }
    unsigned long msUsadosEnHora() const     { return usadoEnVentana; }

private:
    unsigned long pulso, pausa, cupo, ventana;
    bool encendida, haRegado;
    unsigned long inicioPulso, duracionPulso, finUltimoPulso, inicioVentana, usadoEnVentana;

    void renovarVentana(unsigned long ahora) {
        if ((ahora - inicioVentana) >= ventana) {
            inicioVentana = ahora;
            usadoEnVentana = 0;
        }
    }
};

// ---------------------------------------------------------------------
//  Reparto de energía: con todo alimentado desde el USB del Arduino
//  solo una carga grande puede estar encendida. Prioridad:
//  bomba > ventilador.
// ---------------------------------------------------------------------
struct CargasPermitidas {
    bool bomba;
    bool ventilador;
};

inline CargasPermitidas repartirEnergia(bool quiereBomba, bool quiereVentilador, bool soloUnaCarga) {
    CargasPermitidas c;
    c.bomba = quiereBomba;
    c.ventilador = quiereVentilador && !(soloUnaCarga && c.bomba);
    return c;
}

// ---------------------------------------------------------------------
//  RelojSoftware: hora del día a partir de millis() (sin módulo RTC).
//  Se pone en hora con el comando HORA o automáticamente desde la
//  aplicación. Se muestra en la LCD y en la telemetría.
//  Precisión típica: unos minutos por día.
// ---------------------------------------------------------------------
const unsigned long SEGUNDOS_POR_DIA = 86400UL;

class RelojSoftware {
public:
    RelojSoftware() : segundosBase(0), msBase(0), sincronizado(false) {}

    void ajustar(uint8_t h, uint8_t m, uint8_t s, unsigned long ahoraMs, bool desdeUsuario = true) {
        segundosBase = ((unsigned long)h * 3600UL + (unsigned long)m * 60UL + s) % SEGUNDOS_POR_DIA;
        msBase = ahoraMs;
        sincronizado = desdeUsuario;
    }

    unsigned long segundosDelDia(unsigned long ahoraMs) const {
        return (segundosBase + (ahoraMs - msBase) / 1000UL) % SEGUNDOS_POR_DIA;
    }

    uint8_t hora(unsigned long ahoraMs) const   { return (uint8_t)(segundosDelDia(ahoraMs) / 3600UL); }
    uint8_t minuto(unsigned long ahoraMs) const { return (uint8_t)((segundosDelDia(ahoraMs) / 60UL) % 60UL); }
    uint8_t segundo(unsigned long ahoraMs) const{ return (uint8_t)(segundosDelDia(ahoraMs) % 60UL); }
    bool estaSincronizado() const               { return sincronizado; }

    // Con el reloj interno de millis() (~49 días) el desbordamiento cada
    // 49.7 días introduce un salto; se corrige re-anclando la base cada hora.
    void mantener(unsigned long ahoraMs) {
        if ((ahoraMs - msBase) >= 3600000UL) {
            const bool s = sincronizado;
            const unsigned long seg = segundosDelDia(ahoraMs);
            ajustar((uint8_t)(seg / 3600UL), (uint8_t)((seg / 60UL) % 60UL), (uint8_t)(seg % 60UL), ahoraMs, s);
        }
    }

private:
    unsigned long segundosBase;
    unsigned long msBase;
    bool sincronizado;
};

// ---------------------------------------------------------------------
//  Comandos por el puerto serie: "NOMBRE arg1 arg2 arg3"
// ---------------------------------------------------------------------
struct Comando {
    char nombre[12];
    char texto[12];      // primer argumento como texto (para CAL SUELOSECO...)
    float numeros[3];    // argumentos numéricos
    uint8_t cantidadNumeros;
    uint8_t cantidadArgumentos;
};

inline void copiarMayusculas(char* destino, const char* origen, size_t tam) {
    size_t i = 0;
    for (; origen[i] != '\0' && i < tam - 1; i++) destino[i] = (char)toupper((unsigned char)origen[i]);
    destino[i] = '\0';
}

inline bool esNumero(const char* s) {
    if (*s == '\0') return false;
    char* fin = nullptr;
    strtod(s, &fin);
    return fin != s && *fin == '\0';
}

// Devuelve la siguiente palabra de 'cursor' (separada por espacios) y avanza el cursor.
inline char* siguientePalabra(char*& cursor) {
    while (*cursor == ' ') cursor++;
    if (*cursor == '\0') return nullptr;
    char* inicio = cursor;
    while (*cursor != '\0' && *cursor != ' ') cursor++;
    if (*cursor == ' ') { *cursor = '\0'; cursor++; }
    return inicio;
}

// Modifica 'linea' (la separa en palabras). Devuelve false si está vacía.
// Acepta ':' como separador para escribir la hora como HORA 14:30:00.
inline bool parsearComando(char* linea, Comando& cmd) {
    memset(&cmd, 0, sizeof(cmd));
    for (char* p = linea; *p; p++) {
        if (*p == ':' || *p == ',' || *p == '\t' || *p == '\r' || *p == '\n') *p = ' ';
    }
    char* cursor = linea;
    char* palabra = siguientePalabra(cursor);
    if (palabra == nullptr) return false;
    copiarMayusculas(cmd.nombre, palabra, sizeof(cmd.nombre));

    while ((palabra = siguientePalabra(cursor)) != nullptr) {
        if (cmd.cantidadArgumentos == 0) copiarMayusculas(cmd.texto, palabra, sizeof(cmd.texto));
        if (cmd.cantidadArgumentos < 255) cmd.cantidadArgumentos++;
        if (esNumero(palabra) && cmd.cantidadNumeros < 3) {
            cmd.numeros[cmd.cantidadNumeros++] = (float)atof(palabra);
        }
    }
    return true;
}

#endif // GREENHOUSE_LOGICA_H
