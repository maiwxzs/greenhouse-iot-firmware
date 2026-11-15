// Escena interactiva: la maqueta del invernadero dibujada en proyección oblicua, con las mismas
// medidas de docs/maqueta.md. Cada animación responde a un dato de la telemetría y cada pieza se puede tocar.
import { memo, useEffect, useMemo, useRef } from "react";
import { P, pts, ruta, prisma, circulo, envolvente, unir, caraFrente, caraLado, caraArriba } from "./proyeccion.js";
import { Z0, ALERO, CUMBRERA, BX0, BX1, BY0, BY1, BZ1, TX0, TX1, TY0, TY1, MACETA, TRAMOS_MANGUERA, USB, HOJAS } from "./geometria.js";
import { Motor } from "./motor.js";
import { PuntosLcd, textoLcd } from "./Lcd.jsx";
import { PIEZAS } from "./piezas.js";

export const VB = { x: -50, y: -428, w: 700, h: 452 };


const BALSA = ["#E2C48E", "#EED8AE", "#C7A56C"];
const MDF = ["#D8BE8F", "#E7D3AC", "#BC9F6E"];
const MDF_BASE = ["#C8A97E", "#D6BB93", "#A98B60"];

// Planos de dibujo: en estos grupos se dibuja con (x, -z) o (y, -z) en mm
const planoFrente = (y) => caraFrente(0, y, 0);
const planoLado = (x) => caraLado(x, 0, 0);


function Prisma({ b, c, className, opacidad }) {
  const f = prisma(...b);
  return (
    <g className={className} opacity={opacidad}>
      <polygon points={f.lado} fill={c[2]} />
      <polygon points={f.arriba} fill={c[1]} />
      <polygon points={f.frente} fill={c[0]} />
    </g>
  );
}

// Viga inclinada vista de frente (cabios del techo)
function Viga({ a, b, ancho = 7 }) {
  const [x1, y1] = P(...a), [x2, y2] = P(...b);
  return (
    <g className="viga">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#B8955E" strokeWidth={ancho + 1.6} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BALSA[0]} strokeWidth={ancho} />
    </g>
  );
}

// Fondo de la escena: superficie lisa con una luz suave bajo la maqueta, sin tramas
const Fondo = memo(function Fondo() {
  const [cx, cy] = P(235, 155, 0);
  return (
    <g className="fondo-escena" aria-hidden="true">
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} className="fondo-base" />
      <ellipse cx={cx} cy={cy - 120} rx="420" ry="260" fill="url(#luz-mesa)" />
    </g>
  );
});

// Gotas de rocío en el acrílico del frente (posiciones fijas, aparecen con el aire húmedo)
const ROCIO = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return { x: 20 + (a - Math.floor(a)) * 270, z: Z0 + 14 + (b - Math.floor(b)) * 190, r: 0.9 + ((i * 7) % 5) * 0.35, d: (i % 9) * 0.35 };
});

// Albahaca: el motor mueve cada hoja (resortes) y cambia su color con la humedad del suelo
const Planta = memo(function Planta({ r }) {
  return (
    <g transform={planoFrente(150)} className="planta">
      <g ref={r("planta")}>
        <path d={`M105 ${-(Z0 + 90)} C103 ${-(Z0 + 120)} 107 ${-(Z0 + 150)} 105 ${-(Z0 + 176)}`} stroke="#2F6B45" strokeWidth="3.4" fill="none" />
        <path d={`M104 ${-(Z0 + 112)} C96 ${-(Z0 + 130)} 92 ${-(Z0 + 140)} 90 ${-(Z0 + 150)} M106 ${-(Z0 + 118)} C114 ${-(Z0 + 134)} 118 ${-(Z0 + 142)} 121 ${-(Z0 + 152)}`} stroke="#2F6B45" strokeWidth="2" fill="none" />
        {HOJAS.map((h, i) => {
          const L = h.l, A = L * 0.42;
          return (
            <g key={i} ref={r("hojas", i)} transform={`translate(${h.x} ${-(Z0 + h.z)}) rotate(${-h.lado * h.sube})`} className="hoja">
              <path ref={r("hojasForma", i)} d={`M0 0 C${h.lado * L * 0.25} ${-A} ${h.lado * L * 0.8} ${-A * 0.9} ${h.lado * L} 0
                        C${h.lado * L * 0.8} ${A * 0.7} ${h.lado * L * 0.25} ${A * 0.8} 0 0Z`} fill={i % 2 ? "#3E9A5C" : "#2C7446"} />
              <path d={`M0 0 Q${h.lado * L * 0.5} -1.5 ${h.lado * L * 0.94} 0`} stroke="#1F5534" strokeWidth=".8" fill="none" opacity=".5" />
            </g>
          );
        })}
      </g>
    </g>
  );
});

const Maceta = memo(function Maceta({ r }) {
  const cuerpo = useMemo(() => unir(envolvente([...circulo(105, 155, Z0, 40), ...circulo(105, 155, Z0 + 87, 53)])), []);
  const borde = useMemo(() => unir(envolvente([...circulo(105, 155, Z0 + 87, 57), ...circulo(105, 155, Z0 + 95, 57)])), []);
  const boca = useMemo(() => unir(circulo(105, 155, Z0 + 95, 57)), []);
  const sup = useMemo(() => unir(circulo(105, 155, MACETA.zTierra, MACETA.radioTierra)), []);
  return (
    <g>
      <polygon points={cuerpo} fill="url(#barro)" />
      <polygon points={borde} fill="#C0825A" />
      <polygon points={boca} fill="#CC8E66" />
      <polygon points={sup} ref={r("tierra")} fill="#6E5034" />
      <polygon points={sup} ref={r("brilloTierra")} fill="url(#brillo-humedo)" opacity="0" />
      <g transform={caraArriba(0, 0, MACETA.zTierra + 0.3)} ref={r("ondasTierra")} className="ondas-tierra" />
    </g>
  );
});

function SondaSuelo() {
  return (
    <g>
      {[149, 161].map((y) => (
        <g key={y}>
          <line x1={P(138, y, Z0 + 91)[0]} y1={P(138, y, Z0 + 91)[1]} x2={P(138, y, Z0 + 101)[0]} y2={P(138, y, Z0 + 101)[1]} stroke="#A9B2B7" strokeWidth="2.2" />
          <circle cx={P(138, y, Z0 + 101)[0]} cy={P(138, y, Z0 + 101)[1]} r="2" fill="#C5CCD1" />
        </g>
      ))}
    </g>
  );
}

function Ventilador({ r }) {
  // En la pared izquierda (x = 5), centrado en y = 150 y a 165 mm de altura
  const cy = -(Z0 + 165);
  return (
    <g transform={planoLado(6)}>
      <rect x="130" y={cy - 20} width="40" height="40" rx="3" fill="#222624" />
      <circle cx="150" cy={cy} r="18" fill="#141716" />
      <circle cx="150" cy={cy} r="16.5" ref={r("desenfoque")} className="desenfoque" opacity="0" />
      <g ref={r("aspas")}>
        {[0, 51, 103, 154, 206, 257, 309].map((a) => (
          <path key={a} d={`M150 ${cy} q5 -4 4 -16 q-6 1 -9 7z`} fill="#3A4142" transform={`rotate(${a} 150 ${cy})`} />
        ))}
        <circle cx="150" cy={cy} r="6.5" fill="#2B6CC4" />
      </g>
      {[[133, cy - 17], [167, cy - 17], [133, cy + 17], [167, cy + 17]].map(([x, y]) => <circle key={x + "" + y} cx={x} cy={y} r="1.3" fill="#8D9799" />)}
    </g>
  );
}

function ModuloHR202({ alta }) {
  const z1 = -(Z0 + 132);
  return (
    <g transform={planoLado(301)}>
      <rect x="120" y={z1} width="50" height="27" rx="1.5" fill="#1E5FA0" />
      <rect x="124" y={z1 + 5} width="15" height="17" rx="1" fill="#F1ECDD" />
      {[0, 1, 2, 3].map((i) => <line key={i} x1="126" x2="137" y1={z1 + 8 + i * 3.6} y2={z1 + 8 + i * 3.6} stroke="#C9B98F" strokeWidth=".8" />)}
      <rect x="143" y={z1 + 4} width="19" height="15" rx="1" fill="#1F62C4" />
      <circle cx="165" cy={z1 + 6} r="1.6" fill="#E8473F" className="led-mod" />
      <circle cx="165" cy={z1 + 12} r="1.6" fill={alta ? "#6CF29A" : "#2E5A3C"} className={alta ? "led-mod encendido" : "led-mod"} />
      <circle cx="152" cy={z1 + 23} r="2.4" fill="#2B6CC4" stroke="#DDE" strokeWidth=".5" />
    </g>
  );
}

function Rejilla() {
  return (
    <g transform={planoFrente(305)}>
      <rect x="110" y={-(Z0 + 55)} width="80" height="30" fill="url(#malla)" stroke="#5A6B62" strokeWidth="1.2" />
    </g>
  );
}

function Rocio({ visible }) {
  return (
    <g transform={planoFrente(3)} className="rocio" data-visible={+visible}>
      {ROCIO.map((g, i) => <circle key={i} cx={g.x} cy={-g.z} r={g.r} style={{ transitionDelay: `${g.d}s` }} />)}
    </g>
  );
}

// Invernadero: estructura de balso, acrílico y todo lo que hay adentro
// Tramo de manguera: tubo translúcido, agua que la llena y corriente que avanza
function Manguera({ i, r }) {
  const d = ruta(TRAMOS_MANGUERA[i]);
  return (
    <>
      <path d={d} className="manguera" />
      <path d={d} className="agua-llena" ref={r("mangueraLlena", i)} strokeDasharray="0 1000" />
      <path d={d} className="agua-flujo" ref={r("mangueraFlujo", i)} opacity="0" />
    </>
  );
}

function Invernadero({ t, r, capas }) {
  const silueta = useMemo(() => unir(envolvente([
    P(5, 5, Z0), P(305, 5, Z0), P(305, 5, ALERO), P(155, 5, CUMBRERA), P(5, 5, ALERO),
    P(5, 305, Z0), P(305, 305, Z0), P(305, 305, ALERO), P(155, 305, CUMBRERA), P(5, 305, ALERO),
  ])), []);
  const poste = (x, y) => <Prisma key={`p${x}-${y}`} b={[x, y, Z0, x + 10, y + 10, ALERO]} c={BALSA} className="estructura" />;
  return (
    <g>
      {/* Fondo: pared, rejilla y estructura trasera */}
      <polygon points={pts([5, 305, Z0], [305, 305, Z0], [305, 305, ALERO], [155, 305, CUMBRERA], [5, 305, ALERO])} className="acrilico fondo" />
      <Rejilla />
      {poste(5, 295)}{poste(295, 295)}
      <Prisma b={[5, 295, Z0, 305, 305, Z0 + 10]} c={BALSA} className="estructura" />
      <Prisma b={[5, 295, ALERO - 10, 305, 305, ALERO]} c={BALSA} className="estructura" />
      <Viga a={[10, 300, ALERO]} b={[155, 300, CUMBRERA]} /><Viga a={[300, 300, ALERO]} b={[155, 300, CUMBRERA]} />
      {/* Pared izquierda con el ventilador */}
      <polygon points={pts([3, 5, Z0], [3, 305, Z0], [3, 305, ALERO], [3, 5, ALERO])} className="acrilico lado" />
      <Prisma b={[5, 15, Z0, 15, 295, Z0 + 10]} c={BALSA} className="estructura" />
      {poste(5, 145)}
      <Prisma b={[5, 15, ALERO - 10, 15, 295, ALERO]} c={BALSA} className="estructura" />
      <g {...capas("ventilador")}><Ventilador r={r} /></g>
      {/* Interior */}
      <g {...capas("suelo")}><Maceta r={r} /><SondaSuelo /><Planta r={r} /></g>
      <path d={ruta([[138, 155, Z0 + 92], [150, 120, Z0 + 1], [300, 47, Z0 + 1]])} className="cable" stroke="#3FA45B" />
      <path d={ruta([[5, 150, Z0 + 145], [9, 150, Z0 + 2], [10, 22, Z0 + 2], [300, 22, Z0 + 2], [305, 44, Z0 + 15]])} className="cable" stroke="#ECECE4" />
      <g {...capas("temperatura")}>
        <path d={ruta([[215, 155, Z0 + 268], [215, 155, Z0 + 150]])} className="cable" stroke="#1B1D1C" strokeWidth="1.6" />
        <polygon points={unir(envolvente([...circulo(215, 155, Z0 + 120, 3.2, 16), ...circulo(215, 155, Z0 + 150, 3.2, 16)]))} fill="url(#acero)" />
      </g>
      <g {...capas("aire")}><ModuloHR202 alta={t?.aire_alta === 1} /></g>
      <path d={ruta([[300, 160, Z0 + 105], [300, 160, Z0 + 3], [300, 50, Z0 + 3], [305, 47, Z0 + 14]])} className="cable" stroke="#E9C93E" />
      {/* Manguera interior y boquilla */}
      <g {...capas("bomba")}>
        <Manguera i={2} r={r} />
        <polygon points={unir(envolvente([...circulo(105, 155, Z0 + 194, 4, 12), ...circulo(105, 155, Z0 + 206, 4, 12)]))} fill="#1B1D1C" />
      </g>
      <g className="gotas" ref={r("gotas")} />
      <g className="salpicas" ref={r("salpicas")} />
      <g className="aire-flujo" ref={r("aire")} />
      {/* Calor: el aire del invernadero se tiñe y suben ondas desde el piso */}
      <polygon points={silueta} className="calor" ref={r("velo")} opacity="0" />
      <g className="ondas-calor" ref={r("ondasCalor")} />
      <g className="niebla" ref={r("niebla")} />
      <Rocio visible={t?.aire_alta === 1} />
      {/* Pared derecha, cumbrera y techo */}
      <polygon points={pts([307, 5, Z0], [307, 305, Z0], [307, 305, ALERO], [307, 5, ALERO])} className="acrilico lado" />
      {poste(295, 145)}
      <Prisma b={[295, 15, Z0, 305, 295, Z0 + 10]} c={BALSA} className="estructura" />
      <Prisma b={[295, 15, ALERO - 10, 305, 295, ALERO]} c={BALSA} className="estructura" />
      <Prisma b={[150, 5, CUMBRERA - 10, 160, 305, CUMBRERA]} c={BALSA} className="estructura" />
      <Viga a={[10, 155, ALERO]} b={[155, 155, CUMBRERA]} /><Viga a={[300, 155, ALERO]} b={[155, 155, CUMBRERA]} />
      <polygon points={pts([-1, -1, ALERO - 2], [155, -1, CUMBRERA + 2], [155, 311, CUMBRERA + 2], [-1, 311, ALERO - 2])} className="acrilico techo" />
      <polygon points={pts([311, -1, ALERO - 2], [155, -1, CUMBRERA + 2], [155, 311, CUMBRERA + 2], [311, 311, ALERO - 2])} className="acrilico techo" />
      {[40, 270].map((y) => <Prisma key={y} b={[150, y, CUMBRERA + 1, 160, y + 14, CUMBRERA + 5]} c={["#9AA3A8", "#C5CCD1", "#7F888D"]} />)}
      {/* Frente */}
      {poste(5, 5)}{poste(295, 5)}
      <Prisma b={[5, 5, Z0, 305, 15, Z0 + 10]} c={BALSA} className="estructura" />
      <Prisma b={[5, 5, ALERO - 10, 305, 15, ALERO]} c={BALSA} className="estructura" />
      <Viga a={[10, 10, ALERO]} b={[155, 10, CUMBRERA]} /><Viga a={[300, 10, ALERO]} b={[155, 10, CUMBRERA]} />
      <polygon points={pts([5, 3, Z0], [305, 3, Z0], [305, 3, ALERO], [155, 3, CUMBRERA], [5, 3, ALERO])} className="acrilico frente" />
      <path d={ruta([[22, 3, ALERO - 18], [70, 3, ALERO - 8]])} className="reflejo" />
    </g>
  );
}

// Tanque: el motor dibuja el agua (nivel y superficie con olas), el chorro al llenar y las burbujas
function Tanque({ r, capas }) {
  const vaso = prisma(TX0, TY0, Z0, TX1, TY1, Z0 + 100);
  return (
    <g {...capas("tanque")}>
      <polygon points={pts([TX0, TY1, Z0], [TX1, TY1, Z0], [TX1, TY1, Z0 + 100], [TX0, TY1, Z0 + 100])} className="vaso" />
      <g {...capas("bomba")} className="bomba">
        <Prisma b={[338, 243, Z0 + 2, 372, 268, Z0 + 32]} c={["#4A4E4B", "#6F6A60", "#3A3D3B"]} />
        <Manguera i={0} r={r} />
      </g>
      <polygon ref={r("aguaLado")} className="agua lado" />
      <polygon ref={r("aguaFrente")} className="agua" />
      <polygon ref={r("aguaArriba")} className="agua sup" />
      <polyline ref={r("aguaBrillo")} className="agua-brillo" />
      <g ref={r("burbujas")} className="burbujas" />
      {[[336, 291], [342, 291]].map(([x, y], i) => (
        <g key={i}>
          <path d={ruta([[x, y, Z0 + 104], [x, y, Z0 + 40]])} stroke="#9AA3A8" strokeWidth="1.4" />
          <path d={ruta([[x, y, Z0 + 40], [x, y, Z0 + 35]])} stroke="#C77B3A" strokeWidth="1.8" />
        </g>
      ))}
      <polygon points={vaso.frente} className="vaso" />
      <polygon points={vaso.lado} className="vaso" />
      <polygon points={vaso.arriba} className="vaso borde" />
      <path ref={r("chorro")} className="chorro" opacity="0" />
    </g>
  );
}

// Caja de la electrónica: paredes de MDF, interior visible con la tapa levantada
function Caja({ t, filasLcd, tapaAbierta, capas, txRef }) {
  const sinAgua = t && t.agua === 0;
  const rojo = sinAgua ? "parpadeo" : t?.suelo === "BAJA" ? "on" : "off";
  const azul = t?.aire_alta === 1 ? "on" : "off";
  const r1 = t?.bomba === 1, r2 = t?.ventilador === 1;
  return (
    <g>
      <Prisma b={[BX0, BY1 - 3, Z0, BX1, BY1, BZ1]} c={MDF} />
      <Prisma b={[BX0, BY0, Z0, BX0 + 3, BY1, BZ1]} c={MDF} />
      {/* Interior */}
      <polygon points={pts([BX0 + 3, BY0 + 3, Z0 + 3], [BX1 - 3, BY0 + 3, Z0 + 3], [BX1 - 3, BY1 - 3, Z0 + 3], [BX0 + 3, BY1 - 3, Z0 + 3])} fill="#B99C6C" />
      <Prisma b={[325, 30, Z0 + 3, 379, 195, Z0 + 12]} c={["#E4E1D8", "#F1EFE8", "#CFCBBF"]} />
      <Prisma b={[393, 120, Z0 + 3, 446, 189, Z0 + 8]} c={["#1A5C93", "#1F6DAD", "#174E7D"]} />
      <Prisma b={[425, 184, Z0 + 8, 437, 200, Z0 + 19]} c={["#AEB6BB", "#C5CCD1", "#98A0A5"]} />
      <Prisma b={[405, 125, Z0 + 8, 415, 160, Z0 + 12]} c={["#121413", "#1B1D1C", "#0E0F0E"]} />
      <Prisma b={[330, 14, Z0 + 3, 378, 40, Z0 + 5]} c={["#1A54A8", "#1F62C4", "#16468F"]} />
      <Prisma b={[386, 14, Z0 + 3, 434, 40, Z0 + 5]} c={["#1A54A8", "#1F62C4", "#16468F"]} />
      <g transform={caraArriba(0, 0, Z0 + 12.2)} className="interior">
        {[328, 333, 371, 376].map((x, i) => <line key={x} x1={x} x2={x} y1="-192" y2="-33" stroke={i % 2 ? "#D2463F" : "#2F62B8"} strokeWidth=".8" />)}
        <rect x="337" y="-192" width="30" height="159" fill="url(#agujeros)" />
        <path d="M352 -40 C352 -70 395 -80 405 -120 M410 -40 C410 -70 420 -100 420 -120 M340 -100 C360 -110 380 -120 395 -150" stroke="#7B4FB0" strokeWidth="1.3" fill="none" />
        <path d="M345 -150 C365 -160 380 -170 395 -175 M350 -60 C370 -80 380 -95 395 -130" stroke="#3FA45B" strokeWidth="1.3" fill="none" />
      </g>
      <g transform={caraArriba(0, 0, Z0 + 8.2)}>
        <circle cx="440" cy="-140" r="1.6" fill="#7CE38B" />
        <circle cx="440" cy="-150" r="1.6" ref={txRef} className="led-tx" />
      </g>
      <g transform={caraArriba(0, 0, Z0 + 5.2)}>
        <circle cx="372" cy="-20" r="2" fill={r1 ? "#FF5A4E" : "#5A2A28"} className={r1 ? "led-mod encendido" : ""} />
        <circle cx="428" cy="-20" r="2" fill={r2 ? "#FF5A4E" : "#5A2A28"} className={r2 ? "led-mod encendido" : ""} />
      </g>
      <Prisma b={[334, 18, Z0 + 5, 351, 33, Z0 + 20]} c={["#2C6FD0", "#4D8BE0", "#1F55A6"]} />
      <Prisma b={[390, 18, Z0 + 5, 407, 33, Z0 + 20]} c={["#2C6FD0", "#4D8BE0", "#1F55A6"]} />
      {/* Con la tapa levantada, las paredes se vuelven translúcidas para ver el interior */}
      <g {...capas("caja")}>
        <g className="pared-caja" data-abierta={+tapaAbierta}>
          <Prisma b={[BX1 - 3, BY0, Z0, BX1, BY1, BZ1]} c={MDF} />
          {/* Frente con la pantalla, los LEDs y el pulsador */}
          <Prisma b={[BX0, BY0, Z0, BX1, BY0 + 3, BZ1]} c={MDF} />
        </g>
      </g>
      <g transform={planoFrente(BY0)}>
        <g {...capas("pantalla")}>
          <rect x={BX0 + 14} y={-(Z0 + 61)} width="72" height="25" fill="#151716" />
          <rect x={BX0 + 18} y={-(Z0 + 56)} width="64" height="15" className="lcd-fondo" data-encendida={+!!t} />
          <g transform={`translate(${BX0 + 18.5} ${-(Z0 + 55.4)}) scale(.662 .8)`}><PuntosLcd filas={filasLcd} encendida={!!t} /></g>
        </g>
        <g {...capas("leds")}>
          <circle cx={BX0 + 104} cy={-(Z0 + 56)} r="2.8" className={`led rojo ${rojo}`} />
          <circle cx={BX0 + 118} cy={-(Z0 + 56)} r="2.8" className={`led azul ${azul}`} />
          <circle cx={BX0 + 111} cy={-(Z0 + 26)} r="6" fill="#9AA3A8" />
          <circle cx={BX0 + 111} cy={-(Z0 + 26)} r="4.2" fill="#D9DEE1" />
        </g>
      </g>
      {/* Tapa con el zumbador: se levanta para mostrar el interior */}
      <g className="tapa" data-abierta={+tapaAbierta}>
        {tapaAbierta && <path d={ruta([[436, 45, BZ1 + 3], [436, 45, Z0 + 40], [410, 120, Z0 + 10]])} className="cable" stroke="#D2463F" strokeWidth="1" />}
        <g {...capas("caja")}><Prisma b={[BX0, BY0, BZ1, BX1, BY1, BZ1 + 3]} c={MDF} /></g>
        <g {...capas("zumbador")}>
          <Prisma b={[411, 37, BZ1 + 3, 461, 53, BZ1 + 5]} c={["#1B1D1C", "#2A2E2C", "#141615"]} />
          <Prisma b={[417, 33, BZ1 + 3, 455, 57, BZ1 + 17]} c={["#1E2120", "#2E3331", "#151816"]} />
          <g transform={caraArriba(0, 0, BZ1 + 17)}>
            {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={422 + i * 6.5} y="-53" width="2.6" height="16" rx="1" fill="#3A403D" />)}
          </g>
          <g className="ondas-zumbador" data-sonando={+(t?.alarma === 1)} transform={caraFrente(0, 45, 0)}>
            {[0, 1, 2].map((i) => <path key={i} d={`M${420 - i * 9} ${-(BZ1 + 24 + i * 7)} a${26 + i * 12} ${18 + i * 8} 0 0 1 ${32 + i * 18} 0`} style={{ animationDelay: `${i * 0.25}s` }} />)}
          </g>
        </g>
      </g>
    </g>
  );
}

// Luz de la habitación según la hora del invernadero
function luz(hora) {
  if (!hora) return { color: "#0B1A2C", op: 0 };
  const [h, m] = hora.split(":").map(Number);
  const x = h + m / 60;
  if (x < 5.5 || x >= 19.5) return { color: "#1A2C48", op: 0.3 };
  if (x < 7) return { color: "#5A3F62", op: 0.3 * (7 - x) / 1.5 };
  if (x >= 18) return { color: "#5A3A48", op: 0.3 * (x - 18) / 1.5 };
  return { color: "#0B1A2C", op: 0 };
}

export default function Escena({ t, cfg, modo, latido, envio, pagina, sel, setSel, foco, setFoco, tapaAbierta }) {
  // Registro de los elementos que anima el motor (refs estables por nombre)
  const el = useRef({}).current;
  const r = useMemo(() => {
    const cache = {};
    return (nombre, i) => (cache[nombre + (i ?? "")] ||= (nodo) => {
      if (i == null) el[nombre] = nodo; else (el[nombre] ||= [])[i] = nodo;
    });
  }, [el]);
  const motor = useRef(null);
  const datos = useRef(t);
  datos.current = t;
  const reducir = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const m = new Motor(el);
    m.preparar();
    motor.current = m;
    if (reducir) { m.asentar(datos.current); return undefined; }
    let id, antes = performance.now();
    const cuadro = (ahora) => {
      m.cuadro((ahora - antes) / 1000, datos.current);
      antes = ahora;
      id = requestAnimationFrame(cuadro);
    };
    id = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(id);
  }, [el, reducir]);
  useEffect(() => { if (reducir) motor.current?.asentar(t); }, [t, reducir]);
  useEffect(() => { if (latido) motor.current?.latido(); }, [latido]);
  useEffect(() => { if (envio) motor.current?.comando(); }, [envio]);
  // LED TX del Arduino: destella con cada lectura
  useEffect(() => {
    const led = el.tx;
    if (!led || !latido) return;
    led.classList.remove("destello"); void led.getBoundingClientRect(); led.classList.add("destello");
  }, [latido, el]);

  const filasLcd = textoLcd(t, pagina);
  const capas = (id) => ({
    className: "pieza",
    "data-pieza": id,
    "data-sel": +(sel === id),
    "data-foco": +(foco === id),
    onClick: (e) => { e.stopPropagation(); setSel(sel === id ? null : id); },
    onPointerEnter: () => setFoco(id),
    onPointerLeave: () => setFoco(null),
  });
  const l = luz(t?.hora);
  const ancla = sel && PIEZAS[sel] ? P(...PIEZAS[sel].ancla) : null;

  return (
    <svg className="escena-svg" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img"
      aria-label="Maqueta del invernadero con sus sensores y actuadores" onClick={() => setSel(null)}
      data-alarma={+(t?.alarma === 1)} data-bomba={+(t?.bomba === 1)} data-modo={modo}>
      <defs>
        <linearGradient id="barro" x1="0" x2="1"><stop offset="0" stopColor="#9A5E3B" /><stop offset=".45" stopColor="#BC7B52" /><stop offset="1" stopColor="#8A5233" /></linearGradient>
        <linearGradient id="acero" x1="0" x2="1"><stop offset="0" stopColor="#8E979C" /><stop offset=".5" stopColor="#E3E8EB" /><stop offset="1" stopColor="#8E979C" /></linearGradient>
        <radialGradient id="brillo-humedo"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".55" /><stop offset="1" stopColor="#FFFFFF" stopOpacity="0" /></radialGradient>
        <radialGradient id="aire-caliente" cx=".45" cy=".65" r=".75"><stop offset="0" stopColor="#FF7A2E" stopOpacity=".8" /><stop offset=".6" stopColor="#FF9A4A" stopOpacity=".35" /><stop offset="1" stopColor="#FFB45E" stopOpacity=".08" /></radialGradient>
        <radialGradient id="luz-mesa"><stop offset="0" stopColor="#2A3D32" stopOpacity=".9" /><stop offset="1" stopColor="#2A3D32" stopOpacity="0" /></radialGradient>
        <pattern id="malla" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#3D4A44" /><path d="M0 0h3M0 0v3" stroke="#7E8F86" strokeWidth=".6" /></pattern>
        <pattern id="agujeros" width="2.54" height="2.54" patternUnits="userSpaceOnUse"><circle cx="1.27" cy="1.27" r=".45" fill="#8E8A80" /></pattern>
      </defs>
      <Fondo />
      <polygon points={pts([-4, -6, 0], [478, -6, 0], [486, 318, 0], [4, 318, 0])} className="sombra" />
      <Prisma b={[0, 0, 0, 470, 310, Z0]} c={MDF_BASE} />
      <Invernadero t={t} r={r} capas={capas} />
      <path d={ruta([[305, 46, Z0 + 15], [318, 46, Z0 + 15]])} className="cable" stroke="#7B4FB0" strokeWidth="4" />
      {/* Manguera exterior: del tanque a la pared derecha */}
      <g {...capas("bomba")}>
        <Manguera i={1} r={r} />
      </g>
      <Tanque r={r} capas={capas} />
      <g {...capas("usb")}>
        <path d={ruta(USB)} className="cable-usb" />
        <path d={ruta(USB)} className="cable-usb-toque" />
      </g>
      <g ref={r("pulsos")} />
      {/* La caja tapa el tanque: se vuelve translúcida al llenarlo o al mirar el tanque y la bomba */}
      <g ref={r("caja")} data-transparente={+(sel === "tanque" || sel === "bomba")}>
        <Caja t={t} filasLcd={filasLcd} tapaAbierta={tapaAbierta} capas={capas} txRef={r("tx")} />
      </g>
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} className="luz" fill={l.color} style={{ opacity: l.op }} />
      {/* Brillos por encima de la luz ambiente: se notan más de noche */}
      <g className="brillos" transform={planoFrente(BY0)}>
        {t && <rect x={BX0 + 18} y={-(Z0 + 56)} width="64" height="15" className="brillo-lcd" style={{ opacity: l.op * 1.4 }} />}
        {t?.suelo === "BAJA" && t.agua === 1 && <circle cx={BX0 + 104} cy={-(Z0 + 56)} r="9" className="brillo rojo" />}
        {t?.aire_alta === 1 && <circle cx={BX0 + 118} cy={-(Z0 + 56)} r="9" className="brillo azul" />}
      </g>
      {ancla && (
        <g className="ancla" pointerEvents="none">
          <circle cx={ancla[0]} cy={ancla[1]} r="5" />
          <circle cx={ancla[0]} cy={ancla[1]} r="5" className="onda" />
        </g>
      )}
    </svg>
  );
}
