// =====================================================================
//  Smart Greenhouse IoT — Versión para simular en Tinkercad Circuits
//
//  Tinkercad no tiene el DS18B20, el módulo HR202 ni los módulos relé, así que
//  esta versión usa piezas equivalentes (ver docs/tinkercad.md):
//
//    DS18B20      -> sensor de temperatura TMP36        (A3)
//    Módulo HR202 -> interruptor deslizante (contacto)  (D3)
//    Sonda suelo  -> "Soil Moisture Sensor"             (A1)
//    Sonda tanque -> interruptor deslizante             (A2)
//    Módulo relé  -> transistor NPN + relé + diodo      (D7, D8)
//    Bomba/vent.  -> motores DC
//    Zumbador     -> piezo                              (D10)
//    LCD I2C      -> "LCD 16 x 2 (I2C)"                 (A4, A5)
//
//  Copia todo este archivo en el editor de código de Tinkercad (modo Texto).
//  La lógica es la misma del firmware real, simplificada en un solo archivo.
//  Los tiempos de la bomba son más cortos para que se note en la simulación.
// =====================================================================

#include <Adafruit_LiquidCrystal.h>

// ---------------- Pines ----------------
const int PIN_BOTON      = 4;
const int PIN_LED_ROJO   = 5;
const int PIN_LED_AZUL   = 6;
const int PIN_BOMBA      = 7;
const int PIN_VENTILADOR = 8;
const int PIN_ZUMBADOR   = 10;
const int PIN_HUM_AIRE   = 3;    // interruptor: GND = contacto cerrado = aire húmedo
const int PIN_HUM_SUELO  = A1;   // sensor de humedad de suelo
const int PIN_TANQUE     = A2;   // interruptor: GND = hay agua
const int PIN_TMP36      = A3;

// ---------------- Ajustes ----------------
float tempMax = 30.0, tempHist = 2.0, tempCritica = 35.0;
float sueloMin = 30, sueloMax = 85, hist = 5;
const int MUESTRAS_ESTABLES = 3;          // igual que el firmware real
const unsigned long PULSO_MS = 3000;      // en el real: 5 s
const unsigned long PAUSA_MS = 10000;     // en el real: 60 s
const unsigned long MUESTREO_MS = 1000;

// ---------------- Estado ----------------
enum Nivel { BAJO, NORMAL, ALTO };
Nivel estadoSuelo = NORMAL;
bool aireAlto = false;
int cambiosAire = 0;
bool calor = false;
bool bomba = false, manual = false;
unsigned long inicioPulso = 0, finPulso = 0;
bool yaRego = false;
bool silenciado = false;
unsigned long ultimaAlarma = 0, ultimoMuestreo = 0;
unsigned long relojBaseSeg = 8UL * 3600UL, relojBaseMs = 0;   // arranca a las 08:00
int pagina = 0;
bool botonAntes = false;
bool aguaOk = true;
unsigned long botonDesde = 0;
String linea = "";

Adafruit_LiquidCrystal lcd(0);

// ---------------- Utilidades ----------------
Nivel clasificar(Nivel actual, float v, float mn, float mx) {
  if (actual == BAJO && v < mn + hist) return BAJO;
  if (actual == ALTO && v > mx - hist) return ALTO;
  if (v < mn) return BAJO;
  if (v > mx) return ALTO;
  return NORMAL;
}

const char* textoNivel(Nivel n) { return n == BAJO ? "BAJA" : n == ALTO ? "ALTA" : "NORMAL"; }

unsigned long segundosDelDia() {
  return (relojBaseSeg + (millis() - relojBaseMs) / 1000UL) % 86400UL;
}

void pitar(int veces) {
  for (int i = 0; i < veces; i++) { tone(PIN_ZUMBADOR, 2000, 120); delay(200); }
}

bool iniciarPulso(bool forzado) {
  if (bomba) return false;
  if (!forzado && yaRego && millis() - finPulso < PAUSA_MS) return false;
  bomba = true; manual = forzado; inicioPulso = millis();
  return true;
}

void detenerBomba() {
  if (!bomba) return;
  bomba = false; manual = false; finPulso = millis(); yaRego = true;
}

// ---------------- Comandos por el Monitor serie ----------------
void comando(String c) {
  c.trim(); c.toUpperCase();
  int esp = c.indexOf(' ');
  String n = esp < 0 ? c : c.substring(0, esp);
  float v = esp < 0 ? NAN : c.substring(esp + 1).toFloat();
  if (n == "AYUDA") {
    Serial.println("Comandos: TEMP 30, SUELOMIN 30, SUELOMAX 85, RIEGO, ESTADO");
  } else if (n == "TEMP" && v > 0)     { tempMax = v;    Serial.println("OK TEMP"); }
  else if (n == "SUELOMIN" && v >= 0 && v < sueloMax)  { sueloMin = v; Serial.println("OK SUELOMIN"); }
  else if (n == "SUELOMAX" && v > sueloMin && v <= 100) { sueloMax = v; Serial.println("OK SUELOMAX"); }
  else if (n == "RIEGO") {
    if (!aguaOk) Serial.println("Sin agua en el tanque");
    else Serial.println(iniciarPulso(true) ? "OK RIEGO" : "La bomba ya esta regando");
  }
  else if (n == "ESTADO") {
    Serial.print("TEMP="); Serial.print(tempMax); Serial.print(" SUELOMIN="); Serial.print(sueloMin);
    Serial.print(" SUELOMAX="); Serial.println(sueloMax);
  } else {
    Serial.println("Comando desconocido. Escribe AYUDA");
  }
}

// ---------------- Programa ----------------
void setup() {
  pinMode(PIN_LED_ROJO, OUTPUT);
  pinMode(PIN_LED_AZUL, OUTPUT);
  pinMode(PIN_BOMBA, OUTPUT);
  pinMode(PIN_VENTILADOR, OUTPUT);
  pinMode(PIN_ZUMBADOR, OUTPUT);
  pinMode(PIN_BOTON, INPUT_PULLUP);
  pinMode(PIN_TANQUE, INPUT_PULLUP);
  pinMode(PIN_HUM_AIRE, INPUT_PULLUP);
  Serial.begin(9600);
  lcd.begin(16, 2);
  lcd.setBacklight(1);
  lcd.print("Invernadero IoT");
  lcd.setCursor(0, 1);
  lcd.print("Tinkercad");
  Serial.println("Invernadero IoT (Tinkercad). Escribe AYUDA");
  relojBaseMs = millis();
}

void loop() {
  unsigned long ahora = millis();

  // Comandos
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { if (linea.length()) comando(linea); linea = ""; }
    else if (linea.length() < 40) linea += ch;
  }

  // Botón: pulsación corta = riego manual; si hay alarma, la silencia
  bool presionado = digitalRead(PIN_BOTON) == LOW;
  if (presionado && !botonAntes) botonDesde = ahora;
  if (!presionado && botonAntes && ahora - botonDesde > 30) {
    if (ultimaAlarma != 0 && !silenciado) { silenciado = true; Serial.println("Alarma silenciada"); }
    else if (!aguaOk) Serial.println("Sin agua en el tanque");
    else if (iniciarPulso(true)) Serial.println("Riego manual");
  }
  botonAntes = presionado;

  // Fin del pulso de riego
  if (bomba && ahora - inicioPulso >= PULSO_MS) detenerBomba();

  if (ahora - ultimoMuestreo >= MUESTREO_MS) {
    ultimoMuestreo = ahora;

    // Lecturas
    float temp = (analogRead(PIN_TMP36) * 5000.0 / 1023.0 - 500.0) / 10.0;   // TMP36: 10 mV/°C, 500 mV a 0 °C
    bool contacto = digitalRead(PIN_HUM_AIRE) == LOW;
    float humSuelo = constrain(analogRead(PIN_HUM_SUELO) * 100.0 / 876.0, 0, 100);  // el sensor de Tinkercad llega a ~876
    bool hayAgua = digitalRead(PIN_TANQUE) == LOW;
    aguaOk = hayAgua;

    // Reglas (las mismas del firmware real)
    if (!calor && temp > tempMax) calor = true;
    else if (calor && temp < tempMax - tempHist) calor = false;
    // Humedad del aire: el contacto debe repetirse 3 lecturas seguidas para cambiar
    if (contacto == aireAlto) cambiosAire = 0;
    else if (++cambiosAire >= MUESTRAS_ESTABLES) { aireAlto = contacto; cambiosAire = 0; }
    estadoSuelo = clasificar(estadoSuelo, humSuelo, sueloMin, sueloMax);
    bool critico = temp >= tempCritica;
    bool regar = hayAgua && estadoSuelo == BAJO;
    bool ventilar = calor || aireAlto;

    if (regar) iniciarPulso(false);
    else if (bomba && (!manual || !hayAgua)) detenerBomba();

    // Solo una carga a la vez (todo alimentado desde el Arduino): la bomba tiene prioridad
    bool ventOn = ventilar && !bomba;
    digitalWrite(PIN_BOMBA, bomba ? HIGH : LOW);
    digitalWrite(PIN_VENTILADOR, ventOn ? HIGH : LOW);

    // LEDs
    // LED rojo: suelo seco (parpadea si el tanque está vacío). LED azul: aire húmedo
    static bool parpadeo = false;
    parpadeo = !parpadeo;                             // cambia en cada muestra (1 s)
    bool rojo = !hayAgua ? parpadeo : estadoSuelo == BAJO;
    digitalWrite(PIN_LED_ROJO, rojo ? HIGH : LOW);
    digitalWrite(PIN_LED_AZUL, aireAlto ? HIGH : LOW);

    // Alarma
    String estado = !hayAgua ? "SIN AGUA" : critico ? "TEMP CRITICA" : calor ? "TEMP ALTA"
                  : estadoSuelo == BAJO ? "SUELO SECO" : estadoSuelo == ALTO ? "SUELO MOJADO"
                  : aireAlto ? "HUMEDAD ALTA" : "NORMAL";
    if (!hayAgua || critico) {
      if (!silenciado && (ultimaAlarma == 0 || ahora - ultimaAlarma > 15000UL)) { ultimaAlarma = ahora; pitar(3); }
    } else {
      ultimaAlarma = 0;
      silenciado = false;
    }

    // Monitor serie
    Serial.print("T="); Serial.print(temp, 1); Serial.print("C  HR="); Serial.print(aireAlto ? "ALTA" : "OK");
    Serial.print("  HS="); Serial.print(humSuelo, 0); Serial.print("%  Agua="); Serial.print(hayAgua ? "OK" : "NO");
    Serial.print("  | "); Serial.print(estado);
    Serial.print(" | V"); Serial.print(ventOn); Serial.print(" B"); Serial.println(bomba);

    // Pantalla: alterna dos páginas cada 3 s
    if ((ahora / 3000UL) % 2 != (unsigned long)pagina) { pagina = !pagina; lcd.clear(); }
    lcd.setCursor(0, 0);
    if (pagina == 0) {
      lcd.print("T:"); lcd.print(temp, 1); lcd.print("C  HR:"); lcd.print(aireAlto ? "ALTA" : "OK  ");
      lcd.setCursor(0, 1);
      lcd.print("S:"); lcd.print((int)humSuelo); lcd.print("% Agua:"); lcd.print(hayAgua ? "OK " : "NO ");
    } else {
      lcd.print(estado); lcd.print("                ");
      lcd.setCursor(0, 1);
      lcd.print("V:"); lcd.print(ventOn); lcd.print(" B:"); lcd.print(bomba);
      unsigned long s = segundosDelDia();
      lcd.print("    "); if (s / 3600 < 10) lcd.print('0'); lcd.print(s / 3600); lcd.print(':');
      if ((s / 60) % 60 < 10) lcd.print('0'); lcd.print((s / 60) % 60);
    }
  }
}
