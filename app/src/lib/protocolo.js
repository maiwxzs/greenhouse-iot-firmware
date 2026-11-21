// Protocolo serie 3.x: JSON por línea o texto con '#' (docs/protocolo-serie.md)

export function interpretarLinea(linea) {
  const texto = linea.trim();
  if (!texto) return null;
  if (texto.startsWith("{")) {
    try {
      const msg = JSON.parse(texto);
      if (msg && typeof msg.tipo === "string") return msg;
    } catch {
      /* JSON incompleto */
    }
  }
  return { tipo: "texto", texto };
}

// textos por estado
export const ESTADOS = {
  NORMAL: {
    titulo: "Todo en orden",
    detalle: "Temperatura, suelo y tanque dentro de rango. El sistema sigue vigilando.",
    tono: "ok",
  },
  HUMEDAD_ALTA: {
    titulo: "Aire muy húmedo",
    detalle: "El módulo de humedad superó su umbral. El ventilador renueva el aire hasta que baje.",
    tono: "agua",
  },
  SUELO_ENCHARCADO: {
    titulo: "Suelo encharcado",
    detalle: "La tierra tiene más agua de la necesaria. El riego queda en pausa.",
    tono: "agua",
  },
  SUELO_SECO: {
    titulo: "Suelo seco: regando",
    detalle: "La bomba riega en pulsos de 5 s con 1 min de pausa hasta recuperar la humedad.",
    tono: "agua",
  },
  TEMPERATURA_ALTA: {
    titulo: "Calor: ventilando",
    detalle: "El ventilador funciona hasta que la temperatura baje 2 °C del límite.",
    tono: "sol",
  },
  TEMPERATURA_CRITICA: {
    titulo: "Temperatura crítica",
    detalle: "Supera el límite de alarma. Ventilador encendido; conviene dar sombra al invernadero.",
    tono: "alarma",
  },
  SIN_AGUA: {
    titulo: "Tanque vacío",
    detalle: "La bomba queda bloqueada para no trabajar en seco. Rellena el tanque.",
    tono: "alarma",
  },
  SIN_DATOS: {
    titulo: "Esperando lecturas",
    detalle: "El Arduino está arrancando.",
    tono: "neutro",
  },
  FALLA_SENSOR_TEMP: {
    titulo: "Sensor de temperatura sin respuesta",
    detalle: "Revisa el DS18B20 (pin D2) y su resistencia de 4.7 kΩ. El ventilador queda encendido por seguridad.",
    tono: "alarma",
  },
};

export function textoEstado(estado) {
  return ESTADOS[estado] || { titulo: estado || "—", detalle: "", tono: "neutro" };
}

export function textoConfirmacion(cmd) {
  return (
    {
      RIEGO: "Riego iniciado",
      SILENCIO: "Alarma silenciada por 10 minutos",
      HORA: "Reloj del invernadero sincronizado",
      CAL: "Calibración guardada",
      FABRICA: "Valores de fábrica restaurados",
    }[cmd] || "Ajuste guardado en el Arduino"
  );
}

// ayuda de comandos (no se guarda en el Arduino)
export const COMANDOS = [
  ["ESTADO", "Envía la configuración actual"],
  ["TEMP 30", "Temperatura para ventilar (°C)"],
  ["TEMPCRIT 35", "Temperatura de alarma (°C)"],
  ["TEMPHIST 2", "Histéresis de temperatura (°C)"],
  ["SUELOMIN 30", "Suelo seco por debajo de (%)"],
  ["SUELOMAX 85", "Suelo encharcado por encima de (%)"],
  ["HIST 5", "Histéresis del suelo (%)"],
  ["HORA 14:30", "Pone en hora el reloj del invernadero"],
  ["RIEGO", "Un pulso de riego manual"],
  ["SILENCIO", "Silencia la alarma 10 minutos"],
  ["CAL SUELOSECO", "Calibra la sonda de suelo en tierra seca"],
  ["CAL SUELOHUMEDO", "Calibra la sonda de suelo en tierra regada"],
  ["CAL TANQUE", "Calibra la sonda del tanque (cables en el agua)"],
  ["UMBRALAGUA 700", "Umbral de la sonda del tanque (ADC)"],
  ["FABRICA", "Vuelve a los valores de fábrica"],
];

export const dos = (n) => String(n).padStart(2, "0");

export function comandoHoraActual(fecha = new Date()) {
  return `HORA ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
}

// caudal medio de la bomba (80-120 L/h)
export const CAUDAL_L_POR_S = 100 / 3600;
