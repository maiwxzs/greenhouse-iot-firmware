export default function Calibracion({ t, cfg, activo, enviar }) {
  const pasos = [
    { n: 1, cmd: "CAL SUELOSECO", texto: "Sonda de suelo en tierra seca", detalle: "Clava los dos electrodos en tierra seca y espera a que la lectura se estabilice.",
      lectura: t?.adc_suelo, guardado: cfg?.adc_suelo_seco },
    { n: 2, cmd: "CAL SUELOHUMEDO", texto: "Sonda de suelo en tierra regada", detalle: "Riega bien la misma tierra y espera un minuto.",
      lectura: t?.adc_suelo, guardado: cfg?.adc_suelo_hum },
    { n: 3, cmd: "CAL TANQUE", texto: "Sonda del tanque dentro del agua", detalle: "Con ambos cables sumergidos; el umbral queda entre esa lectura y la del aire (1023).",
      lectura: t?.adc_agua, guardado: cfg?.umbral_agua },
  ];
  return (
    <div className="rejilla-2">
      <section className="bloque">
        <h3>Calibración de las sondas</h3>
        <p className="nota">Cada botón guarda en el Arduino la lectura de ese momento. La lectura en vivo ayuda a saber cuándo se estabilizó.</p>
        <ol className="pasos">
          {pasos.map((p) => (
            <li key={p.n} className="paso">
              <span className="n">{p.n}</span>
              <div>
                <p><b>{p.texto}</b></p>
                <small>{p.detalle}</small>
                <p style={{ marginTop: 4 }}>
                  <small>Lectura actual </small><span className="lectura-cruda">{p.lectura ?? "—"}</span>
                  <small>, guardada </small><span className="lectura-cruda">{p.guardado ?? "—"}</span>
                </p>
              </div>
              <button className="boton sec chico" type="button" disabled={!activo} onClick={() => enviar(p.cmd)}>Guardar</button>
            </li>
          ))}
        </ol>
      </section>
      <section className="bloque">
        <h3>Cómo leen las sondas</h3>
        <p className="nota">
          Las dos sondas son un par de electrodos entre una entrada analógica y GND. El Arduino activa su resistencia interna de
          unos 35 kΩ solo durante la medición: con más agua entre los electrodos la lectura baja (0 a 1023). Fuera de la medición los
          electrodos quedan a 0 V, lo que reduce la corrosión.
        </p>
        <p className="nota">
          La humedad del suelo en porcentaje es una escala lineal entre las dos lecturas calibradas. Una lectura de 1015 o más indica
          que la sonda no toca tierra; en ese caso el riego automático se suspende.
        </p>
      </section>
    </div>
  );
}
