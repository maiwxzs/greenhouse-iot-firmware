// Fichas de las piezas (ver docs/maqueta.md y hardware/circuits/conexiones.md)
const si = (v) => v === 1 || v === true;

function razonVentilador(t, cfg) {
  if (!t) return "Sin datos";
  if (si(t.ventilador)) {
    const motivos = [];
    if (t.temp_c > (cfg?.temp_max ?? 30) - (cfg?.temp_hist ?? 2) && t.estado?.startsWith("TEMPERATURA")) motivos.push("calor");
    if (si(t.aire_alta)) motivos.push("aire húmedo");
    if (t.estado === "FALLA_SENSOR_TEMP") motivos.push("falla del sensor, por seguridad");
    return `Encendido${motivos.length ? " por " + motivos.join(" y ") : ""}`;
  }
  const quiere = t.estado?.startsWith("TEMPERATURA") || si(t.aire_alta);
  return quiere && si(t.bomba) ? "En pausa mientras riega la bomba" : "Apagado";
}

export const PIEZAS = {
  ventilador: {
    nombre: "Ventilador",
    modelo: "40 × 40 × 10 mm, 5 V, en la pared izquierda",
    conexion: "Relé 2, pin D8",
    valor: (t, cfg) => razonVentilador(t, cfg),
    texto: "Extrae el aire caliente o húmedo. El aire nuevo entra por la rejilla del fondo y cruza la planta.",
    ancla: [5, 150, 171],
  },
  bomba: {
    nombre: "Bomba de riego",
    modelo: "Sumergible de 3–5 V, 100 L/h nominales",
    conexion: "Relé 1, pin D7",
    valor: (t) => (!t ? "Sin datos" : si(t.bomba) ? "Regando" : `En reposo · ${t.bomba_s_hora ?? 0} s de 900 en esta hora`),
    texto: "Riega en pulsos de 5 s con 1 min de pausa para que el agua alcance la sonda antes de volver a medir.",
    accion: "riego",
    ancla: [358, 255, 30],
  },
  tanque: {
    nombre: "Tanque de agua",
    modelo: "Recipiente de 1 L (120 × 85 × 100 mm) con sonda de nivel",
    conexion: "Sonda en A2 y GND",
    valor: (t) => (!t ? "Sin datos" : si(t.agua) ? "Con agua" : "Vacío: riego bloqueado"),
    texto: "Las puntas de la sonda están a 35–40 mm del fondo. Por debajo de ese nivel la bomba no arranca, para no trabajar en seco.",
    accion: "rellenar",
    ancla: [390, 255, 90],
  },
  suelo: {
    nombre: "Maceta y sonda de suelo",
    modelo: "Dos clavos de 65 mm, clavados 55 mm en la tierra",
    conexion: "Sonda en A1 y GND",
    valor: (t, cfg) => (!t ? "Sin datos" : `${Math.round(t.hum_suelo)} % · riega bajo ${cfg?.suelo_min ?? 30} %, pausa sobre ${cfg?.suelo_max ?? 85} %`),
    texto: "Mide cuánto conduce la tierra entre los dos clavos. La calibración convierte esa lectura en porcentaje.",
    ancla: [105, 155, 100],
  },
  temperatura: {
    nombre: "Sonda de temperatura",
    modelo: "DS18B20 sumergible, punta de acero a 120 mm de la base",
    conexion: "Bus 1-Wire en D2, pull-up de 4.7 kΩ",
    valor: (t, cfg) => (!t ? "Sin datos" : `${t.temp_c?.toFixed(1)} °C · ventila sobre ${cfg?.temp_max ?? 30} °C, alarma en ${cfg?.temp_crit ?? 35} °C`),
    texto: "Cuelga a la altura de las hojas y lejos de las paredes, para medir el aire que respira la planta.",
    ancla: [215, 155, 128],
  },
  aire: {
    nombre: "Módulo de humedad del aire",
    modelo: "HR202 con relé, en la pared derecha",
    conexion: "Contacto NO en D3, COM a GND",
    valor: (t) => (!t ? "Sin datos" : si(t.aire_alta) ? "Aire húmedo: contacto cerrado" : "Normal: contacto abierto"),
    texto: "El módulo compara la humedad con el umbral de su potenciómetro y cierra su relé. El Arduino exige 3 lecturas iguales antes de aceptar el cambio.",
    ancla: [300, 145, 125],
  },
  caja: {
    nombre: "Caja de la electrónica",
    modelo: "MDF de 3 mm, 150 × 200 × 75 mm",
    conexion: "Arduino Uno, protoboard y dos relés",
    valor: (t) => (!t ? "Sin datos" : `Relé 1 ${si(t.bomba) ? "activo" : "en reposo"} · Relé 2 ${si(t.ventilador) ? "activo" : "en reposo"}`),
    texto: "Con la ficha abierta, la tapa queda levantada y las paredes translúcidas: se ven el Arduino con su LED TX, la protoboard y los dos relés con su LED.",
    ancla: [322, 8, 81],
    lado: "izquierda",
  },
  pantalla: {
    nombre: "Pantalla LCD 16×2",
    modelo: "Con módulo I2C PCF8574, dirección 0x27 o 0x3F",
    conexion: "SDA en A4, SCL en A5",
    valor: () => "Alterna dos páginas cada 4 s",
    texto: "Muestra lo mismo que la réplica del panel lateral: lecturas en una página, estado y hora en la otra.",
    ancla: [368, 5, 55],
  },
  leds: {
    nombre: "LEDs y pulsador",
    modelo: "LED rojo (D5), LED azul (D6) y pulsador (D4)",
    conexion: "LEDs con 220 Ω; pulsador a GND",
    valor: (t) => (!t ? "Sin datos"
      : [si(t.agua) ? (t.suelo === "BAJA" ? "Rojo encendido: suelo seco" : "Rojo apagado") : "Rojo intermitente: sin agua",
         si(t.aire_alta) ? "azul encendido: aire húmedo" : "azul apagado"].join(" · ")),
    texto: "El pulsador riega a mano. Si la alarma está sonando, la silencia 10 minutos.",
    ancla: [429, 5, 50],
  },
  zumbador: {
    nombre: "Zumbador de alarma",
    modelo: "Piezoeléctrico activo de 3–24 V, sobre la tapa",
    conexion: "Pin D10",
    valor: (t) => (!t ? "Sin datos" : t.alarma === 1 ? "Sonando" : t.alarma === 2 ? "Silenciado" : "En silencio"),
    texto: "Suena con el tanque vacío, la temperatura crítica o una falla del sensor de temperatura.",
    accion: "silencio",
    ancla: [436, 45, 96],
  },
  usb: {
    nombre: "Cable USB",
    modelo: "Alimentación y datos, 9600 baudios",
    conexion: "Del Arduino a este computador",
    valor: (t, cfg, modo) => (modo === "usb" ? "Conectado: una lectura cada 2 s" : modo === "demo" ? "Demostración: Arduino simulado" : "Desconectado"),
    texto: "Cada punto que viaja por el cable es una lectura del Arduino. Los que van hacia la caja son comandos de la aplicación.",
    ancla: [520, 225, 4],
  },
};
