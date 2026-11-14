// =====================================================================
//  Pruebas unitarias de la lógica del invernadero (include/Logica.h)
//  Se ejecutan en el computador, sin Arduino:   pio test -e native
// =====================================================================

#include <unity.h>
#include "Logica.h"

static Ajustes cfg;

static Ajustes ajustesDePrueba() {
    Ajustes a;
    memset(&a, 0, sizeof(a));
    a.tempMax = 30; a.tempHisteresis = 2; a.tempCritica = 35;
    a.humSueloMin = 30; a.humSueloMax = 85; a.humHisteresis = 5;
    a.adcSueloSeco = 1000; a.adcSueloHumedo = 250;
    a.adcUmbralAgua = 700;
    sellarAjustes(a);
    return a;
}

static LecturaDato L(float v, bool ok = true) { return LecturaDato(1, 0, v, "", ok); }

void setUp(void)    { cfg = ajustesDePrueba(); }
void tearDown(void) {}

// --------------------------- Conversión ADC ---------------------------

void test_adc_a_porcentaje_extremos_y_recorte(void) {
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f,   adcAPorcentaje(900, 900, 350));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 100.0f, adcAPorcentaje(350, 900, 350));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 50.0f,  adcAPorcentaje(625, 900, 350));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f,   adcAPorcentaje(1023, 900, 350));  // recorta abajo
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 100.0f, adcAPorcentaje(0, 900, 350));     // recorta arriba
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 50.0f,  adcAPorcentaje(625, 350, 900));   // orden inverso
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f,   adcAPorcentaje(500, 500, 500));   // sin división por cero
}

// ------------------------------ Ajustes -------------------------------

void test_ajustes_validos_y_checksum(void) {
    TEST_ASSERT_TRUE(ajustesValidos(cfg));
    Ajustes a = cfg;
    a.tempMax = 31;                       // cambio sin volver a sellar
    TEST_ASSERT_FALSE(ajustesValidos(a));
    sellarAjustes(a);
    TEST_ASSERT_TRUE(ajustesValidos(a));
}

void test_ajustes_rechaza_valores_absurdos(void) {
    Ajustes a = cfg; a.humSueloMin = 120; sellarAjustes(a);
    TEST_ASSERT_FALSE(ajustesValidos(a));
    a = cfg; a.humSueloMax = 20; sellarAjustes(a);              // máximo menor que mínimo
    TEST_ASSERT_FALSE(ajustesValidos(a));
    a = cfg; a.tempCritica = 20; sellarAjustes(a);              // crítica menor que máxima
    TEST_ASSERT_FALSE(ajustesValidos(a));
    a = cfg; a.adcSueloHumedo = a.adcSueloSeco; sellarAjustes(a); // calibración imposible
    TEST_ASSERT_FALSE(ajustesValidos(a));
    a = cfg; a.adcUmbralAgua = 1023; sellarAjustes(a);            // umbral del tanque imposible
    TEST_ASSERT_FALSE(ajustesValidos(a));
}

void test_ajustes_eeprom_vacia_no_es_valida(void) {
    Ajustes a;
    memset(&a, 0xFF, sizeof(a));
    TEST_ASSERT_FALSE(ajustesValidos(a));
}

// ----------------------------- Histéresis -----------------------------

void test_histeresis_humedad(void) {
    EstadoNivel e = NIVEL_DESCONOCIDO;
    e = clasificarConHisteresis(e, 35, 40, 80, 5); TEST_ASSERT_EQUAL(NIVEL_BAJO, e);
    e = clasificarConHisteresis(e, 42, 40, 80, 5); TEST_ASSERT_EQUAL(NIVEL_BAJO, e);   // aún no sale
    e = clasificarConHisteresis(e, 45, 40, 80, 5); TEST_ASSERT_EQUAL(NIVEL_NORMAL, e);
    e = clasificarConHisteresis(e, 81, 40, 80, 5); TEST_ASSERT_EQUAL(NIVEL_ALTO, e);
    e = clasificarConHisteresis(e, 77, 40, 80, 5); TEST_ASSERT_EQUAL(NIVEL_ALTO, e);
    e = clasificarConHisteresis(e, 75, 40, 80, 5); TEST_ASSERT_EQUAL(NIVEL_NORMAL, e);
}

void test_histeresis_temperatura(void) {
    ReglaControl r(cfg);
    r.evaluarHumedad(L(0));
    r.evaluarTemperatura(L(31)); TEST_ASSERT_TRUE(r.requiereVentilacion());
    r.evaluarTemperatura(L(29)); TEST_ASSERT_TRUE(r.requiereVentilacion());   // histéresis
    r.evaluarTemperatura(L(27.9f)); TEST_ASSERT_FALSE(r.requiereVentilacion());
}

// ---------------------------- ReglaControl ----------------------------

void test_falla_temperatura_ventila_y_alarma(void) {
    ReglaControl r(cfg);
    r.evaluarHumedad(L(0));
    r.evaluarTemperatura(L(-127, false));
    TEST_ASSERT_TRUE(r.requiereVentilacion());
    TEST_ASSERT_TRUE(r.hayFallaSensor());
    TEST_ASSERT_TRUE(r.hayAlarma());
    TEST_ASSERT_EQUAL(ESTADO_FALLA_SENSOR_TEMPERATURA, r.obtenerEstado());
}

void test_temperatura_critica(void) {
    ReglaControl r(cfg);
    r.evaluarHumedad(L(0));
    r.evaluarTemperatura(L(36));
    TEST_ASSERT_TRUE(r.hayAlarma());
    TEST_ASSERT_EQUAL(ESTADO_TEMPERATURA_CRITICA, r.obtenerEstado());
}

void test_riego_por_suelo_seco(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    r.evaluarHumedad(L(0));
    r.evaluarHumedadSuelo(L(20), true);
    r.evaluarNivelAgua(true, true);
    TEST_ASSERT_TRUE(r.requiereRiego());
    TEST_ASSERT_EQUAL(ESTADO_SUELO_SECO, r.obtenerEstado());
}

void test_no_riega_con_suelo_normal_o_encharcado(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    r.evaluarHumedad(L(0));
    r.evaluarNivelAgua(true, true);
    r.evaluarHumedadSuelo(L(50), true);
    TEST_ASSERT_FALSE(r.requiereRiego());
    r.evaluarHumedadSuelo(L(95), true);
    TEST_ASSERT_FALSE(r.requiereRiego());
    TEST_ASSERT_EQUAL(ESTADO_SUELO_ENCHARCADO, r.obtenerEstado());
}

void test_sonda_suelo_invalida_no_riega(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    r.evaluarHumedad(L(0));
    r.evaluarHumedadSuelo(L(0, false), true);
    r.evaluarNivelAgua(true, true);
    TEST_ASSERT_EQUAL(NIVEL_DESCONOCIDO, r.obtenerEstadoSuelo());
    TEST_ASSERT_FALSE(r.requiereRiego());
}

void test_sin_agua_bloquea_riego(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    r.evaluarHumedad(L(0));
    r.evaluarHumedadSuelo(L(10), true);
    r.evaluarNivelAgua(false, true);
    TEST_ASSERT_FALSE(r.requiereRiego());
    TEST_ASSERT_TRUE(r.riegoBloqueadoPorTanque());
    TEST_ASSERT_TRUE(r.hayAlarma());
    TEST_ASSERT_EQUAL(ESTADO_SIN_AGUA, r.obtenerEstado());
}

void test_sonda_de_agua_no_usada_no_bloquea(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    r.evaluarHumedad(L(0));
    r.evaluarHumedadSuelo(L(10), true);
    r.evaluarNivelAgua(false, false);
    TEST_ASSERT_TRUE(r.requiereRiego());
}

void test_humedad_alta_ventila(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    r.evaluarHumedad(L(1));
    TEST_ASSERT_TRUE(r.requiereVentilacion());
    TEST_ASSERT_EQUAL(NIVEL_ALTO, r.obtenerEstadoAire());
    TEST_ASSERT_EQUAL(ESTADO_HUMEDAD_ALTA, r.obtenerEstado());
    r.evaluarHumedad(L(0));
    TEST_ASSERT_FALSE(r.requiereVentilacion());
}

void test_sin_lectura_de_aire_es_sin_datos(void) {
    ReglaControl r(cfg);
    r.evaluarTemperatura(L(24));
    TEST_ASSERT_EQUAL(ESTADO_SIN_DATOS, r.obtenerEstado());
}

void test_cambio_de_ajustes_se_aplica_en_vivo(void) {
    ReglaControl r(cfg);
    r.evaluarHumedad(L(0));
    r.evaluarTemperatura(L(29));
    TEST_ASSERT_FALSE(r.requiereVentilacion());
    cfg.tempMax = 28;                 // la regla guarda una referencia a los ajustes
    r.evaluarTemperatura(L(29));
    TEST_ASSERT_TRUE(r.requiereVentilacion());
}

// ------------------------- CicloTrabajoBomba --------------------------

void test_bomba_pulso_y_pausa(void) {
    CicloTrabajoBomba b(5000, 60000, 900000, 3600000);
    TEST_ASSERT_TRUE(b.solicitarPulso(1000));
    TEST_ASSERT_FALSE(b.solicitarPulso(2000));          // ya está encendida
    TEST_ASSERT_FALSE(b.actualizar(5999));
    TEST_ASSERT_TRUE(b.actualizar(6000));               // termina a los 5 s
    TEST_ASSERT_FALSE(b.solicitarPulso(30000));         // falta pausa
    TEST_ASSERT_TRUE(b.solicitarPulso(30000, true));    // manual ignora la pausa
    b.actualizar(35000);
    TEST_ASSERT_TRUE(b.solicitarPulso(95000));          // pasada la pausa
}

void test_bomba_cupo_por_hora(void) {
    CicloTrabajoBomba b(5000, 0, 15000, 3600000);       // cupo de 15 s por hora
    unsigned long t = 1;
    int pulsos = 0;
    for (int i = 0; i < 10; i++) {
        if (b.solicitarPulso(t)) pulsos++;
        t += 5000;
        b.actualizar(t);
    }
    TEST_ASSERT_EQUAL(3, pulsos);
    TEST_ASSERT_EQUAL_UINT32(15000, b.msUsadosEnHora());
    TEST_ASSERT_TRUE(b.solicitarPulso(3600001UL + 10));  // nueva hora
}

void test_bomba_desborde_millis(void) {
    CicloTrabajoBomba b(5000, 60000, 900000, 3600000);
    const unsigned long casi = 0xFFFFFFFFUL - 2000UL;
    TEST_ASSERT_TRUE(b.solicitarPulso(casi));
    TEST_ASSERT_TRUE(b.actualizar(casi + 5000UL));       // cruza el desborde
}

// ------------------------------ Energía -------------------------------

void test_reparto_energia_solo_arduino(void) {
    CargasPermitidas c = repartirEnergia(true, true, true);
    TEST_ASSERT_TRUE(c.bomba); TEST_ASSERT_FALSE(c.ventilador);   // la bomba tiene prioridad
    c = repartirEnergia(false, true, true);
    TEST_ASSERT_TRUE(c.ventilador); TEST_ASSERT_FALSE(c.bomba);
    c = repartirEnergia(false, false, true);
    TEST_ASSERT_FALSE(c.bomba || c.ventilador);
    c = repartirEnergia(true, true, false);               // con fuente externa: las dos a la vez
    TEST_ASSERT_TRUE(c.bomba && c.ventilador);
}

// ------------------------------- Reloj --------------------------------

void test_reloj_avanza_y_se_sincroniza(void) {
    RelojSoftware r;
    r.ajustar(8, 0, 0, 0, false);                          // hora supuesta al arrancar
    TEST_ASSERT_FALSE(r.estaSincronizado());
    r.ajustar(17, 59, 50, 0);                              // comando HORA
    TEST_ASSERT_TRUE(r.estaSincronizado());
    TEST_ASSERT_EQUAL(17, r.hora(0));
    TEST_ASSERT_EQUAL(59, r.minuto(0));
    TEST_ASSERT_EQUAL(18, r.hora(10000));
    TEST_ASSERT_EQUAL(0, r.segundo(10000));
}

void test_reloj_pasa_la_medianoche(void) {
    RelojSoftware r;
    r.ajustar(23, 59, 59, 1000);
    TEST_ASSERT_EQUAL(0, r.hora(3000));
    TEST_ASSERT_EQUAL(0, r.minuto(3000));
    TEST_ASSERT_EQUAL(1, r.segundo(3000));
}

// ------------------------------ Comandos ------------------------------

void test_parsear_comando_numero(void) {
    char linea[] = "temp 28.5";
    Comando c;
    TEST_ASSERT_TRUE(parsearComando(linea, c));
    TEST_ASSERT_EQUAL_STRING("TEMP", c.nombre);
    TEST_ASSERT_EQUAL(1, c.cantidadNumeros);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 28.5f, c.numeros[0]);
}

void test_parsear_comando_hora(void) {
    char linea[] = "HORA 14:30:05\r";
    Comando c;
    TEST_ASSERT_TRUE(parsearComando(linea, c));
    TEST_ASSERT_EQUAL_STRING("HORA", c.nombre);
    TEST_ASSERT_EQUAL(3, c.cantidadNumeros);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 14, c.numeros[0]);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 30, c.numeros[1]);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 5,  c.numeros[2]);
}

void test_parsear_comando_texto_y_vacio(void) {
    char linea[] = "  cal   sueloseco ";
    Comando c;
    TEST_ASSERT_TRUE(parsearComando(linea, c));
    TEST_ASSERT_EQUAL_STRING("CAL", c.nombre);
    TEST_ASSERT_EQUAL_STRING("SUELOSECO", c.texto);
    TEST_ASSERT_EQUAL(0, c.cantidadNumeros);
    char vacia[] = "   ";
    TEST_ASSERT_FALSE(parsearComando(vacia, c));
    char texto[] = "SUELOMIN abc";
    TEST_ASSERT_TRUE(parsearComando(texto, c));
    TEST_ASSERT_EQUAL(0, c.cantidadNumeros);              // "abc" no es número
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_adc_a_porcentaje_extremos_y_recorte);
    RUN_TEST(test_ajustes_validos_y_checksum);
    RUN_TEST(test_ajustes_rechaza_valores_absurdos);
    RUN_TEST(test_ajustes_eeprom_vacia_no_es_valida);
    RUN_TEST(test_histeresis_humedad);
    RUN_TEST(test_histeresis_temperatura);
    RUN_TEST(test_falla_temperatura_ventila_y_alarma);
    RUN_TEST(test_temperatura_critica);
    RUN_TEST(test_riego_por_suelo_seco);
    RUN_TEST(test_no_riega_con_suelo_normal_o_encharcado);
    RUN_TEST(test_sonda_suelo_invalida_no_riega);
    RUN_TEST(test_sin_agua_bloquea_riego);
    RUN_TEST(test_sonda_de_agua_no_usada_no_bloquea);
    RUN_TEST(test_humedad_alta_ventila);
    RUN_TEST(test_sin_lectura_de_aire_es_sin_datos);
    RUN_TEST(test_cambio_de_ajustes_se_aplica_en_vivo);
    RUN_TEST(test_bomba_pulso_y_pausa);
    RUN_TEST(test_bomba_cupo_por_hora);
    RUN_TEST(test_bomba_desborde_millis);
    RUN_TEST(test_reparto_energia_solo_arduino);
    RUN_TEST(test_reloj_avanza_y_se_sincroniza);
    RUN_TEST(test_reloj_pasa_la_medianoche);
    RUN_TEST(test_parsear_comando_numero);
    RUN_TEST(test_parsear_comando_hora);
    RUN_TEST(test_parsear_comando_texto_y_vacio);
    return UNITY_END();
}
