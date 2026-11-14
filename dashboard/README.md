# Dashboard web

Un solo archivo, `index.html`, sin instalar nada y sin internet. Se conecta al Arduino por el cable USB con la función Web Serial del navegador.

- **Abrir:** doble clic en `index.html`, con **Google Chrome o Microsoft Edge** en computador.
- **Conectar:** **Conectar Arduino** y elegir el puerto (suele llamarse «USB-SERIAL CH340»).
- **Sin Arduino:** **Probar sin Arduino** simula el invernadero, útil para practicar la presentación.

Qué incluye:
- Estado del invernadero en palabras y un dibujo animado: ventilador, aspersor, luz y tanque.
- Lecturas con su rango ideal.
- Gráficas de 10 minutos, 1 hora o toda la sesión.
- Riego manual, silencio de alarma y modo de la luz.
- Ajustes, calibración y consola de comandos.
- Descarga de datos en CSV.

Uso detallado: [docs/manual-usuario.md](../docs/manual-usuario.md#dashboard-web). Formato de los datos: [docs/protocolo-serie.md](../docs/protocolo-serie.md).
