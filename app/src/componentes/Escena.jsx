// Dibujo animado del invernadero. Cada animación representa algo real:
//  - cielo, sol y luna: hora del reloj del invernadero
//  - ventilador: gira cuando el relé 2 está activo, acelera y frena con inercia
//  - gotas y agua en la manguera: bomba en marcha
//  - hojas: se marchitan cuando el suelo está seco; tierra más oscura cuanto más húmeda
//  - tanque: nivel de agua; termómetro: temperatura; LEDs y pantalla: lo mismo que el equipo real
import { useEffect, useMemo, useRef } from "react";
import { interpolateRgb } from "d3-interpolate";
import { LuBell, LuFan, LuShowerHead } from "react-icons/lu";

const CIELO = [
  [0, "#14202E", "#24384C"], [5, "#1C2B3D", "#33495F"], [6.5, "#E5A877", "#F7DDBE"], [8, "#9CCBEA", "#E2F1F8"],
  [16.5, "#A5D0EB", "#E7F3F8"], [18, "#DE9566", "#F4CFAC"], [19.5, "#27384C", "#3F566C"], [24, "#14202E", "#24384C"],
];

function colorCielo(h) {
  for (let i = 0; i < CIELO.length - 1; i++) {
    const [h0, a0, b0] = CIELO[i], [h1, a1, b1] = CIELO[i + 1];
    if (h >= h0 && h <= h1) {
      const k = (h - h0) / (h1 - h0);
      return [interpolateRgb(a0, a1)(k), interpolateRgb(b0, b1)(k)];
    }
  }
  return [CIELO[0][1], CIELO[0][2]];
}

function horaDecimal(hora) {
  if (!hora) return 12;
  const [h, m, s] = hora.split(":").map(Number);
  return h + m / 60 + (s || 0) / 3600;
}

const reducirMovimiento = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Giro con inercia: el ventilador real tarda en acelerar y en frenar
function useGiro(activo, cx, cy) {
  const ref = useRef(null);
  const encendido = useRef(activo);
  encendido.current = activo;
  useEffect(() => {
    let ang = 0, vel = 0, previo = 0, raf = 0;
    const paso = (t) => {
      const dt = previo ? Math.min(0.1, (t - previo) / 1000) : 0;
      previo = t;
      const objetivo = encendido.current ? (reducirMovimiento ? 60 : 1080) : 0;
      vel += (objetivo - vel) * Math.min(1, dt * (encendido.current ? 1.4 : 0.8));
      ang = (ang + vel * dt) % 360;
      ref.current?.setAttribute("transform", `rotate(${ang.toFixed(1)} ${cx} ${cy})`);
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [cx, cy]);
  return ref;
}

function lineaLcd(t, pagina) {
  if (!t) return ["Invernadero IoT", "esperando datos"];
  if (pagina === 0) {
    const temp = typeof t.temp_c === "number" ? `${t.temp_c.toFixed(1)}C` : "--.-C";
    const suelo = typeof t.hum_suelo === "number" ? `${Math.round(t.hum_suelo)}%` : "??";
    return [`T:${temp}  HR:${t.aire_alta ? "ALTA" : "OK"}`, `S:${suelo} Agua:${t.agua === 0 ? "NO" : "OK"}`];
  }
  return [(t.estado || "").replaceAll("_", " ").slice(0, 16), `V:${t.ventilador} B:${t.bomba}    ${(t.hora || "").slice(0, 5)}`];
}

export default function Escena({ t, latido }) {
  const h = horaDecimal(t?.hora);
  const [cieloArriba, cieloAbajo] = colorCielo(h);
  const noche = h < 6 || h > 19 ? 1 : h < 7 ? 7 - h : h > 18 ? h - 18 : 0;
  const dia = h >= 6 && h <= 18;
  const fase = dia ? (h - 6) / 12 : ((h + 24 - 18) % 24) / 12;
  const astroX = 30 + fase * 580, astroY = 120 - Math.sin(fase * Math.PI) * 92;

  const ventilador = !!t?.ventilador, bomba = !!t?.bomba;
  const alarma = t?.alarma === 1;
  const suelo = typeof t?.hum_suelo === "number" ? t.hum_suelo : 50;
  const marchita = Math.max(0, Math.min(1, (40 - suelo) / 25));         // 0 sano, 1 muy seco
  const colorTierra = interpolateRgb("#BE9A6E", "#4A3020")(Math.max(0, Math.min(1, suelo / 85)));
  const nivel = typeof t?._tanque === "number" ? t._tanque / 100 : t?.agua === 0 ? 0.06 : 0.72;
  const temp = typeof t?.temp_c === "number" ? t.temp_c : null;
  const altoMercurio = temp === null ? 0 : Math.max(4, Math.min(96, (temp / 45) * 96));
  const colorMercurio = temp === null ? "#9AA79F" : temp >= 35 ? "#B3332E" : temp > 30 ? "#D07A12" : "#B9790A";
  const rojo = t ? (t.suelo === "BAJA" || t.agua === 0) : false;
  const azul = t?.aire === "ALTA";
  const pagina = Math.floor(Date.now() / 4000) % 2;
  const [l1, l2] = lineaLcd(t, pagina);

  const aspas = useGiro(ventilador, 92, 206);
  const estrellas = useMemo(() => Array.from({ length: 26 }, (_, i) => [((i * 97) % 600) + 15, ((i * 53) % 110) + 12, (i % 3) * 0.4 + 0.8]), []);

  return (
    <div className="escena" data-ventilador={+ventilador} data-bomba={+bomba} data-alarma={+alarma}>
      <svg viewBox="0 0 640 380" role="img" aria-label="Dibujo del invernadero con el estado actual de sensores y actuadores">
        <defs>
          <linearGradient id="g-vidrio" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity=".55" />
            <stop offset="1" stopColor="#D9EEF0" stopOpacity=".28" />
          </linearGradient>
          <clipPath id="c-tanque"><rect x="534" y="246" width="66" height="70" rx="3" /></clipPath>
        </defs>

        {/* Cielo según la hora del invernadero */}
        <rect className="cielo" x="0" y="0" width="640" height="200" style={{ fill: cieloArriba }} />
        <rect className="cielo" x="0" y="150" width="640" height="170" style={{ fill: cieloAbajo }} />
        {estrellas.map(([x, y, r], i) => (
          <circle key={i} className="estrella" cx={x} cy={y} r={r} fill="#fff" style={{ opacity: noche * 0.8 }} />
        ))}
        <circle className="astro" r={dia ? 17 : 12} cx="0" cy="0"
          style={{ transform: `translate(${astroX}px, ${astroY}px)`, fill: dia ? "#FFD25E" : "#E9EEF2" }} />

        {/* Suelo y base de la maqueta */}
        <rect x="0" y="318" width="640" height="62" fill="#C9D9CF" />
        <rect x="40" y="314" width="580" height="8" rx="2" fill="#C8A97E" />

        {/* Corrientes de aire del ventilador (hacia afuera) */}
        {[0, 1, 2].map((i) => (
          <path key={i} className="aire" d={`M 84 ${196 + i * 10} C 60 ${190 + i * 12}, 44 ${206 + i * 6}, 18 ${198 + i * 10}`}
            fill="none" stroke="#5E8C74" strokeWidth="2" strokeLinecap="round" />
        ))}

        {/* Invernadero: estructura de balso y paredes de acetato */}
        <path d="M 120 318 V 160 L 270 82 L 420 160 V 318 Z" fill="url(#g-vidrio)" />
        <path d="M 120 318 V 160 L 270 82 L 420 160 V 318" fill="none" stroke="#C59A55" strokeWidth="6" strokeLinejoin="round" />
        <path d="M 120 160 H 420 M 270 82 V 160" stroke="#C59A55" strokeWidth="4" />
        <path d="M 150 300 L 210 175 M 330 300 L 395 175" stroke="#fff" strokeOpacity=".5" strokeWidth="3" />

        {/* Manguera desde el tanque hasta la boquilla */}
        <path d="M 567 300 V 128 H 190 V 146" fill="none" stroke="#2370AE" strokeWidth="5" strokeLinejoin="round" />
        <path className="flujo" d="M 567 300 V 128 H 190 V 146" fill="none" stroke="#BFE3FF" strokeWidth="2" strokeLinejoin="round" />
        <path d="M 182 146 H 198 L 195 156 H 185 Z" fill="#1D5E93" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} className="gota" cx={180 + i * 5} cy="160" r="2.4" fill="#4A97D4" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}

        {/* Maceta, tierra y planta */}
        <path d="M 150 318 L 158 262 H 222 L 230 318 Z" fill="#A86E48" stroke="#6E4428" strokeWidth="2" strokeLinejoin="round" />
        <rect className="tierra" x="156" y="256" width="68" height="10" rx="3" style={{ fill: colorTierra }} />
        <path d="M 190 258 C 190 236 190 214 191 196" stroke="#2E7A4C" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <g className="hoja-planta" style={{ transformBox: "view-box", transformOrigin: "190px 236px", transform: `rotate(${-8 - marchita * 34}deg)` }}>
          <path d="M 190 236 C 172 232 160 218 159 205 C 176 207 188 220 190 236 Z" fill="#2E7A4C" />
        </g>
        <g className="hoja-planta" style={{ transformBox: "view-box", transformOrigin: "190px 222px", transform: `rotate(${8 + marchita * 38}deg)` }}>
          <path d="M 190 222 C 208 216 219 202 219 189 C 202 193 192 206 190 222 Z" fill="#3E9660" />
        </g>
        <g className="hoja-planta" style={{ transformBox: "view-box", transformOrigin: "191px 200px", transform: `rotate(${marchita * 26}deg)` }}>
          <path d="M 191 200 C 183 187 184 174 191 165 C 198 174 199 187 191 200 Z" fill="#2E7A4C" />
        </g>
        <line x1="208" y1="250" x2="208" y2="290" stroke="#8C9690" strokeWidth="2.5" />
        <line x1="214" y1="250" x2="214" y2="290" stroke="#8C9690" strokeWidth="2.5" />

        {/* Sensores colgados: módulo HR202 y sonda DS18B20 */}
        <line x1="300" y1="160" x2="300" y2="188" stroke="#55635A" strokeWidth="1.5" />
        <rect x="283" y="188" width="34" height="18" rx="2" fill="#1F5F99" />
        <rect x="305" y="192" width="9" height="10" rx="1" fill="#F4F1E6" />
        <circle cx="289" cy="196" r="2.4" style={{ fill: azul ? "#7CF0A0" : "#2D4F3A", transition: "fill .4s" }} />
        <line x1="342" y1="160" x2="342" y2="196" stroke="#2F3B33" strokeWidth="2" />
        <rect x="339" y="196" width="6" height="22" rx="3" fill="#B7C1C5" />

        {/* Termómetro: muestra la temperatura medida */}
        <rect x="392" y="182" width="12" height="104" rx="6" fill="#fff" stroke="#9FB0A7" />
        <rect className="mercurio" x="395" width="6" rx="3" style={{ y: 282 - altoMercurio, height: altoMercurio, fill: colorMercurio }} />
        <circle cx="398" cy="288" r="8" style={{ fill: colorMercurio, transition: "fill 1s" }} />

        {/* Ventilador en la pared izquierda */}
        <rect x="70" y="184" width="44" height="44" rx="5" fill="#26302B" />
        <circle cx="92" cy="206" r="18" fill="#3A4741" />
        <g ref={aspas}>
          {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} d="M 92 206 C 88 197 90 190 97 188 C 100 195 98 201 92 206 Z" fill="#DCE5E0" transform={`rotate(${a} 92 206)`} />
          ))}
        </g>
        <circle cx="92" cy="206" r="4.5" fill="#26302B" />

        {/* Caja de la electrónica: pantalla, LEDs y zumbador como el equipo real */}
        <rect x="432" y="250" width="92" height="66" rx="4" fill="#2C3832" />
        <rect x="438" y="257" width="80" height="24" rx="2" fill="#6EC38A" />
        <text x="441" y="267" fontSize="7.4" fontFamily="ui-monospace, Consolas, monospace" fill="#103A22">{l1}</text>
        <text x="441" y="277" fontSize="7.4" fontFamily="ui-monospace, Consolas, monospace" fill="#103A22">{l2}</text>
        <circle className="led" cx="446" cy="296" r="4" fill="#E5483F" style={{ opacity: rojo ? 1 : 0.22, filter: rojo ? "drop-shadow(0 0 3px #E5483F)" : "none" }} />
        <circle className="led" cx="458" cy="296" r="4" fill="#3C8CE0" style={{ opacity: azul ? 1 : 0.22, filter: azul ? "drop-shadow(0 0 3px #3C8CE0)" : "none" }} />
        <circle className="led" cx="470" cy="296" r="2.5" fill="#F2C94C" style={{ opacity: latido ? 1 : 0.25 }} />
        <circle cx="504" cy="300" r="7" fill="#B0BEC5" stroke="#1B2420" />
        {/* Zumbador atornillado sobre la tapa: rejilla y orejas; ondas cuando suena la alarma */}
        <rect x="481" y="245" width="38" height="4" rx="1" fill="#1B2420" />
        <rect x="488" y="238" width="24" height="12" rx="2" fill="#1B2420" />
        {[241, 244, 247].map((y) => <line key={y} x1="492" y1={y} x2="508" y2={y} stroke="#56625B" strokeWidth="1" />)}
        <g className="ondas-zumbador" fill="none" stroke="#E5483F" strokeWidth="1.8" strokeLinecap="round">
          <path d="M 516 236 q 6 6 0 12" /><path d="M 521 232 q 10 10 0 20" />
          <path d="M 484 236 q -6 6 0 12" /><path d="M 479 232 q -10 10 0 20" />
        </g>

        {/* Tanque con la bomba */}
        <rect x="532" y="244" width="70" height="74" rx="4" fill="#EAF5FB" fillOpacity=".7" stroke="#6B8FA8" strokeWidth="2" />
        <g clipPath="url(#c-tanque)">
          <g className="nivel-tanque" style={{ transform: `translateY(${(1 - nivel) * 70}px)` }}>
            <rect x="534" y="252" width="66" height="70" fill="#3E8ED0" fillOpacity=".55" />
            <path className="ola" d="M 520 252 q 10 -5 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 V 258 H 520 Z" fill="#3E8ED0" fillOpacity=".55" />
          </g>
          <g className="vibra"><rect x="557" y="294" width="20" height="18" rx="5" fill="#F4F1E6" stroke="#B9B3A0" /></g>
        </g>
        {nivel < 0.15 && <text x="567" y="238" textAnchor="middle" fontSize="11" fill="#B3332E" fontWeight="600">Sin agua</text>}
      </svg>
      <div className="leyenda-escena">
        <span className="chip" data-tipo="ventilador" data-on={+ventilador}><LuFan /> Ventilador</span>
        <span className="chip" data-tipo="bomba" data-on={+bomba}><LuShowerHead /> Bomba</span>
        <span className="chip" data-tipo="alarma" data-on={+alarma}><LuBell /> Zumbador</span>
      </div>
    </div>
  );
}
