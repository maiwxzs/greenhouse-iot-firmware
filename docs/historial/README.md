# Historial: primera versión del diseño

Estos archivos documentan la propuesta inicial del proyecto. Se conservan como registro de cómo evolucionó el diseño.

| Archivo | Contenido |
|---|---|
| `technical-system-specification.pdf` | Definición del problema y propuesta de solución |
| `uml-to-oop-mapping-analysis.pdf` | Justificación de las relaciones UML y su paso a código |
| `uml-inicial.jpg` | Diagrama de clases inicial |
| `*.drawio` | Diagramas de arquitectura iniciales |

## Qué cambió

| Diseño inicial | Diseño actual | Motivo |
|---|---|---|
| DHT11 (temperatura y humedad) | DS18B20 (temperatura) + HR202 (humedad del aire) | Se pidieron sensores separados |
| YL-69 / FC-28 (suelo) | Sonda casera de dos clavos | Mide el suelo sin comprar otro sensor |
| Servomotor SG90 para una escotilla | Ventilador de 5 V + aspersor con bomba | Hardware comprado |
| LEDs verde, amarillo y rojo | LED rojo (humedad baja) y azul (humedad alta), LCD y zumbador | Requisito de indicar humedad alta y baja |
| Arduino o ESP32 con WiFi y backend Spring Boot | Arduino Uno con dashboard web por USB | El ESP32 no llega a tiempo; el dashboard cumple la función de visualización |

La equivalencia entre las clases del UML inicial y el código actual está en el [README principal](../../README.md#del-uml-al-código).
