// Smart Greenhouse IoT - Version para simular en Tinkercad Circuits
//
// Tinkercad no tiene el DS18B20, el modulo HR202 ni los modulos rele, asi que
// esta version usa piezas equivalentes (ver docs/tinkercad.md):
//
//    DS18B20      -> sensor de temperatura TMP36        (A3)
//    Modulo HR202 -> interruptor deslizante (contacto)  (D3)
//    Sonda suelo  -> "Soil Moisture Sensor"             (A1)
//    Sonda tanque -> interruptor deslizante             (A2)
//    Modulo rele  -> transistor NPN + rele + diodo      (D7, D8)
//    Bomba/vent.  -> motores DC
//    Zumbador     -> piezo                              (D10)
//    LCD I2C      -> "LCD 16 x 2 (I2C)", tipo PCF8574, direccion 0x20 (A4, A5)
//
// Se pega completo en el editor de codigo de Tinkercad (modo Texto)
// La logica es la misma del firmware real, simplificada en un solo archivo
// Los tiempos de la bomba son mas cortos para que se note en la simulacion
// Los niveles son int y no enum porque Tinkercad genera los prototipos de
// las funciones al inicio del archivo, antes de cualquier tipo propio

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// LCD 16x2 I2C de Tinkercad: direccion 0x20 (32 en decimal)
LiquidCrystal_I2C lcd(0x20, 16, 2);

// ---------------- Pines ----------------
const int PIN_BOTON      = 4;
const int PIN_LED_ROJO   = 5;
const int PIN_LED_AZUL   = 6;
const int PIN_BOMBA      = 7;
const int PIN_VENTILADOR = 8;
const int PIN_ZUMBADOR   = 10;
const int PIN_HUM_AIRE   = 3;    // interruptor: GND = contacto cerrado = aire humedo
const int PIN_HUM_SUELO  = A1;
const int PIN_TANQUE     = A2;   // interruptor: GND = hay agua
const int PIN_TMP36      = A3;

// ---------------- Ajustes ----------------
float tempMax = 30.0, tempHist = 2.0, tempCritica = 35.0;
float sueloMin = 30, sueloMax = 85, hist = 5;
const unsigned long PULSO_MS = 3000;        // en el real: 5 s
const unsigned long PAUSA_MS = 10000;       // en el real: 60 s
const unsigned long MUESTREO_MS = 250;      // lectura de sensores: 4 veces por segundo
const int MUESTRAS_ESTABLES = 12;           // 12 x 250 ms = 3 s para aceptar un cambio del HR202
const unsigned long REFRESCO_LCD_MS = 200;  // la pantalla se revisa 5 veces por segundo
// Tiempos de la pantalla: cada mensaje queda el tiempo suficiente para leerlo
const unsigned long SALUDO_MS = 3000;       // mensaje de inicio
const unsigned long PAGINA_MS = 4000;       // cada pagina (lecturas / estado)
const unsigned long AVISO_BOTON_MS = 3000;  // riego manual, ya esta regando...
const unsigned long AVISO_ALARMA_MS = 4000; // alarma callada, tanque sin agua
const unsigned long AVISO_AJUSTE_MS = 2500; // respuestas a comandos
const unsigned long AVISO_MIN_MS = 1500;    // un aviso nuevo espera a que el anterior se lea
const unsigned long REPORTE_MS = 5000;      // linea de estado en el monitor aunque nada cambie

// ---------------- Estado ----------------
const int BAJO = 0, NORMAL = 1, ALTO = 2;
int estadoSuelo = NORMAL;
bool aireAlto = false;
int cambiosAire = 0;
bool calor = false, critico = false, ventilar = false;
bool bomba = false, manual = false;
unsigned long inicioPulso = 0, finPulso = 0;
bool yaRego = false;
bool silenciado = false;
unsigned long ultimaAlarma = 0, ultimoMuestreo = 0;
unsigned long relojBaseSeg = 8UL * 3600UL, relojBaseMs = 0;

// Ultimas lecturas: la pantalla las usa entre un muestreo y otro
float temp = 0, humSuelo = 0;
bool hayAgua = true;
const char* estado = "NORMAL";

// Pulsador y comandos
bool botonAntes = false;
unsigned long ultimaPulsacion = 0, ultimoCaracter = 0;
volatile bool botonPulsado = false;
String linea = "";

// Pantalla y monitor
char aviso[17] = "";                  // aviso temporal (riego manual, alarma callada...)
unsigned long avisoDesde = 0, avisoDura = 0;
char pendiente[17] = "";              // aviso que llego mientras otro se estaba leyendo
unsigned long pendienteDura = 0;
int pagina = 0;                       // 0 = lecturas, 1 = estado
unsigned long paginaDesde = SALUDO_MS;  // la primera pagina empieza al terminar el saludo
const char* estadoMostrado = "NORMAL";  // al arrancar empieza por las lecturas
unsigned long ultimoRefresco = 0;
char lcdFila[2][17] = { "", "" };     // lo que ya esta escrito, para no reescribirlo
char ultimoReporte[80] = "";
unsigned long ultimoReporteMs = 0;

// El pulsador se captura por interrupcion de cambio de pin (D4 = PCINT20)
// Asi no se pierde un clic corto mientras el programa escribe en la pantalla
ISR(PCINT2_vect) {
  if (digitalRead(PIN_BOTON) == LOW) botonPulsado = true;
}

// ---------------- Utilidades ----------------
int clasificar(int actual, float v, float mn, float mx) {
  if (actual == BAJO && v < mn + hist) return BAJO;
  if (actual == ALTO && v > mx - hist) return ALTO;
  if (v < mn) return BAJO;
  if (v > mx) return ALTO;
  return NORMAL;
}

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

// Escribe el mensaje en el monitor y lo deja en la primera fila de la pantalla
// durante 'dura' ms. Si todavia se esta leyendo otro aviso (menos de 1,5 s),
// el nuevo espera su turno en vez de taparlo
void avisar(const char* monitor, const char* pantalla, unsigned long dura) {
  Serial.println(monitor);
  unsigned long ahora = millis();
  if (aviso[0] && ahora - avisoDesde < AVISO_MIN_MS) {
    strncpy(pendiente, pantalla, 16); pendiente[16] = '\0';
    pendienteDura = dura;
    return;
  }
  strncpy(aviso, pantalla, 16); aviso[16] = '\0';
  avisoDesde = ahora; avisoDura = dura;
  ultimoRefresco = 0;   // redibuja ya, sin esperar el siguiente refresco
}

// Temperatura con un decimal sin usar printf de float (el AVR no lo trae)
void textoTemp(char* b, int n) {
  int t = (int)(temp * 10 + (temp < 0 ? -0.5 : 0.5));
  snprintf(b, n, "%s%d.%d", t < 0 ? "-" : "", abs(t) / 10, abs(t) % 10);
}

// ---------------- Comandos por el Monitor serie ----------------
void comando(String c) {
  c.trim(); c.toUpperCase();
  int esp = c.indexOf(' ');
  String n = esp < 0 ? c : c.substring(0, esp);
  float v = esp < 0 ? NAN : c.substring(esp + 1).toFloat();
  if (n == "AYUDA") {
    Serial.println("Comandos: TEMP 30, SUELOMIN 30, SUELOMAX 85, RIEGO, ESTADO");
  } else if (n == "TEMP" && v > 0)     { tempMax = v;    avisar("OK TEMP", "Ajuste guardado", AVISO_AJUSTE_MS); }
  else if (n == "SUELOMIN" && v >= 0 && v < sueloMax)  { sueloMin = v; avisar("OK SUELOMIN", "Ajuste guardado", AVISO_AJUSTE_MS); }
  else if (n == "SUELOMAX" && v > sueloMin && v <= 100) { sueloMax = v; avisar("OK SUELOMAX", "Ajuste guardado", AVISO_AJUSTE_MS); }
  else if (n == "RIEGO") {
    if (!hayAgua) avisar("Sin agua en el tanque", "Tanque sin agua", AVISO_ALARMA_MS);
    else if (iniciarPulso(true)) avisar("OK RIEGO", "Riego remoto", AVISO_BOTON_MS);
    else avisar("La bomba ya esta regando", "Ya esta regando", AVISO_BOTON_MS);
  }
  else if (n == "ESTADO") {
    Serial.print("TEMP="); Serial.print(tempMax); Serial.print(" SUELOMIN="); Serial.print(sueloMin);
    Serial.print(" SUELOMAX="); Serial.println(sueloMax);
  } else {
    Serial.println("Comando desconocido. Escribe AYUDA");
  }
}

// ---------------- Pantalla ----------------
// Solo envia a la pantalla las filas que cambiaron: asi puede refrescarse
// rapido sin frenar el resto del programa
void escribirFila(int fila, const char* txt) {
  char b[17];
  snprintf(b, sizeof b, "%-16s", txt);
  if (strcmp(b, lcdFila[fila]) == 0) return;
  strcpy(lcdFila[fila], b);
  lcd.setCursor(0, fila);
  lcd.print(b);
}

void dibujarPantalla(unsigned long ahora) {
  char f0[17], f1[17], t[8];
  bool ventOn = ventilar && !bomba;
  unsigned long s = segundosDelDia();
  // El aviso termino (o ya se leyo y hay otro esperando): pasa el siguiente, si hay
  if (aviso[0] && (ahora - avisoDesde >= avisoDura ||
                   (pendiente[0] && ahora - avisoDesde >= AVISO_MIN_MS))) {
    strcpy(aviso, pendiente); pendiente[0] = '\0';
    avisoDesde = ahora; avisoDura = pendienteDura;
  }
  bool hayAviso = aviso[0] != '\0';
  // Si el estado cambia (p. ej. SUELO SECO -> NORMAL) se muestra de inmediato
  if (strcmp(estado, estadoMostrado) != 0) { estadoMostrado = estado; pagina = 1; paginaDesde = ahora; }
  // Mientras hay un aviso, el reloj de paginas se detiene: la pagina que sigue
  // al aviso tambien se ve sus 4 s completos
  if (hayAviso) paginaDesde = ahora;
  else if (ahora - paginaDesde >= PAGINA_MS) { pagina = !pagina; paginaDesde = ahora; }
  if (!hayAviso && pagina == 0) {
    // Pagina 1: lecturas
    textoTemp(t, sizeof t);
    snprintf(f0, sizeof f0, "T:%sC  HR:%s", t, aireAlto ? "ALTA" : "OK");
    snprintf(f1, sizeof f1, "S:%d%% Agua:%s", (int)humSuelo, hayAgua ? "OK" : "NO");
  } else {
    // Pagina 2 (o aviso): estado y salidas
    snprintf(f0, sizeof f0, "%s", hayAviso ? aviso : estado);
    snprintf(f1, sizeof f1, "V:%d B:%d    %02lu:%02lu", ventOn ? 1 : 0, bomba ? 1 : 0,
             s / 3600UL, (s / 60UL) % 60UL);
  }
  escribirFila(0, f0);
  escribirFila(1, f1);
}

// Monitor serie: la linea de estado sale cuando algo cambia (o cada 5 s),
// asi los avisos no se pierden entre lineas repetidas
void reportar(unsigned long ahora) {
  char t[8], r[80];
  textoTemp(t, sizeof t);
  snprintf(r, sizeof r, "T=%sC  HR=%s  HS=%d%%  Agua=%s  | %s | V%d B%d", t,
           aireAlto ? "ALTA" : "OK", (int)humSuelo, hayAgua ? "OK" : "NO", estado,
           (ventilar && !bomba) ? 1 : 0, bomba ? 1 : 0);
  if (strcmp(r, ultimoReporte) != 0 || ahora - ultimoReporteMs >= REPORTE_MS) {
    strcpy(ultimoReporte, r);
    ultimoReporteMs = ahora;
    Serial.println(r);
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
  PCICR |= _BV(PCIE2);      // activa las interrupciones de cambio de pin de D0-D7
  PCMSK2 |= _BV(PCINT20);   // ...pero solo para D4 (pulsador)
  pinMode(PIN_TANQUE, INPUT_PULLUP);
  pinMode(PIN_HUM_AIRE, INPUT_PULLUP);
  Serial.begin(9600);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
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
    ultimoCaracter = ahora;
    if (ch == '\n' || ch == '\r') { if (linea.length()) comando(linea); linea = ""; }
    else if (linea.length() < 40) linea += ch;
  }
  // El Monitor serie de Tinkercad envia el texto sin Enter: el comando se
  // procesa cuando pasan 100 ms sin letras nuevas
  if (linea.length() && ahora - ultimoCaracter > 100) { comando(linea); linea = ""; }

  // Pulsador: cada pulsacion = riego manual; si hay alarma, la silencia
  // Se atiende al presionar; 300 ms de bloqueo eliminan los rebotes
  bool presionado = digitalRead(PIN_BOTON) == LOW;
  if (presionado && !botonAntes) botonPulsado = true;
  botonAntes = presionado;
  if (botonPulsado) {
    botonPulsado = false;
    if (ahora - ultimaPulsacion > 300) {
      ultimaPulsacion = ahora;
      if (ultimaAlarma != 0 && !silenciado) { silenciado = true; avisar("Alarma silenciada", "Alarma callada", AVISO_ALARMA_MS); }
      else if (!hayAgua) avisar("Sin agua en el tanque", "Tanque sin agua", AVISO_ALARMA_MS);
      else if (iniciarPulso(true)) avisar("Riego manual", "Riego manual", AVISO_BOTON_MS);
      else avisar("La bomba ya esta regando", "Ya esta regando", AVISO_BOTON_MS);
    }
  }

  // Fin del pulso de riego
  if (bomba && ahora - inicioPulso >= PULSO_MS) detenerBomba();

  // Sensores y reglas
  if (ahora - ultimoMuestreo >= MUESTREO_MS) {
    ultimoMuestreo = ahora;

    // Lecturas (TMP36: 10 mV/C con 500 mV a 0 C; el sensor de suelo llega a ~876)
    temp = (analogRead(PIN_TMP36) * 5000.0 / 1023.0 - 500.0) / 10.0;
    bool contacto = digitalRead(PIN_HUM_AIRE) == LOW;
    humSuelo = constrain(analogRead(PIN_HUM_SUELO) * 100.0 / 876.0, 0, 100);
    hayAgua = digitalRead(PIN_TANQUE) == LOW;

    // Reglas: las mismas del firmware real
    if (!calor && temp > tempMax) calor = true;
    else if (calor && temp < tempMax - tempHist) calor = false;
    if (contacto == aireAlto) cambiosAire = 0;
    else if (++cambiosAire >= MUESTRAS_ESTABLES) { aireAlto = contacto; cambiosAire = 0; }
    estadoSuelo = clasificar(estadoSuelo, humSuelo, sueloMin, sueloMax);
    critico = temp >= tempCritica;
    ventilar = calor || aireAlto;
    bool regar = hayAgua && estadoSuelo == BAJO;

    if (regar) iniciarPulso(false);
    else if (bomba && (!manual || !hayAgua)) detenerBomba();

    // Estado y alarma
    estado = "NORMAL";
    if (!hayAgua) estado = "SIN AGUA";
    else if (critico) estado = "TEMP CRITICA";
    else if (calor) estado = "TEMP ALTA";
    else if (estadoSuelo == BAJO) estado = "SUELO SECO";
    else if (estadoSuelo == ALTO) estado = "SUELO MOJADO";
    else if (aireAlto) estado = "HUMEDAD ALTA";
    if (!hayAgua || critico) {
      if (!silenciado && (ultimaAlarma == 0 || ahora - ultimaAlarma > 15000UL)) { ultimaAlarma = ahora; pitar(3); }
    } else {
      ultimaAlarma = 0;
      silenciado = false;
    }
  }

  // Salidas: se actualizan en cada vuelta, asi la bomba arranca apenas se pulsa el boton
  // Solo una carga a la vez (todo alimentado desde el Arduino): la bomba tiene prioridad
  bool ventOn = ventilar && !bomba;
  digitalWrite(PIN_BOMBA, bomba ? HIGH : LOW);
  digitalWrite(PIN_VENTILADOR, ventOn ? HIGH : LOW);
  // LED rojo: suelo seco (parpadea cada medio segundo si el tanque esta vacio). LED azul: aire humedo
  bool rojo = !hayAgua ? (ahora / 500UL) % 2 == 0 : estadoSuelo == BAJO;
  digitalWrite(PIN_LED_ROJO, rojo ? HIGH : LOW);
  digitalWrite(PIN_LED_AZUL, aireAlto ? HIGH : LOW);

  // Pantalla y monitor, 5 veces por segundo (el saludo se ve los primeros 3 s)
  if (ahora >= SALUDO_MS && ahora - ultimoRefresco >= REFRESCO_LCD_MS) {
    ultimoRefresco = ahora;
    dibujarPantalla(ahora);
    reportar(ahora);
  }
}
