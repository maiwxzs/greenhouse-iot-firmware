#!/usr/bin/env python3
"""Genera los diagramas del proyecto en docs/diagramas/:

  <nombre>.svg     imagen vectorial
  <nombre>.png     imagen para documentos y presentaciones
  <nombre>.drawio  archivo de draw.io con figuras nativas editables (el grupo guarda
                   el código Mermaid, así que en draw.io también se edita como Mermaid)

Las definiciones están en el diccionario DIAGRAMAS de este archivo.
Requisitos: Node.js con @mermaid-js/mermaid-cli (mmdc), Python con playwright y Google Chrome.
Uso:  python3 tools/generar_diagramas.py [--chrome /ruta/a/chrome]
"""
import argparse
import base64
import html
import json
import re
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
DIR = RAIZ / "docs" / "diagramas"

PALETA = """
    classDef sensor fill:#E3F0FA,stroke:#2370AE,color:#16324A,stroke-width:1.5px
    classDef actuador fill:#FFF1DC,stroke:#B9790A,color:#4A3305,stroke-width:1.5px
    classDef control fill:#E3F2E8,stroke:#2E7A4C,color:#173B26,stroke-width:1.5px
    classDef interfaz fill:#F2E8F7,stroke:#7B3FA0,color:#3A1F4C,stroke-width:1.5px
    classDef dato fill:#EEF1F4,stroke:#546E7A,color:#263238,stroke-width:1.5px
    classDef app fill:#E0F2EF,stroke:#00796B,color:#0F3B36,stroke-width:1.5px
"""

DIAGRAMAS = {
    "arquitectura-sistema": """flowchart LR
    subgraph SENS["Sensores y entradas"]
        direction TB
        BTN["Pulsador<br/>riego manual y silencio"]
        DS["DS18B20<br/>temperatura del aire"]
        HR["Módulo HR202 con relé<br/>humedad del aire"]
        SU["Sonda de suelo<br/>dos electrodos"]
        TQ["Sonda del tanque<br/>dos electrodos"]
    end
    subgraph MCU["Arduino Uno R3, firmware 3.0"]
        direction TB
        CTRL["ControladorArduino<br/>muestra cada 2 s"]
        LOG["Logica.h<br/>reglas con histéresis"]
        EE[("EEPROM<br/>ajustes y calibración")]
    end
    subgraph ACT["Actuadores"]
        direction TB
        R1["Relé 1<br/>bomba sumergible"]
        R2["Relé 2<br/>ventilador 5 V"]
    end
    subgraph HMI["Interfaz local"]
        direction TB
        LCD["LCD 16x2 I2C"]
        LED["LED rojo y LED azul"]
        ZUM["Zumbador piezo<br/>activo 3–24 V"]
    end
    subgraph PC["Computador"]
        direction TB
        APP["Aplicación React<br/>Web Serial"]
        IDB[("IndexedDB<br/>historial y eventos")]
    end
    DS -->|"1-Wire, D2"| CTRL
    HR -->|"contacto seco, D3"| CTRL
    SU -->|"analógica, A1"| CTRL
    TQ -->|"analógica, A2"| CTRL
    CTRL <--> LOG
    CTRL <-->|"lee y guarda"| EE
    CTRL -->|"D7"| R1
    CTRL -->|"D8"| R2
    CTRL -->|"I2C, A4 y A5"| LCD
    CTRL -->|"D5 y D6"| LED
    CTRL -->|"D10"| ZUM
    BTN -->|"D4"| CTRL
    CTRL <-->|"USB serie 9600<br/>JSON y comandos"| APP
    APP <--> IDB
    class DS,HR,SU,TQ,BTN sensor
    class R1,R2 actuador
    class CTRL,LOG control
    class EE,IDB dato
    class LCD,LED,ZUM interfaz
    class APP app
""" + PALETA,

    "firmware-capas": """flowchart TB
    subgraph C0["Entrada: src/main.cpp"]
        MAIN["setup y loop<br/>crea y conecta los objetos"]
    end
    subgraph C1["Orquestación: GreenhouseCore.hpp"]
        direction LR
        INV["Invernadero"]
        CTL["ControladorArduino<br/>ciclo, ejecutarLogica,<br/>enviarTelemetria, comandos"]
    end
    subgraph C2["Abstracción del hardware: GreenhouseCore.hpp"]
        direction LR
        SEN["Sensores<br/>SensorTemperatura, SensorHumedad,<br/>SensorHumedadSuelo, SensorNivelAgua"]
        ACTU["Actuadores<br/>BombaAgua, Ventilador,<br/>IndicadorLED, Zumbador"]
        IFZ["Interfaz local<br/>PantallaLCD, BotonPulsador"]
        ALM["AlmacenAjustes"]
    end
    subgraph C3["Lógica pura: Logica.h, cubierta por 25 pruebas unitarias"]
        direction LR
        REG["ReglaControl"]
        CIC["CicloTrabajoBomba"]
        ENE["repartirEnergia"]
        REL["RelojSoftware"]
        PAR["parsearComando"]
        AJ["Ajustes y checksum"]
    end
    subgraph C4["Librerías"]
        direction LR
        OW["OneWire y DallasTemperature"]
        LQ["LiquidCrystal_I2C y Wire"]
        EEP["EEPROM"]
    end
    CFG["Config.h<br/>pines, partes instaladas,<br/>valores de fábrica"]
    MAIN --> INV
    INV --> CTL
    CTL --> SEN
    CTL --> ACTU
    CTL --> IFZ
    CTL --> ALM
    CTL --> REG
    CTL --> ENE
    CTL --> REL
    CTL --> PAR
    ACTU --> CIC
    ALM --> AJ
    REG --> AJ
    SEN --> OW
    IFZ --> LQ
    ALM --> EEP
    CFG -.->|"constantes"| CTL
    class MAIN,INV,CTL control
    class SEN sensor
    class ACTU actuador
    class IFZ interfaz
    class ALM,AJ,EEP,OW,LQ dato
    class REG,CIC,ENE,REL,PAR app
    class CFG dato
""" + PALETA,

    "ciclo-control": """---
config:
  layout: dagre
---
flowchart TD
    INI(["Inicio de una vuelta de loop"]) --> BTN["Atender el pulsador<br/>corto: riego manual, largo: silencio"]
    BTN --> SER["Atender comandos serie<br/>validar, aplicar y guardar en EEPROM"]
    SER --> ACT["Actualizar actuadores<br/>fin de pulso, parpadeos y pitidos"]
    ACT --> T{"¿Pasaron 2 s desde<br/>la última muestra?"}
    T -->|No| FIN(["Fin de la vuelta, loop vuelve a empezar"])
    T -->|Sí| LEE["Leer sensores<br/>DS18B20, contacto del HR202,<br/>sondas de suelo y tanque"]
    LEE --> EVA["ReglaControl evalúa<br/>con histéresis"]
    EVA --> AG{"¿Tanque vacío?"}
    AG -->|Sí| BLQ["Bomba bloqueada<br/>LED rojo parpadea y alarma"]
    AG -->|No| SS{"¿Suelo seco?"}
    SS -->|Sí| PUL["Pulso de riego de 5 s<br/>pausa de 1 min, tope 15 min/h"]
    SS -->|No| OFF["Bomba apagada"]
    BLQ --> V{"¿Calor, aire húmedo o<br/>DS18B20 sin respuesta?"}
    PUL --> V
    OFF --> V
    V -->|Sí| VEN["Pedir el ventilador"]
    V -->|No| NOV["Ventilador apagado"]
    VEN --> REP["repartirEnergia<br/>una carga a la vez:<br/>la bomba antes que el ventilador"]
    NOV --> REP
    REP --> SAL["LEDs, alarma, telemetría<br/>JSON y pantalla LCD"]
    SAL --> FIN
    class INI,FIN interfaz
    class BTN,SER,ACT,LEE,EVA,REP,SAL control
    class T,AG,SS,V dato
    class PUL,OFF,VEN,NOV actuador
    class BLQ interfaz
""" + PALETA,

    "estados-control": """stateDiagram-v2
    direction LR
    state "Temperatura del aire" as TEMP {
        [*] --> TNormal
        TNormal: Normal
        TVent: Ventilando
        TCrit: Crítica, ventila y suena la alarma
        TNormal --> TVent: T mayor que TEMP
        TVent --> TNormal: T menor que TEMP − TEMPHIST
        TVent --> TCrit: T mayor o igual que TEMPCRIT
        TCrit --> TVent: T menor que TEMPCRIT
    }
    state "Humedad del suelo" as SUELO {
        [*] --> SNormal
        SNormal: Normal, sin riego
        SSeco: Seco, riego por pulsos
        SEnch: Encharcado, sin riego
        SNormal --> SSeco: S menor que SUELOMIN
        SSeco --> SNormal: S mayor o igual que SUELOMIN + HIST
        SNormal --> SEnch: S mayor que SUELOMAX
        SEnch --> SNormal: S menor o igual que SUELOMAX − HIST
    }
    state "Humedad del aire" as AIRE {
        [*] --> ANormal
        ANormal: Normal
        AAlta: Alta, ventilando
        ANormal --> AAlta: contacto cerrado, 3 lecturas
        AAlta --> ANormal: contacto abierto, 3 lecturas
    }
""",

    "secuencia-app-arduino": """sequenceDiagram
    autonumber
    actor U as Usuario
    participant DB as IndexedDB
    participant APP as Aplicación React
    participant A as Arduino
    participant E as EEPROM
    U->>APP: Conectar Arduino y elegir el puerto
    APP->>A: Abre el puerto USB a 9600 baudios
    Note over A: El Arduino se reinicia al abrir el puerto
    A->>E: Lee los ajustes guardados
    A-->>APP: Línea cfg con la configuración
    A-->>APP: Línea tel con hora_sync = 0
    APP->>A: HORA 14:30:05
    A-->>APP: Línea ok, cmd HORA
    loop Cada 2 segundos
        A-->>APP: Línea tel
        Note over APP: Detecta eventos y acumula el minuto
        APP->>DB: Lecturas en lotes de 15 y resumen por minuto
    end
    U->>APP: Ajustes, ventilar desde 28 °C
    APP->>A: TEMP 28
    Note over A: Valida el conjunto de ajustes, 0 a 60 °C y TEMPCRIT ≥ TEMP
    A->>E: Guarda solo los bytes que cambiaron
    A-->>APP: Línea ok y nueva línea cfg
    APP->>DB: Evento del comando
""",

    "aplicacion-arquitectura": """flowchart LR
    ARD["Arduino Uno<br/>USB serie"]
    subgraph NAV["Navegador Chrome o Edge, instalable como aplicación"]
        direction LR
        subgraph HOOKS["Conexión"]
            direction TB
            CON["useConexion<br/>Web Serial"]
            SIM["Simulador<br/>modo demostración"]
        end
        subgraph LIB["Datos, src/lib"]
            direction TB
            PROT["protocolo.js<br/>interpreta cada línea"]
            REG["registro.js<br/>eventos, minutos, estadísticas"]
            ALM["almacen.js"]
        end
        subgraph IDB["IndexedDB, en el disco"]
            direction TB
            LEC[("lecturas<br/>2 días")]
            MIN[("minutos<br/>180 días")]
            EVT[("eventos<br/>180 días")]
        end
        subgraph UI["Componentes React"]
            direction TB
            APPC["App"]
            ESC["Escena animada"]
            INS["Instrumentos"]
            PES["Pestañas<br/>En vivo, Historial, Eventos,<br/>Ajustes, Calibración, Consola"]
        end
        SW["Service worker<br/>abre sin internet"]
    end
    ARD <-->|"líneas JSON y comandos"| CON
    SIM -.->|"mismo protocolo"| PROT
    CON --> PROT
    PROT --> APPC
    APPC --> REG
    REG --> ALM
    ALM --> LEC
    ALM --> MIN
    ALM --> EVT
    APPC --> ESC
    APPC --> INS
    APPC --> PES
    PES -->|"consulta el historial"| ALM
    SW -.-> APPC
    class ARD control
    class CON,SIM,SW interfaz
    class PROT,REG,ALM app
    class LEC,MIN,EVT dato
    class APPC,ESC,INS,PES actuador
""" + PALETA,

    "protocolo-mensajes": """classDiagram
    direction LR
    class Arduino {
        +enviarTelemetria()
        +enviarAjustes()
        +ejecutarComando(linea)
    }
    class Aplicacion {
        +interpretarLinea(linea)
        +enviar(comando)
    }
    class Telemetria {
        <<tipo tel, cada 2 s>>
        +t_ms : entero
        +hora : texto hh mm ss
        +hora_sync : 0 o 1
        +temp_c : número o null
        +aire_alta : 0 o 1
        +hum_suelo : número o null
        +adc_suelo : entero
        +agua : 0, 1 o null
        +adc_agua : entero
        +estado : Estado
        +aire : Nivel
        +suelo : Nivel
        +ventilador, bomba : 0 o 1
        +alarma : 0, 1 o 2
        +bomba_s_hora : entero
    }
    class Configuracion {
        <<tipo cfg>>
        +version : texto
        +temp_max, temp_hist, temp_crit : número
        +suelo_min, suelo_max, hist : número
        +adc_suelo_seco, adc_suelo_hum : entero
        +umbral_agua : entero
        +solo_arduino, sonda_suelo, sonda_agua, lcd : 0 o 1
    }
    class Respuesta {
        <<tipo ok o error>>
        +cmd : texto
        +msg : texto
    }
    class Comando {
        <<texto terminado en salto de línea>>
        +TEMP, TEMPCRIT, TEMPHIST valor
        +SUELOMIN, SUELOMAX, HIST valor
        +HORA hh mm ss
        +RIEGO, SILENCIO, ESTADO, FABRICA
        +CAL SUELOSECO, SUELOHUMEDO o TANQUE
        +UMBRALAGUA valor
    }
    class Estado {
        <<enumeración>>
        NORMAL
        HUMEDAD_ALTA
        SUELO_ENCHARCADO
        SUELO_SECO
        TEMPERATURA_ALTA
        TEMPERATURA_CRITICA
        SIN_AGUA
        SIN_DATOS
        FALLA_SENSOR_TEMP
    }
    class Nivel {
        <<enumeración>>
        BAJA
        NORMAL
        ALTA
        DESCONOCIDA
        NO_USADO
    }
    Arduino ..> Telemetria : emite
    Arduino ..> Configuracion : emite
    Arduino ..> Respuesta : responde
    Aplicacion ..> Comando : envía
    Arduino ..> Comando : ejecuta
    Telemetria --> Estado
    Telemetria --> Nivel
""",

    "uml-clases": """classDiagram
    direction TB
    class Invernadero {
        +idInvernadero : texto
        +nombre : texto
        +sistemaActivo : bool
        +asignarControlador(c)
        +iniciarSistema()
        +monitorear(ahora)
    }
    class ControladorArduino {
        +puertoSerie : unsigned long
        +frecuenciaMuestreo : unsigned long
        +estadoActual : EstadoSistema
        +inicializar()
        +ciclo(ahora)
        +leerSensores(ahora)
        +ejecutarLogica(ahora)
        +enviarTelemetria(ahora)
        +enviarAjustes()
    }
    class ReglaControl {
        +evaluarTemperatura(t)
        +evaluarHumedad(h)
        +evaluarHumedadSuelo(s, usada)
        +evaluarNivelAgua(hayAgua, usada)
        +requiereVentilacion() bool
        +requiereRiego() bool
        +hayAlarma() bool
        +obtenerEstado() EstadoSistema
    }
    class LecturaDato {
        +idLectura : uint16
        +timestamp : unsigned long
        +valor : float
        +unidad : texto
        +valida : bool
        +esValida() bool
        +formatearSalida(salida)
    }
    class Ajustes {
        +tempMax, tempHisteresis, tempCritica : float
        +humSueloMin, humSueloMax, humHisteresis : float
        +adcSueloSeco, adcSueloHumedo, adcUmbralAgua : int16
        +checksum : uint8
    }
    class AlmacenAjustes {
        +deFabrica()$ Ajustes
        +cargar(a)$ bool
        +guardar(a)$
    }
    class Sensor {
        <<abstract>>
        +idPin : uint8
        +nombre : texto
        +activo : bool
        +inicializar()*
        +obtenerLectura(ahora)*
        +ultimaLectura() LecturaDato
    }
    class SensorTemperatura {
        +temperatura : float
        +leerTemperatura(ahora)
        +sensoresDetectados() uint8
    }
    class SensorHumedad {
        +humedadAlta : bool
        +leerHumedad(ahora)
    }
    class SondaResistiva {
        <<abstract>>
        +valorAdc : int
        +medirAdc() int
    }
    class SensorHumedadSuelo {
        +humedad : float
    }
    class SensorNivelAgua {
        +hayAgua : bool
    }
    class Actuador {
        <<abstract>>
        +idPin : uint8
        +estado : bool
        +inicializar()*
        +encender()*
        +apagar()*
        +actualizar(ahora)
    }
    class IndicadorLED {
        +color : texto
        +parpadeo : bool
        +cambiarEstado()
        +parpadear(periodo, invertido)
    }
    class Zumbador {
        +pasivo : bool
        +pitar(veces, duracion)
    }
    class ActuadorRele {
        +activoEnBajo : bool
        +nombre : texto
    }
    class BombaAgua {
        +solicitarPulso(ahora, forzado) bool
        +segundosUsadosEnHora() unsigned long
    }
    class Ventilador
    class CicloTrabajoBomba {
        +solicitarPulso(ahora, forzado) bool
        +actualizar(ahora) bool
        +msUsadosEnHora() unsigned long
    }
    class RelojSoftware {
        +ajustar(h, m, s, ahora)
        +segundosDelDia(ahora) unsigned long
        +estaSincronizado() bool
    }
    class PantallaLCD {
        +inicializar() bool
        +mostrar(resumen, ahora)
    }
    class BotonPulsador {
        +actualizar(ahora) EventoBoton
    }
    Invernadero "1" --> "1" ControladorArduino : gestiona
    ControladorArduino "1" o-- "4" Sensor : lee de
    ControladorArduino "1" o-- "6" Actuador : controla
    ControladorArduino --> ReglaControl : evalúa con
    ControladorArduino *-- RelojSoftware
    ControladorArduino *-- PantallaLCD
    ControladorArduino o-- BotonPulsador
    ControladorArduino ..> AlmacenAjustes : usa
    AlmacenAjustes ..> Ajustes : guarda
    ReglaControl --> Ajustes : consulta
    ReglaControl ..> LecturaDato : usa
    Sensor ..> LecturaDato : produce
    Sensor <|-- SensorTemperatura
    Sensor <|-- SensorHumedad
    Sensor <|-- SondaResistiva
    SondaResistiva <|-- SensorHumedadSuelo
    SondaResistiva <|-- SensorNivelAgua
    Actuador <|-- IndicadorLED
    Actuador <|-- Zumbador
    Actuador <|-- ActuadorRele
    ActuadorRele <|-- BombaAgua
    ActuadorRele <|-- Ventilador
    BombaAgua *-- CicloTrabajoBomba
""",
}

CONFIG_MERMAID = {
    "theme": "base",
    "look": "neo",
    "layout": "elk",
    "themeVariables": {
        "primaryColor": "#E3F2E8", "primaryBorderColor": "#2E7A4C", "primaryTextColor": "#1E2D24",
        "lineColor": "#55665B", "secondaryColor": "#E3F0FA", "tertiaryColor": "#F6F9F7",
        "clusterBkg": "#F6F9F7", "clusterBorder": "#A9BDB2", "edgeLabelBackground": "#FFFFFF",
        "fontFamily": "Segoe UI, Roboto, Helvetica, Arial, sans-serif", "fontSize": "15px",
        "noteBkgColor": "#FFF1DC", "noteBorderColor": "#B9790A", "noteTextColor": "#4A3305",
        "actorBkg": "#E3F2E8", "actorBorder": "#2E7A4C", "actorTextColor": "#173B26",
        "signalColor": "#55665B", "signalTextColor": "#1E2D24", "sequenceNumberColor": "#FFFFFF",
        "labelBoxBkgColor": "#E3F0FA", "labelBoxBorderColor": "#2370AE", "loopTextColor": "#16324A",
        "classText": "#1E2D24",
    },
    "flowchart": {"htmlLabels": True, "curve": "basis", "nodeSpacing": 38, "rankSpacing": 52, "padding": 14},
    "sequence": {"mirrorActors": False, "showSequenceNumbers": True, "actorMargin": 110, "messageMargin": 34},
    "class": {"htmlLabels": True},
    "state": {"nodeSpacing": 40},
}
FUENTE = "fontFamily=Segoe UI;fontSize=14;fontColor=#1E2D24;"
RELLENO, BORDE = "#E8F3EC", "#2E7A4C"

# Medir cajas y líneas en el navegador (las coordenadas ya incluyen todas las transformaciones)
JS_MEDIR = r"""
() => {
  const svg = document.querySelector('svg');
  const o = svg.getBoundingClientRect();
  const caja = (el) => { const r = el.getBoundingClientRect(); return {x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height}; };
  const res = {ancho: o.width, alto: o.height, clusters: {}, nodos: {}, aristas: []};
  svg.querySelectorAll('g.cluster').forEach(g => {
    const r = g.querySelector(':scope > rect'); if (r) res.clusters[g.id] = caja(r);
  });
  svg.querySelectorAll('g.node').forEach(g => {
    const forma = g.querySelector(':scope > .label-container, :scope > rect, :scope > polygon, :scope > path, :scope > g.label-container, :scope > g.basic');
    res.nodos[g.id] = caja(forma || g);
  });
  svg.querySelectorAll('path[data-id]').forEach(p => {
    let pts = [];
    try { pts = JSON.parse(atob(p.getAttribute('data-points') || '')); } catch (e) {}
    const m = p.getScreenCTM(), mo = svg.getScreenCTM();
    const pt = svg.createSVGPoint();
    const abs = pts.map(q => { pt.x = q.x; pt.y = q.y; const s = pt.matrixTransform(m); return {x: s.x - o.left, y: s.y - o.top}; });
    res.aristas.push({id: p.getAttribute('data-id'), puntos: abs, clase: p.getAttribute('class') || ''});
  });
  return res;
}
"""


def renderizar(nombre: str, texto: str, chrome: str):
    with tempfile.TemporaryDirectory() as tmp:
        cfg = Path(tmp) / "c.json"; cfg.write_text(json.dumps(CONFIG_MERMAID))
        pup = Path(tmp) / "p.json"; pup.write_text(json.dumps({"executablePath": chrome, "args": ["--no-sandbox"]}))
        fuente = Path(tmp) / f"{nombre}.mmd"; fuente.write_text(texto, encoding="utf-8")
        for ext, extra in (("svg", []), ("png", ["-s", "2"])):
            subprocess.run(["mmdc", "-q", "-p", str(pup), "-c", str(cfg), "-b", "#FFFFFF", "-i", str(fuente),
                            "-o", str(DIR / f"{nombre}.{ext}"), *extra], check=True)


def medir(svg_path: Path, navegador):
    pagina = navegador.new_page()
    pagina.set_content(f"<html><body style='margin:0'>{svg_path.read_text(encoding='utf-8')}</body></html>")
    pagina.evaluate("() => { const s = document.querySelector('svg'); const vb = s.viewBox.baseVal;"
                    " s.removeAttribute('style'); s.setAttribute('width', vb.width); s.setAttribute('height', vb.height); }")
    datos = pagina.evaluate(JS_MEDIR)
    pagina.close()
    return datos


# ----------------------- Lectura de la definición Mermaid -----------------------
def estilos_classdef(texto):
    defs = {}
    for nombre, cuerpo in re.findall(r"^\s*classDef\s+(\w+)\s+(.+)$", texto, re.M):
        props = dict(p.split(":", 1) for p in cuerpo.split(",") if ":" in p)
        defs[nombre] = props
    asignados = {}
    for ids, nombre in re.findall(r"^\s*class\s+([\w,]+)\s+(\w+)\s*$", texto, re.M):
        for i in ids.split(","):
            asignados[i] = defs.get(nombre, {})
    return asignados


def limpiar(etiqueta):
    return etiqueta.replace("<br/>", "<br>").strip()


def nodos_flowchart(texto):
    nodos, clusters = {}, {}
    for cid, et in re.findall(r'^\s*subgraph\s+(\w+)\["([^"]*)"\]', texto, re.M):
        clusters[cid] = limpiar(et)
    patron = r'(\w+)\s*(\(\[|\[\(|\{|\[|\()"([^"]*)"(\]\)|\)\]|\}|\]|\))'
    for nid, abre, et, _ in re.findall(patron, texto):
        if nid in clusters or nid in ("subgraph",):
            continue
        forma = {"([": "estadio", "[(": "cilindro", "{": "rombo", "[": "rect", "(": "redondeado"}[abre]
        nodos.setdefault(nid, (forma, limpiar(et)))
    return nodos, clusters


def miembros_clases(texto):
    clases = {}
    for nombre, cuerpo in re.findall(r"^\s*class\s+(\w+)\s*\{(.*?)^\s*\}", texto, re.M | re.S):
        lineas = [l.strip() for l in cuerpo.strip().splitlines() if l.strip()]
        estereotipo = next((l for l in lineas if l.startswith("<<")), None)
        lineas = [l for l in lineas if not l.startswith("<<")]
        atributos = [l for l in lineas if "(" not in l]
        metodos = [l for l in lineas if "(" in l]
        clases[nombre] = (estereotipo, atributos, metodos)
    for nombre in re.findall(r"^\s*class\s+(\w+)\s*$", texto, re.M):
        clases.setdefault(nombre, (None, [], []))
    return clases


RELACIONES = {
    "<|--": "startArrow=block;startFill=0;startSize=12;endArrow=none;",
    "*--": "startArrow=diamondThin;startFill=1;startSize=16;endArrow=none;",
    "o--": "startArrow=diamondThin;startFill=0;startSize=16;endArrow=none;",
    "-->": "startArrow=none;endArrow=open;endSize=10;",
    "..>": "startArrow=none;endArrow=open;endSize=10;dashed=1;",
    "--": "startArrow=none;endArrow=none;",
    "..": "startArrow=none;endArrow=none;dashed=1;",
}


def relaciones_clases(texto):
    patron = r'^\s*(\w+)\s+(?:"([^"]*)"\s+)?(<\|--|\*--|o--|-->|\.\.>|--|\.\.)\s+(?:"([^"]*)"\s+)?(\w+)\s*(?::\s*(.*))?$'
    return re.findall(patron, texto, re.M)


# ----------------------------- draw.io -----------------------------
class Dibujo:
    def __init__(self, nombre, mermaid):
        self.celdas = []
        self.n = 1
        self.grupo = self.nuevo_id()
        self.mermaid = mermaid
        self.nombre = nombre

    def nuevo_id(self):
        self.n += 1
        return f"mmd-{self.n}"

    def vertice(self, mid, etiqueta, estilo, g, padre=None):
        cid = self.nuevo_id()
        self.celdas.append(
            f'<UserObject label="{html.escape(etiqueta, quote=True)}" mermaidId="{html.escape(mid)}" id="{cid}">'
            f'<mxCell parent="{padre or self.grupo}" style="{estilo}" vertex="1">'
            f'<mxGeometry x="{g["x"]:.1f}" y="{g["y"]:.1f}" width="{g["w"]:.1f}" height="{g["h"]:.1f}" as="geometry"/></mxCell></UserObject>')
        return cid

    def arista(self, mid, origen, destino, etiqueta, estilo, puntos):
        cid = self.nuevo_id()
        pts = "".join(f'<mxPoint x="{p["x"]:.1f}" y="{p["y"]:.1f}"/>' for p in puntos)
        geo = f'<mxGeometry relative="1" as="geometry">{"<Array as=" + chr(34) + "points" + chr(34) + ">" + pts + "</Array>" if pts else ""}</mxGeometry>'
        self.celdas.append(
            f'<UserObject label="{html.escape(etiqueta, quote=True)}" mermaidId="{html.escape(mid)}" id="{cid}">'
            f'<mxCell edge="1" parent="{self.grupo}" source="{origen}" target="{destino}" style="{estilo}">{geo}</mxCell></UserObject>')

    def imagen(self, svg_bytes, ancho, alto):
        datos = base64.b64encode(svg_bytes).decode()
        self.celdas.append(
            f'<mxCell id="{self.nuevo_id()}" parent="{self.grupo}" vertex="1" '
            f'style="shape=image;noLabel=1;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/svg+xml,{datos};">'
            f'<mxGeometry width="{ancho:.1f}" height="{alto:.1f}" as="geometry"/></mxCell>')

    def xml(self, ancho, alto):
        md = html.escape(json.dumps({"data": self.mermaid, "config": None}, ensure_ascii=False, indent=2), quote=True)
        md = md.replace("\n", "&#xa;")
        grupo = (f'<UserObject label="" mermaidData="{md}" id="{self.grupo}">'
                 f'<mxCell connectable="0" parent="1" vertex="1" style="group;transparentBounds=1;editIcon=1;lockedGroup=0;groupPadding=10;">'
                 f'<mxGeometry x="20" y="20" width="{ancho:.1f}" height="{alto:.1f}" as="geometry"/></mxCell></UserObject>')
        return ('<mxfile host="app.diagrams.net">\n'
                f'  <diagram name="{html.escape(self.nombre)}" id="{self.nombre}">\n'
                f'    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" '
                f'fold="1" page="1" pageScale="1" pageWidth="{max(827, int(ancho) + 60)}" pageHeight="{max(1169, int(alto) + 60)}" math="0" shadow="0">\n'
                '      <root>\n        <mxCell id="0" />\n        <mxCell id="1" parent="0" />\n        '
                + grupo + "\n        " + "\n        ".join(self.celdas) +
                '\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n')


def estilo_nodo(forma, props):
    relleno = props.get("fill", RELLENO); borde = props.get("stroke", BORDE)
    base = f"html=1;whiteSpace=wrap;strokeWidth=1.5;fillColor={relleno};strokeColor={borde};{FUENTE}"
    return {
        "rect": "rounded=0;" + base,
        "redondeado": "rounded=1;" + base,
        "estadio": "rounded=1;arcSize=50;" + base,
        "rombo": "rhombus;" + base,
        "cilindro": "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=8;" + base,
    }[forma]


def flowchart_a_drawio(mmd_texto, medidas, nombre):
    d = Dibujo(nombre, mmd_texto)
    nodos, clusters = nodos_flowchart(mmd_texto)
    estilos = estilos_classdef(mmd_texto)
    ids = {}
    for cid, et in clusters.items():
        g = next((v for k, v in medidas["clusters"].items() if k.endswith("-" + cid) or k == cid), None)
        if g:
            ids[cid] = d.vertice(f"n:{cid}", et, "html=1;whiteSpace=wrap;verticalAlign=top;fillColor=#F8FBF9;"
                                 f"strokeColor=#9DB5A8;strokeWidth=1.5;rounded=1;arcSize=4;fontStyle=1;{FUENTE}", g)
    for nid, (forma, et) in nodos.items():
        g = next((v for k, v in medidas["nodos"].items() if re.search(rf"flowchart-{nid}-\d+$", k)), None)
        if g:
            ids[nid] = d.vertice(f"n:{nid}", et, estilo_nodo(forma, estilos.get(nid, {})), g)
    etiquetas = {}
    for o, flecha, et, t in re.findall(r'(\w+)\s*(-->|<-->|-\.->|---)\s*(?:\|"?([^|"]*)"?\|\s*)?(\w+)', mmd_texto):
        etiquetas.setdefault((o, t), []).append((flecha, et))
    vistos = {}
    for a in medidas["aristas"]:
        m = re.match(r"L_(\w+?)_(\w+?)_(\d+)$", a["id"])
        if not m:
            continue
        o, t = m.group(1), m.group(2)
        if o not in ids or t not in ids:
            continue
        k = vistos.get((o, t), 0); vistos[(o, t)] = k + 1
        flecha, et = (etiquetas.get((o, t)) or [("-->", "")])[min(k, len(etiquetas.get((o, t), [None])) - 1)]
        estilo = f"curved=1;html=1;strokeColor=#4D5F54;strokeWidth=1.5;endArrow=block;endSize=7;{FUENTE}fontSize=12;labelBackgroundColor=#FFFFFF;"
        if flecha == "<-->":
            estilo += "startArrow=block;startSize=7;"
        if flecha == "-.->" or "dotted" in a["clase"] or "dashed" in a["clase"]:
            estilo += "dashed=1;"
        d.arista(f"e:{o}->{t}#{k}", ids[o], ids[t], limpiar(et or ""), estilo, a["puntos"][1:-1])
    return d.xml(medidas["ancho"], medidas["alto"])


def clases_a_drawio(mmd_texto, medidas, nombre):
    d = Dibujo(nombre, mmd_texto)
    ids = {}
    for nombre_clase, (estereo, atributos, metodos) in miembros_clases(mmd_texto).items():
        g = next((v for k, v in medidas["nodos"].items() if re.search(rf"classId-{nombre_clase}-\d+$", k)), None)
        if not g:
            continue
        titulo = (f"<i>«{html.escape(estereo.strip('<>'))}»</i><br>" if estereo else "") + f"<b>{nombre_clase}</b>"
        bloque = lambda filas: "<br>".join(html.escape(f) for f in filas) or "&nbsp;"
        etiqueta = (f'<p style="margin:0;margin-top:4px;text-align:center;">{titulo}</p><hr size="1">'
                    f'<p style="margin:0 6px;">{bloque(atributos)}</p><hr size="1">'
                    f'<p style="margin:0 6px;">{bloque(metodos)}</p>')
        estilo = (f"verticalAlign=top;align=left;overflow=fill;html=1;whiteSpace=wrap;rounded=0;"
                  f"fillColor={'#F3F7F5' if estereo else RELLENO};strokeColor={BORDE};strokeWidth=1.5;"
                  f"fontFamily=Segoe UI;fontSize=12;fontColor=#1E2D24;")
        ids[nombre_clase] = d.vertice(f"n:{nombre_clase}", etiqueta, estilo, g)
    rel = relaciones_clases(mmd_texto)
    puntos = {}
    for a in medidas["aristas"]:
        m = re.match(r"id_(\w+?)_(\w+?)_(\d+)$", a["id"])
        if m:
            puntos.setdefault((m.group(1), m.group(2)), a["puntos"])
    for i, (o, card_o, tipo, card_t, t, et) in enumerate(rel):
        if o not in ids or t not in ids:
            continue
        estilo = (f"curved=1;html=1;strokeColor=#4D5F54;strokeWidth=1.5;{RELACIONES[tipo]}"
                  f"fontFamily=Segoe UI;fontSize=11;fontColor=#1E2D24;labelBackgroundColor=#FFFFFF;")
        etiqueta = et.strip()
        if card_o or card_t:
            etiqueta = f"{card_o or ''} {etiqueta} {card_t or ''}".strip()
        d.arista(f"e:{o}->{t}#{i}", ids[o], ids[t], etiqueta, estilo, puntos.get((o, t), [])[1:-1])
    return d.xml(medidas["ancho"], medidas["alto"])


def imagen_a_drawio(mmd_texto, svg_path, medidas, nombre):
    d = Dibujo(nombre, mmd_texto)
    d.imagen(svg_path.read_bytes(), medidas["ancho"], medidas["alto"])
    return d.xml(medidas["ancho"], medidas["alto"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default="/usr/bin/google-chrome")
    args = ap.parse_args()
    with sync_playwright() as p:
        navegador = p.chromium.launch(executable_path=args.chrome, args=["--no-sandbox"])
        DIR.mkdir(parents=True, exist_ok=True)
        for viejo in DIR.glob("*"):
            if viejo.suffix in (".svg", ".png", ".drawio", ".mmd"):
                viejo.unlink()
        for nombre, texto in DIAGRAMAS.items():
            renderizar(nombre, texto, args.chrome)
            svg = DIR / f"{nombre}.svg"
            medidas = medir(svg, navegador)
            tipo = re.sub(r"^---\n.*?\n---\n", "", texto.lstrip(), flags=re.S).split(None, 1)[0]
            if tipo in ("flowchart", "graph"):
                xml = flowchart_a_drawio(texto, medidas, nombre)
            elif tipo == "classDiagram":
                xml = clases_a_drawio(texto, medidas, nombre)
            else:
                xml = imagen_a_drawio(texto, svg, medidas, nombre)
            (DIR / f"{nombre}.drawio").write_text(xml, encoding="utf-8")
            print(f"{nombre}: svg, png y drawio ({tipo})")
        navegador.close()


if __name__ == "__main__":
    main()
