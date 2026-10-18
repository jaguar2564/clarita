(function () {
/* --- Infraestructura de nivel: todo queda encapsulado y se puede destruir --- */
const __listeners = [];
function __on(target, type, fn, opts) { target.addEventListener(type, fn, opts); __listeners.push([target, type, fn, opts]); }
let __raf = 0, __alive = true;

/* ============================================================
   Clarita busca a Any - NIVEL 4: INVIERNO
   Un día de invierno con nieve y MUCHO viento: las ráfagas empujan a Clarita, la vereda tiene parches
   de hielo que resbalan y los árboles se doblan.
   Clarita recorre 12 cuadras (camión de mudanza, calle en obra, bus, skatepark, camión varado con
   autoelevador y, al final, un muro enorme con una EXCAVADORA), espera el semáforo en verde para cruzar,
   junta moneditas y le lleva la bufanda a Any, que espera el micro en la parada.
   ============================================================ */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const PI2 = Math.PI * 2;

/* ---------- Mundo ---------- */
const GROUND = 440;          // altura de la vereda por donde corre Clarita
const HORIZON = 330;         // horizonte (para la perspectiva de las calles)
const BLOCKS = 12;           // cuadras (una más que en el nivel 2: la de la excavadora)
const BLOCK_LEN = 2100;      // largo de cada cuadra
const STREET_W = 380;        // ancho de cada calle que se cruza
const UNIT = 210;            // ancho de cada local
const SITE_STREET = 3;       // la calle en obra (después de la cuadra 4)
const CONSTR_W = 1300;       // ancho de la zona de obra (2 edificios + calle cerrada)
const SKATE_STREET = 7, SKATE_W = 1500;   // skatepark: la calle 8 (después de bajar del bus)
const streetW = (i) => (i === SITE_STREET ? CONSTR_W : i === SKATE_STREET ? SKATE_W : STREET_W);
const blockStart = (i) => { let x = i * BLOCK_LEN; for (let j = 0; j < i; j++) x += streetW(j); return x; };
// Pisos del andamio (altura de las tablas) y medidas de la obra (relativas al inicio de la zona)
const L1 = GROUND - 88, L2 = GROUND - 176, L3 = GROUND - 264;
const BUS_FIRST = 4, BUS_BLOCKS = 3, BUS_SPEED = 8;   // el bus lleva 3 cuadras (la 5, 6 y 7)
const WALL_H = 226;          // la valla es más alta que el salto: hay que ir por el puente
const SITE = { A0: 60, A1: 460, B0: 840, B1: 1240, BR0: 470, BR1: 830, WALL0: 605, WALL1: 695 };
/* Camión de mudanza: tapa la vereda. Hay que empujar la caja roja (con la cabeza) hasta la
   pila de cajas, subir por las cajas al camión, cruzar el techo y bajar por las cajas del otro lado. */
const MOVE_BLOCK = 1;        // cuadra del camión (0 = la primera cuadra, 1 = la segunda...)
const CRATE = 44;            // lado de cada caja
const TRUCK_CARGO_W = 200, TRUCK_CAB_W = 100;
const TRUCK_H = 140, CAB_H = 108;   // techos más altos que un salto (~110): hay que usar las cajas
const TRUCK_SPAN = CRATE * 3 + TRUCK_CARGO_W + TRUCK_CAB_W;   // pila izq. + camión + cajas de bajada
const TRUCK_AT = 1000;       // dónde empieza la pila de cajas dentro de la cuadra
const PUSH_DIST = 300;       // distancia inicial entre la caja roja y la pila de cajas
const NOSE = 9;              // cuánto sobresale la nariz del cuerpo de Clarita (empuja con la cabeza)
const PUSH_SPEED = 1.7;      // velocidad de Clarita mientras empuja
/* Camión varado: un camión grande corta el tránsito y la vereda. Clarita maneja un autoelevador,
   junta cajas y arma una escalera (6 cajas) para subir al camión, cruzarlo por arriba y bajar. */
const LIFT_BLOCK = 9;        // cuadra del camión varado (0 = la primera cuadra)
const LT_AT = 1380;          // dónde empieza la carga del camión dentro de la cuadra
const LT_CARGO_W = 220, LT_CAB_W = 110;
const LT_BED = 48;           // alto de la plataforma del camión
const LT_H = LT_BED + 3 * CRATE;   // techo de la carga (3 filas de cajas): más alto que un salto
const LT_CAB_H = 128;        // techo de la cabina
const LT_STEPS = [3, 2, 1];  // columnas de la escalera (cajas), de la más cercana al camión a la más lejana
const FK_SPEED = 2.9;        // velocidad del autoelevador
const FK_W = 84;             // ancho del cuerpo del autoelevador
const FK_REACH = 50;         // distancia entre el centro del autoelevador y la caja que lleva
const FK_CARRY = 52;         // altura de la caja mientras se transporta
const FK_LIFT = 2.4;         // velocidad del mástil
const FK_TOL = 20;           // tolerancia para alinear la caja con el hueco
/* Excavadora: un muro enorme corta la vereda. Clarita maneja la excavadora, cava un agujero, saca tierra
   y la deja junto al muro para armar una montaña por donde subir. */
const DIG_BLOCK = 10;        // cuadra de la excavadora (0 = la primera cuadra)
const DG_WALL_AT = 1380;     // dónde empieza el muro dentro de la cuadra
const DG_WALL_W = 170, DG_WALL_H = 176;   // muro alto: más alto que un salto
const DG_LOW_W = 110, DG_LOW_H = 110;     // tramo bajo para bajar
const SOIL = 66, SOIL_W = 80;             // alto de cada palada de tierra y ancho de cada columna
const DG_STEPS = [2, 1];     // columnas de la montaña (paladas): la más cercana al muro y la más lejana
const EX_SPEED = 3.0;        // velocidad de la excavadora
const EX_HALF = 74;          // medio ancho del cuerpo
const EX_REACH = 150;        // distancia entre el centro de la excavadora y la pala
const EX_TOL = 26;           // tolerancia para alinear la pala con el hueco de la montaña
const streetStart = (i) => blockStart(i) + BLOCK_LEN;   // i = 0..BLOCKS-2
const FINISH_X = blockStart(BLOCKS - 1) + BLOCK_LEN;
const WORLD_START = -840;
const WORLD_END = FINISH_X + 900;
const GIVE_T = 40;            // frame (tras llegar) en que Clarita le entrega el regalo a Any
const END_BUS_TRIGGER = 560;  // el micro de la parada arranca cuando Clarita está a esta distancia de Any

/* ---------- Física ---------- */
const GRAVITY = 0.6;
const GRAVITY_RELEASE = 1.5;
const MAX_FALL = 15;
const RUN_SPEED = 5.2;
const JUMP_FORCE = 11.8;
const COYOTE_FRAMES = 6;
const BUFFER_FRAMES = 6;

const INK = "#231a1c";

/* ---------- Utilidades ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const kf = (y) => 0.4 + 0.6 * (y - HORIZON) / 110;   // factor de perspectiva en las calles

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI2); }

function roundRect(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
  r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
  return `rgb(${r},${g},${b})`;
}

/* Polilínea con contorno oscuro y relleno encima */
function limb(points, width, color, outline = INK, extra = 2.2) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [w, c] of [[width + extra, outline], [width, color]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}

/* Punto a cierta distancia; ángulo desde la vertical hacia abajo (positivo = adelante) */
function reach(from, angle, len) {
  return { x: from.x + Math.sin(angle) * len, y: from.y + Math.cos(angle) * len };
}

/* Cinemática inversa de dos segmentos (rodilla / codo) */
function ik(h, f, a, b, dir) {
  const dx = f.x - h.x, dy = f.y - h.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01);
  const ang = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const th = ang + dir * A;
  return { x: h.x + Math.cos(th) * a, y: h.y + Math.sin(th) * a };
}

function heart(x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.3, y + s * 0.1, x - s * 0.9, y - s * 0.9, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 0.9, x + s * 1.3, y + s * 0.1, x, y + s * 0.9);
  ctx.fill();
}

/* ---------- Sonido (sin archivos: se genera con WebAudio) ---------- */
let audioCtx = null;
function coinSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    for (const [f, d] of [[988, 0], [1319, 0.07]]) {   // "ding-ding" corto
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.03, t + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.14);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t + d); o.stop(t + d + 0.16);
    }
  } catch (_) { /* sin audio */ }
}

/* "Toc" grave cuando la caja choca contra la pila */
function thudSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.22);
  } catch (_) { /* sin audio */ }
}

/* ---------- Imagen de introducción y música de fondo ---------- */
const introImg = new Image();
introImg.src = "multimedia/intro4.jpg";   // si no existe, se muestra el cartel de texto
const introReady = () => introImg.complete && introImg.naturalWidth > 0;

const music = new Audio("multimedia/musicaclarita.mp3");
music.loop = true;
music.volume = 0.6;   // un poco más baja para que se oiga el viento
let musicWanted = false;
function restartMusic() {
  music.currentTime = 0;
  musicWanted = true;
  music.play().catch(() => { /* el navegador la deja empezar con el próximo toque */ });
}
__on(document, "visibilitychange", () => {   // se calla si cambias de pestaña
  if (document.hidden) music.pause();
  else if (musicWanted) music.play().catch(() => {});
});

/* Fanfarria de victoria: arpegio ascendente y acorde final */
function victorySound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const note = (f, d, len, vol) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(vol, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t + d); o.stop(t + d + len + 0.05);
    };
    [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.13, 0.22, 0.2));
    [523, 659, 784, 1047].forEach((f) => note(f, 0.62, 0.9, 0.12));
  } catch (_) { /* sin audio */ }
}

/* ---------- Entrada ---------- */
const keys = { left: false, right: false, jump: false };
let jumpPressed = false;

const KEY_MAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "jump", KeyW: "jump", Space: "jump",
};

__on(window, "keydown", (e) => {
  const action = KEY_MAP[e.code];
  if (action) {
    e.preventDefault();
    if (action === "jump" && !keys.jump) jumpPressed = true;
    keys[action] = true;
  }
  if (e.code === "KeyM") music.muted = !music.muted;   // M: silenciar / activar la música
  if ((e.code === "Enter" || e.code === "Space") && !e.repeat) advanceState();
});

__on(window, "keyup", (e) => {
  const action = KEY_MAP[e.code];
  if (action) keys[action] = false;
});

function bindButton(id, action) {
  const el = document.getElementById(id);
  if (!el) return;   // si el botón táctil no existe en el HTML, se ignora
  const down = (e) => {
    e.preventDefault();
    if (action === "jump" && !keys.jump) jumpPressed = true;
    keys[action] = true;
    el.classList.add("on");
    advanceState();
  };
  const up = (e) => {
    e.preventDefault();
    keys[action] = false;
    el.classList.remove("on");
  };
  __on(el, "pointerdown", down);
  __on(el, "pointerup", up);
  __on(el, "pointerleave", up);
  __on(el, "pointercancel", up);
}
bindButton("btnLeft", "left");
bindButton("btnRight", "right");
bindButton("btnJump", "jump");
__on(canvas, "pointerdown", advanceState);

function advanceState() {
  if (state === "start") startGame();
  else if (state === "won" && wonT > 130) window.dispatchEvent(new CustomEvent("nivel-siguiente", { detail: { nivel: 4 } }));
  else if (state === "over") retry();
}


/* ============================================================
   INVIERNO: nieve, mucho viento, hielo y sonidos
   ============================================================ */
const SNOW_FAR = 130, SNOW_NEAR = 80;
let snowFar = [], snowNear = [], puddles = [];   // "puddles" = parches de hielo en la vereda
let gust = 0, gustCool = 500, cloudOff = 0;       // gust: 0 (calma) .. 1 (ráfaga fuerte)
let lightning = 0;                                // (sin relámpagos en invierno)
let windNode = null;

// el viento sube y baja solo: a veces calma, a veces ráfagas fuertes
const windTarget = (t) => clamp(Math.sin(t * 0.012 + 1.7 * Math.sin(t * 0.0041)) * 0.9 + 0.2, 0, 1);

function initRain() {
  snowFar = []; snowNear = [];
  for (let i = 0; i < SNOW_FAR; i++) snowFar.push({ x: rand(0, W + 260), y: rand(0, H), v: rand(1.1, 1.9), r: rand(1, 1.8), ph: rand(0, PI2) });
  for (let i = 0; i < SNOW_NEAR; i++) snowNear.push({ x: rand(0, W + 260), y: rand(0, H), v: rand(2.2, 3.4), r: rand(2, 3.6), ph: rand(0, PI2) });
  gust = 0; gustCool = 420; cloudOff = 0;
}

function updateRain() {
  gust += (windTarget(time) - gust) * 0.04;
  cloudOff += 0.3 + gust * 1.6;
  for (const [arr, k] of [[snowFar, 5.5], [snowNear, 11]]) {
    for (const d of arr) {
      d.ph += 0.05;
      d.y += d.v;
      d.x += -(0.8 + gust * k) * (0.7 + d.r * 0.15) + Math.sin(d.ph) * 0.4;   // el viento la arrastra hacia la izquierda
      if (d.y > H) { d.y = rand(-30, -4); d.x = rand(0, W + 260); }
      if (d.x < -40) { d.x += W + 300; d.y = rand(-10, H); }
    }
  }
  if (windNode) windNode.g.gain.value = 0.015 + 0.07 * gust;
  if (gustCool > 0) gustCool--;
  else if (gust > 0.8 && state === "play") { gustCool = 1500; showBanner("¡Ráfaga de viento! Te empuja hacia atrás."); }
}

/* Ruido filtrado = viento de fondo */
function noiseBuffer(seconds) {
  const len = Math.floor(audioCtx.sampleRate * seconds);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
function startRainSound() {   // (nombre heredado) arranca el viento
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    stopRainSound();
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer(2); src.loop = true;
    const f = audioCtx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 0.7;
    const g = audioCtx.createGain(); g.gain.value = 0.02;
    src.connect(f); f.connect(g); g.connect(audioCtx.destination);
    src.start();
    windNode = { src, g };
  } catch (_) { /* sin audio */ }
}
function stopRainSound() {
  try { if (windNode) { windNode.src.stop(); windNode = null; } } catch (_) { windNode = null; }
}
function splashSound() {   // crujido de nieve / hielo
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer(0.2);
    const f = audioCtx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2200;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(f); f.connect(g); g.connect(audioCtx.destination);
    src.start(t); src.stop(t + 0.2);
  } catch (_) { /* sin audio */ }
}

/* Hielo: parches que se reparten por las cuadras (no en las calles ni en las zonas de obra) */
function buildPuddles() {
  puddles = [];
  for (let b = 0; b < BLOCKS; b++) {
    if (b === LIFT_BLOCK || b === DIG_BLOCK) continue;
    const x0 = blockStart(b);
    let x = x0 + (b === 0 ? 560 : 300);
    const lim = x0 + BLOCK_LEN - 260;
    while (x < lim) {
      const w = rand(90, 170);
      if (!solids.some((s) => s.type === "block" && x < s.x + s.w + 30 && x + w > s.x - 30)) puddles.push({ x, w, seed: Math.random() });
      x += w + rand(320, 620);
    }
  }
}
const inPuddle = (px) => puddles.some((q) => px > q.x && px < q.x + q.w);
let wasInPuddle = false;

function drawPuddles() {
  for (const q of puddles) {
    const sx = q.x - camX;
    if (sx > W + 20 || sx + q.w < -20) continue;
    const cy = GROUND + 8;
    ctx.fillStyle = "rgba(140,185,225,0.8)";
    ctx.beginPath(); ctx.ellipse(sx + q.w / 2, cy, q.w / 2, 11, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = "rgba(240,250,255,0.85)";
    ctx.beginPath(); ctx.ellipse(sx + q.w / 2 - 6, cy - 2, q.w / 2 - 10, 6, 0, 0, PI2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx + q.w * 0.25, cy - 3); ctx.lineTo(sx + q.w * 0.25 + 18, cy - 5);
    ctx.moveTo(sx + q.w * 0.6, cy + 2); ctx.lineTo(sx + q.w * 0.6 + 14, cy);
    ctx.stroke();
  }
}

function drawSnowLayer(arr, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  for (const d of arr) { ctx.moveTo(d.x + d.r, d.y); ctx.arc(d.x, d.y, d.r, 0, PI2); }
  ctx.fill();
}

function drawStormOverlay() {   // (nombre heredado) bruma fría, nieve y rayas de viento
  ctx.fillStyle = "rgba(225,236,248,0.10)";
  ctx.fillRect(0, 0, W, H);
  drawSnowLayer(snowFar, 0.7);
  drawSnowLayer(snowNear, 0.95);
  if (gust > 0.25) {
    ctx.strokeStyle = `rgba(255,255,255,${(gust - 0.25) * 0.5})`; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const sp = 22 + (i % 4) * 9;
      const x = W + 120 - ((time * sp + i * 197) % (W + 360));
      const y = 70 + ((i * 53) % 380);
      ctx.moveTo(x, y); ctx.lineTo(x + 70 + (i % 3) * 30, y + 2);
    }
    ctx.stroke();
  }
}

/* ---------- Estado ---------- */
let state = "start";   // "start" | "play" | "over" | "won"
let player, solids, coins, streets, site, bus, park, boards, deco, particles, any, truck, lift, exc, endBus;
let camX, time, elapsed, hearts, coinCount, blockIdx, checkpoint, checkpointCoins;
let bannerText = "", bannerT = 0, shake = 0, flash = 0, wonT = 0;
let totalCoins = 0, best = 0;

try { best = Number(localStorage.getItem("clarita-best-4")) || 0; } catch (_) { /* sin almacenamiento */ }

const BANNERS = [
  `Cuadra 1 de ${BLOCKS}: ¡Día de invierno! Hace frío, nieva y sopla MUCHO viento.`,
  `Cuadra 2 de ${BLOCKS}: ¡un camión de mudanza tapa la vereda! Empuja la caja roja con la cabeza.`,
  `Cuadra 3 de ${BLOCKS}: el viento no para. ¡Cuidado con el hielo!`,
  `Cuadra 4 de ${BLOCKS}: ¡más adelante hay una calle en obra, cubierta de nieve!`,
  `Cuadra 5 de ${BLOCKS}: ¡pasaste la obra! Sube al bus para resguardarte del viento y avanzar 3 cuadras.`,
  `Cuadra 6 de ${BLOCKS}: ¡el bus te lleva entre la nevada!`,
  `Cuadra 7 de ${BLOCKS}: ¡ya casi bajas del bus!`,
  `Cuadra 8 de ${BLOCKS}: ¡a seguir a pie! El skatepark está cubierto de nieve.`,
  `Cuadra 9 de ${BLOCKS}: ¡el viento sopla cada vez más fuerte! Any está más cerca.`,
  `Cuadra 10 de ${BLOCKS}: ¡camión varado! Sube al autoelevador y arma una escalera de cajas.`,
  `Cuadra 11 de ${BLOCKS}: ¡un muro enorme corta la vereda! Maneja la excavadora, cava y arma una montaña de tierra.`,
  `Cuadra 12 de ${BLOCKS}: ¡Ahí está Any en la parada, muerta de frío! ¡Llévale la bufanda!`,
];

function showBanner(t) { bannerText = t; bannerT = 260; }

function newPlayer(x) {
  return {
    x, y: GROUND - 32, w: 54, h: 32,
    vx: 0, vy: 0, onGround: true,
    coyote: 0, buffer: 0, facing: 1,
    phase: 0, squash: 0, airT: 0, upT: 0,
    idle: 0, sitT: 0,
    hit: 0, rot: 0, invuln: 0, hitStreet: null,
    hint: null, hintGood: false, riding: false, skate: false, ramp: null, pushing: false, driving: false,
  };
}

function initWorld() {
  time = 0; elapsed = 0; camX = 0;
  hearts = 3; coinCount = 0; blockIdx = 0;
  checkpoint = 120; checkpointCoins = 0;
  bannerT = 0; shake = 0; flash = 0; wonT = 0;
  particles = [];
  keys.left = keys.right = keys.jump = false;
  jumpPressed = false;
  buildLevel();
  buildPuddles();
  initRain();
  player = newPlayer(120);
  any = { x: FINISH_X - 220, speed: 0, wheel: 0, state: "wait" };   // Any espera en la parada del final
  endBus = newEndBus();
}

function startGame() {
  initWorld();
  restartMusic();
  startRainSound();
  state = "play";
  showBanner(BANNERS[0]);
}

/* Micro de la parada final: está estacionado con la puerta justo donde espera Any (acaba de dejarla) */
function newEndBus() { return { x: any.x + 21, v: 0, wheel: 0, state: "park" }; }

function retry() {
  hearts = 3;
  endBus = newEndBus();
  coinCount = checkpointCoins;
  for (const c of coins) if (blockOf(c.x) >= blockIdx) c.got = false;
  const p = player;
  p.x = checkpoint; p.y = GROUND - p.h; p.vx = 0; p.vy = 0;
  p.hit = 0; p.rot = 0; p.invuln = 150; p.facing = 1; p.skate = false; p.ramp = null; p.driving = false;
  for (const b of boards) if (!b.dropped && blockOf(b.x) >= blockIdx) b.got = false;
  camX = Math.max(0, p.x - 300);
  state = "play";
  showBanner("Otra vez la cuadra " + (blockIdx + 1) + ". ¡Tú puedes, Clarita!");
}

function blockOf(x) {
  for (let i = BLOCKS - 1; i >= 0; i--) if (x >= blockStart(i)) return i;
  return 0;
}

function streetAt(x, withSite = false) {
  for (const s of streets) if (x > s.x - 4 && x < s.x + STREET_W + 4) return s;
  if (withSite) for (const z of [site, park]) if (x > z.x - 4 && x < z.x + z.w + 4) return z;
  return null;
}

/* ============================================================
   Nivel
   ============================================================ */
function buildLevel() {
  solids = []; coins = []; streets = []; deco = []; boards = []; truck = null; lift = null; exc = null;

  for (let i = 0; i < BLOCKS - 1; i++) {
    if (i === SITE_STREET) { site = { i, x: streetStart(i), w: CONSTR_W }; continue; }
    if (i === SKATE_STREET) { park = { i, x: streetStart(i), w: SKATE_W }; continue; }
    streets.push({
      i, x: streetStart(i), cx: streetStart(i) + STREET_W / 2,
      t: Math.floor(Math.random() * CYCLE_TOTAL),
      cars: [], spawnT: [rand(0, 30), rand(10, 60)],
    });
  }

  for (let b = 0; b < BLOCKS; b++) buildBlock(b);
  buildSite();
  buildPark();
  bus = { x: blockStart(BUS_FIRST) + 330, startX: blockStart(BUS_FIRST) + 330, endX: blockStart(BUS_FIRST + BUS_BLOCKS) + 330, v: 0, wheel: 0, t: 0, state: "wait" };

  // Decorado: árboles y faroles
  for (let b = 0; b < BLOCKS; b++) {
    const x0 = blockStart(b), x1 = x0 + BLOCK_LEN;
    for (let x = x0 + 170; x < x1 - 120; x += 390) deco.push({ type: "tree", x: x + rand(-50, 50), v: Math.random() });
    for (let x = x0 + 420; x < x1 - 120; x += 560) deco.push({ type: "lamp", x: x + rand(-40, 40) });
  }
  for (let x = WORLD_START + 120; x < 0; x += 330) deco.push({ type: "tree", x, v: Math.random() });

  // Plaza final
  for (let x = FINISH_X + 260; x < WORLD_END; x += 240) deco.push({ type: "tree", x: x + rand(-30, 30), v: Math.random() });

  totalCoins = coins.length;
}

/* Calle en obra: calle cerrada por una valla alta. Hay que subir por el
   andamio del edificio izquierdo, cruzar el puente y bajar por el derecho. */
function buildSite() {
  const x0 = site.x;
  const deck = (a, b, y) => solids.push({ kind: "plank", type: "float", x: x0 + a, y, w: b - a, h: 10 });
  const row = (a, b, y, n) => { for (let i = 0; i < n; i++) coins.push({ x: x0 + lerp(a, b, (i + 0.5) / n), y: y - 28, got: false }); };
  deck(100, 240, L1); deck(200, 340, L2); deck(300, 470, L3);          // subida
  solids.push({ kind: "bridge", type: "float", x: x0 + SITE.BR0, y: L3, w: SITE.BR1 - SITE.BR0, h: 24 });
  deck(830, 1000, L3); deck(960, 1130, L2); deck(1090, 1240, L1);      // bajada
  solids.push({ kind: "wall", type: "block", x: x0 + SITE.WALL0, y: GROUND - WALL_H, w: SITE.WALL1 - SITE.WALL0, h: WALL_H });
  row(110, 230, L1, 3); row(210, 330, L2, 3); row(310, 460, L3, 4);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    coins.push({ x: x0 + lerp(500, 800, t), y: L3 - 28 - 36 * Math.sin(t * Math.PI), got: false });
  }
  row(840, 990, L3, 4); row(970, 1120, L2, 3); row(1100, 1230, L1, 3);
}

/* Skatepark: se encuentra la patineta y se pasa por rampas que lanzan al aire.
   Clarita la lleva hasta que se acerca a la calle del semáforo. */
function buildPark() {
  const x0 = park.x;
  boards.push({ x: x0 + 230, got: false });
  for (let i = 0; i < 6; i++) coins.push({ x: x0 + 310 + i * 34, y: GROUND - 22, got: false });
  for (const [a, w, h] of [[480, 220, 70], [900, 260, 90], [1260, 200, 70]]) {
    solids.push({ kind: "ramp", type: "ramp", x: x0 + a, y: GROUND - h, w, h });
    for (let i = 0; i < 5; i++) coins.push({ x: x0 + a + w + 30 + i * 36, y: GROUND - h - 50 - 34 * Math.sin((i / 4) * Math.PI), got: false });
  }
}

function addSolid(kind, x, w, h) {
  solids.push({ kind, type: "block", x, y: GROUND - h, w, h });
}

function addCoinArc(cx, span, n, peak) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    coins.push({ x: cx - span / 2 + t * span, y: GROUND - 24 - 4 * peak * t * (1 - t), got: false });
  }
}

function addCoinLine(x, n, y, step = 34) {
  for (let i = 0; i < n; i++) coins.push({ x: x + i * step, y, got: false });
}

function buildBlock(b) {
  const x0 = blockStart(b), x1 = x0 + BLOCK_LEN;
  if (b === LIFT_BLOCK) { buildLift(x0); return; }   // cuadra del camión varado: todo a medida
  if (b === DIG_BLOCK) { buildDig(x0); return; }     // cuadra de la excavadora: todo a medida
  const tx = x0 + TRUCK_AT;   // pila de cajas del camión (solo en la cuadra MOVE_BLOCK)
  let x = x0 + (b === 0 ? 460 : (b === BUS_FIRST || b === BUS_FIRST + BUS_BLOCKS) ? 620 : 340);
  const kinds = b === SKATE_STREET + 1 ? ["coins"] : ["cone", "bin", "crate", "bench", "planter", "hydrant", "stall", "coins", "coins"];
  // en la cuadra del camión se deja libre el camino de la caja roja
  const limit = b === MOVE_BLOCK ? tx - PUSH_DIST - 220 : (b === BLOCKS - 1 ? x1 - 620 : x1 - 340);   // la última cuadra queda despejada para la parada de Any
  while (x < limit) {
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    x += addFeature(kind, x) + rand(210, 340);
  }
  if (b === MOVE_BLOCK) {
    buildTruck(tx);
    x = tx + TRUCK_SPAN + 260;
    while (x < (b === BLOCKS - 1 ? x1 - 620 : x1 - 340)) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      x += addFeature(kind, x) + rand(210, 340);
    }
  }
}

/* Camión de mudanza. De izquierda a derecha:
   caja roja (empujable) ... pila de 3 cajas | caja de carga | cabina | 2 cajas | 1 caja
   La pila (132) es más alta que un salto, así que hay que empujar la caja roja hasta pegarla
   a la pila, saltar sobre ella, luego sobre la pila y por último al techo del camión. */
function buildTruck(tx) {
  const C = CRATE;
  const rx = tx + C + TRUCK_CARGO_W + TRUCK_CAB_W;   // inicio de las cajas para bajar
  const box = { kind: "pushbox", type: "block", push: true, x: tx - PUSH_DIST, y: GROUND - C, w: C, h: C,
                minX: tx - PUSH_DIST, pushed: false, docked: false };
  solids.push(
    { kind: "cratestack", type: "block", n: 3, x: tx, y: GROUND - 3 * C, w: C, h: 3 * C },
    { kind: "truckhit", type: "block", x: tx + C, y: GROUND - TRUCK_H, w: TRUCK_CARGO_W, h: TRUCK_H },
    { kind: "truckhit", type: "block", x: tx + C + TRUCK_CARGO_W, y: GROUND - CAB_H, w: TRUCK_CAB_W, h: CAB_H },
    { kind: "cratestack", type: "block", n: 2, x: rx, y: GROUND - 2 * C, w: C, h: 2 * C },
    { kind: "cratestack", type: "block", n: 1, x: rx + C, y: GROUND - C, w: C, h: C },
    box
  );
  truck = {
    x: tx + C, stackX: tx, crate: box,
    roofX: tx + C, cabX: tx + C + TRUCK_CARGO_W, endX: rx + 2 * C,
    zoneA: tx - PUSH_DIST - 100, zoneB: rx + 2 * C + 80,
  };
  addCoinLine(tx - PUSH_DIST + 70, 6, GROUND - 22, 34);                       // camino hasta la pila
  coins.push({ x: tx + C / 2, y: GROUND - 3 * C - 28, got: false });          // sobre la pila
  for (let i = 0; i < 6; i++) coins.push({ x: tx + C + 28 + i * 32, y: GROUND - TRUCK_H - 28, got: false });   // techo
  for (let i = 0; i < 2; i++) coins.push({ x: truck.cabX + 28 + i * 44, y: GROUND - CAB_H - 28, got: false }); // cabina
  coins.push({ x: rx + C / 2, y: GROUND - 2 * C - 28, got: false });          // bajada
  coins.push({ x: rx + C + C / 2, y: GROUND - C - 28, got: false });
  addCoinLine(rx + 2 * C + 40, 4, GROUND - 22, 34);
}

/* Cuadra del camión varado. De izquierda a derecha:
   cajas sueltas y autoelevador | escalera (3 + 2 + 1 cajas, hay que armarla) | caja de carga | cabina
   El camión es más alto que un salto: hay que apilar cajas con el autoelevador para poder subir. */
function buildLift(x0) {
  const C = CRATE;
  const tx = x0 + LT_AT;
  const cargoEnd = tx + LT_CARGO_W, endX = cargoEnd + LT_CAB_W;
  solids.push(
    { kind: "truckhit", type: "block", x: tx, y: GROUND - LT_H, w: LT_CARGO_W, h: LT_H },
    { kind: "truckhit", type: "block", x: cargoEnd, y: GROUND - LT_CAB_H, w: LT_CAB_W, h: LT_CAB_H }
  );
  lift = {
    tx, cargoEnd, endX,
    cols: LT_STEPS.map((max, i) => ({ x: tx - C * (i + 1), n: 0, max, solid: null })),
    zoneA: x0 + 150, zoneB: endX + 80, fkMin: x0 + 200,
    fk: { x: x0 + 600, f: 1, v: 0, h: 0, load: false, wheel: 0, done: false, noPick: 0 },
    crates: [300, 400, 720, 800, 880, 960, 1040, 1120].map((r) => ({ x: x0 + r, got: false })),   // 8 cajas para 6 lugares
  };
  addCoinArc(x0 + 100, 160, 5, 60);
  addCoinLine(x0 + 650, 6, GROUND - 62, 36);                                    // se juntan manejando
  for (const col of lift.cols) coins.push({ x: col.x + C / 2, y: GROUND - col.max * C - 28, got: false });   // sobre cada escalón
  for (let i = 0; i < 6; i++) coins.push({ x: tx + 28 + i * 32, y: GROUND - LT_H - 28, got: false });        // techo de la carga
  for (let i = 0; i < 2; i++) coins.push({ x: cargoEnd + 28 + i * 44, y: GROUND - LT_CAB_H - 28, got: false }); // cabina
  addCoinArc(endX + 150, 180, 6, 70);
  addCoinLine(endX + 280, 4, GROUND - 22, 34);
}

/* Cuadra de la excavadora. De izquierda a derecha:
   excavadora | zona de tierra para cavar | montaña por armar (2 + 1 paladas) | muro alto | tramo bajo
   El muro es más alto que un salto: hay que cavar tierra y juntarla junto al muro para subir. */
function buildDig(x0) {
  const wx = x0 + DG_WALL_AT, endX = wx + DG_WALL_W + DG_LOW_W;
  solids.push(
    { kind: "digwall", type: "block", x: wx, y: GROUND - DG_WALL_H, w: DG_WALL_W, h: DG_WALL_H },
    { kind: "digwall", type: "block", x: wx + DG_WALL_W, y: GROUND - DG_LOW_H, w: DG_LOW_W, h: DG_LOW_H }
  );
  exc = {
    x0, wx, endX, dzC: x0 + 940,
    cols: DG_STEPS.map((max, i) => ({ x: wx - SOIL_W * (i + 1), n: 0, max, solid: null })),
    zoneA: x0 + 150, zoneB: endX + 80, xMin: x0 + 260,
    x: x0 + 520, f: 1, v: 0, load: false, track: 0, done: false, holes: 0,
    anim: null, animT: 0, dumpY: -100, spill: false, slot: null,
  };
  addCoinArc(x0 + 100, 160, 5, 60);
  addCoinLine(x0 + 560, 6, GROUND - 62, 36);                                    // se juntan manejando
  for (const col of exc.cols) coins.push({ x: col.x + SOIL_W / 2, y: GROUND - col.max * SOIL - 28, got: false });   // sobre cada escalón
  for (let i = 0; i < 5; i++) coins.push({ x: wx + 28 + i * 30, y: GROUND - DG_WALL_H - 28, got: false });         // arriba del muro
  for (let i = 0; i < 2; i++) coins.push({ x: wx + DG_WALL_W + 26 + i * 44, y: GROUND - DG_LOW_H - 28, got: false });
  addCoinArc(endX + 150, 180, 6, 70);
  addCoinLine(endX + 280, 4, GROUND - 22, 34);
}

/* Agrega un elemento y devuelve el ancho que ocupa */
function addFeature(kind, x) {
  switch (kind) {
    case "cone":    addSolid("cone", x, 24, 28);    addCoinArc(x + 12, 100, 4, 46); return 24;
    case "bin":     addSolid("bin", x, 30, 40);     addCoinArc(x + 15, 110, 4, 54); return 30;
    case "hydrant": addSolid("hydrant", x, 22, 32); addCoinArc(x + 11, 100, 4, 48); return 22;
    case "crate":   addSolid("crate", x, 38, 34);   addCoinArc(x + 19, 110, 4, 52); return 38;
    case "planter": addSolid("planter", x, 62, 38); addCoinArc(x + 31, 130, 5, 54); return 62;
    case "bench":
      addSolid("bench", x, 112, 30);
      addCoinLine(x + 18, 4, GROUND - 30 - 26, 26);
      return 112;
    case "stall": {
      const palette = [["#e4572e", "#fffaf0"], ["#2e86ab", "#fffaf0"], ["#e8a317", "#fffaf0"]];
      solids.push({ kind: "stall", type: "float", x, y: GROUND - 72, w: 156, h: 10, c: palette[Math.floor(Math.random() * 3)] });
      addCoinLine(x + 22, 4, GROUND - 72 - 26, 34);
      return 156;
    }
    default: {
      if (Math.random() < 0.5) addCoinLine(x, 6, GROUND - 22, 34);
      else addCoinArc(x + 90, 180, 6, 70);
      return 180;
    }
  }
}

/* ============================================================
   Semáforos y autos
   ============================================================ */
const CYCLE = [
  { name: "green", len: 200, carsGo: false, ped: "green" },
  { name: "flash", len: 90,  carsGo: false, ped: "flash" },
  { name: "hold",  len: 25,  carsGo: false, ped: "red" },
  { name: "red",   len: 280, carsGo: true,  ped: "red" },
  { name: "clear", len: 45,  carsGo: false, ped: "red" },
];
const CYCLE_TOTAL = CYCLE.reduce((a, p) => a + p.len, 0);

function lightState(s) {
  let t = s.t % CYCLE_TOTAL;
  for (const ph of CYCLE) {
    if (t < ph.len) return { name: ph.name, carsGo: ph.carsGo, ped: ph.ped, left: ph.len - t };
    t -= ph.len;
  }
  return { name: "green", carsGo: false, ped: "green", left: 1 };
}

function framesUntilGreen(s) {
  const L = lightState(s);
  if (L.name === "green") return 0;
  let idx = CYCLE.findIndex((ph) => ph.name === L.name);
  let f = L.left;
  idx = (idx + 1) % CYCLE.length;
  while (CYCLE[idx].name !== "green") { f += CYCLE[idx].len; idx = (idx + 1) % CYCLE.length; }
  return f;
}

const CAR_COLORS = [
  ["#e4572e", "#c9441f"], ["#2e86ab", "#256d8c"], ["#f3b61f", "#d99c0b"],
  ["#6a994e", "#547c3d"], ["#8e5572", "#744460"], ["#eef0f2", "#cfd3d8"], ["#3d405b", "#2f3248"],
];

function trySpawn(s, lane) {
  if (s.spawnT[lane] > 0) return;
  const y0 = lane === 0 ? 334 : 592;
  const blocked = s.cars.some((c) => c.lane === lane && Math.abs(c.y - y0) < (lane === 0 ? 28 : 80));
  if (blocked) return;
  const col = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  s.cars.push({ lane, y: y0, v: 1, x: s.cx, color: col[0], cabin: col[1] });
  s.spawnT[lane] = rand(40, 130);
}

function updateCars(s) {
  const L = lightState(s);
  s.spawnT[0]--; s.spawnT[1]--;
  trySpawn(s, 0); trySpawn(s, 1);

  for (const lane of [0, 1]) {
    const dir = lane === 0 ? 1 : -1;
    const stopY = lane === 0 ? 392 : 518;
    const list = s.cars.filter((c) => c.lane === lane).sort((a, b) => (b.y - a.y) * dir);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const leader = i > 0 ? list[i - 1] : null;
      const k = kf(c.y);
      const passed = dir > 0 ? c.y > stopY + 5 : c.y < stopY - 5;
      let limit = null;
      if (!L.carsGo && !passed) limit = stopY;
      if (leader) {
        const lim2 = leader.y - dir * 40 * k;
        limit = limit === null ? lim2 : (dir > 0 ? Math.min(limit, lim2) : Math.max(limit, lim2));
      }
      const cruise = 3.4 * k;
      let target = cruise;
      if (limit !== null) {
        const dist = (limit - c.y) * dir;
        target = dist <= 0 ? 0 : Math.min(cruise, dist * 0.12);
      }
      c.v += (target - c.v) * (target < c.v ? 0.18 : 0.05);
      if (c.v < 0.03) c.v = 0;
      c.y += dir * c.v;
      c.x = s.cx + (lane === 0 ? -1 : 1) * STREET_W * 0.25 * kf(c.y);
    }
  }
  s.cars = s.cars.filter((c) => (c.lane === 0 ? c.y < 612 : c.y > 326));
}

/* ============================================================
   Actualización
   ============================================================ */
function spawnDust(x, y, vx, vy) {
  particles.push({ kind: "dust", x, y, vx, vy, life: 1, size: rand(2, 4.5) });
}

function land(p, was) {
  if (!was && p.vy > 4) {
    p.squash = clamp(p.vy / 16, 0.15, 0.45);
    for (let i = 0; i < 6; i++) spawnDust(p.x + p.w / 2, p.y + p.h, rand(-2, 2), rand(-1.4, -0.2));
  }
  p.vy = 0;
  p.onGround = true;
}

/* Mueve la caja roja d píxeles; devuelve cuánto se movió de verdad (se frena contra otros bloques) */
function pushCrate(s, d) {
  let nx = Math.max(s.x + d, s.minX);
  for (const o of solids) {
    if (o === s || o.type !== "block") continue;
    if (nx + s.w > o.x && nx < o.x + o.w) nx = d > 0 ? o.x - s.w : o.x + o.w;
  }
  const moved = nx - s.x;
  s.x = nx;
  return moved;
}

function moveAndCollide() {
  const p = player;
  p.x += p.vx;
  p.pushing = false;
  for (const s of solids) {
    if (s.type !== "block") continue;
    if (!(p.y + p.h > s.y + 0.5 && p.y < GROUND)) continue;

    // Caja roja: Clarita la empuja con la cabeza (la nariz sobresale NOSE px del cuerpo)
    if (s.push && p.onGround && p.vx !== 0) {
      const dir = p.vx > 0 ? 1 : -1;
      const pen = dir > 0 ? p.x + p.w + NOSE - s.x : s.x + s.w - (p.x - NOSE);
      const touching = pen > 0 && (dir > 0 ? p.x < s.x + s.w : p.x + p.w > s.x);
      if (touching) {
        const moved = pushCrate(s, dir * Math.min(pen, PUSH_SPEED));
        p.x = dir > 0 ? s.x - p.w - NOSE : s.x + s.w + NOSE;   // la nariz queda pegada a la caja
        p.vx = moved !== 0 ? dir * PUSH_SPEED : 0;
        p.pushing = true;
        if (moved !== 0) {
          s.pushed = true; s.docked = false;
          if (time % 7 === 0) spawnDust(dir > 0 ? s.x : s.x + s.w, GROUND - 2, -dir * rand(0.3, 1), rand(-0.8, -0.2));
        } else if (dir > 0 && !s.docked) {   // chocó contra la pila de cajas
          s.docked = true;
          thudSound();
          for (let i = 0; i < 8; i++) spawnDust(s.x + s.w, GROUND - 4, rand(0.2, 1.6), rand(-1.4, -0.3));
        }
        continue;
      }
    }
    if (p.x + p.w > s.x && p.x < s.x + s.w) {
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      p.vx = 0;
    }
  }

  const prevBottom = p.y + p.h;
  p.y += p.vy;
  const was = p.onGround;
  p.onGround = false;

  if (p.y + p.h >= GROUND) { p.y = GROUND - p.h; land(p, was); }

  for (const s of solids) {
    if (s.type === "ramp" || !(p.x + p.w > s.x && p.x < s.x + s.w)) continue;
    const bottom = p.y + p.h;
    if (p.vy >= 0 && bottom >= s.y && prevBottom <= s.y + 1) { p.y = s.y - p.h; land(p, was); }
  }

  // Rampas: la superficie sube en diagonal; con patineta, al salir de la punta hay salto
  let onRamp = null;
  const rcx = p.x + p.w / 2;
  for (const s of solids) {
    if (s.type !== "ramp" || rcx < s.x || rcx > s.x + s.w) continue;
    const surf = GROUND - s.h * (rcx - s.x) / s.w;
    if (p.vy >= 0 && p.y + p.h >= surf && prevBottom <= surf + 12) { p.y = surf - p.h; land(p, was); onRamp = s; }
  }
  if (p.ramp && !onRamp && p.skate) p.vy = Math.min(p.vy, -9);
  p.ramp = onRamp;
}

function control(p) {
  p.pushing = false;
  if (p.riding) {   // viajando en el bus: va sentada en la ventanilla
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = 1; p.idle = 0;
    p.x = bus.x - p.w / 2 - 20; p.y = GROUND - p.h;
    return;
  }
  if (p.driving) { if (p.driving === "ex") driveExc(p); else driveLift(p); return; }   // manejando el autoelevador o la excavadora
  const live = state === "play";
  const dir = live ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  const maxV = p.skate ? 7.4 : RUN_SPEED;
  const ice = inPuddle(p.x + p.w / 2);
  const kLerp = p.onGround ? (p.skate ? 0.06 : (ice ? 0.05 : 0.14)) : 0.1;   // sobre el hielo cuesta frenar y arrancar
  p.vx += (dir * maxV - p.vx) * kLerp;
  if (live && (dir !== 0 || !p.onGround)) p.vx -= gust * 1.25 * kLerp;      // el viento empuja hacia atrás (hacia la izquierda)
  if (Math.abs(p.vx) < 0.05) p.vx = 0;
  if (dir !== 0) p.facing = dir;
  if (state === "won") p.facing = 1;

  const inStreet = !!streetAt(p.x + p.w / 2);
  p.coyote = p.onGround ? COYOTE_FRAMES : Math.max(0, p.coyote - 1);
  p.buffer = jumpPressed && live ? BUFFER_FRAMES : Math.max(0, p.buffer - 1);
  jumpPressed = false;

  if (p.buffer > 0 && p.coyote > 0 && !inStreet) {
    p.vy = -(p.skate ? 12.6 : JUMP_FORCE);
    p.onGround = false;
    p.coyote = 0; p.buffer = 0;
    p.squash = -0.25;
    for (let i = 0; i < 4; i++) spawnDust(p.x + p.w / 2, p.y + p.h, rand(-1.5, 1.5), rand(-1, 0));
  }

  p.vy += GRAVITY * (p.vy < 0 && !(keys.jump && live) ? GRAVITY_RELEASE : 1);
  p.vy = Math.min(p.vy, MAX_FALL);
  moveAndCollide();

  if (p.x < camX + 8) { p.x = camX + 8; p.vx = Math.max(p.vx, 0); }
  if (p.x > WORLD_END - 100) p.x = WORLD_END - 100;

  // Quieta: se sienta a esperar
  if (p.onGround && dir === 0 && Math.abs(p.vx) < 0.3) p.idle++; else p.idle = 0;
}

function hitByCar(s) {
  const p = player;
  hearts--;
  p.pushing = false;
  p.hit = 42;
  p.hitStreet = s;
  p.vx = -4.5;
  p.vy = -8.5;
  p.onGround = false;
  shake = 14; flash = 1;
  for (let i = 0; i < 10; i++) {
    const a = rand(0, PI2);
    particles.push({ kind: "star", x: p.x + p.w / 2, y: p.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, life: 1, size: rand(3, 5) });
  }
}

function tumble(p) {
  p.hit--;
  p.x += p.vx; p.y += p.vy; p.vy += GRAVITY;
  p.rot += -0.34 * p.facing;
  p.phase += 0.4;
  if (p.y > GROUND - p.h) { p.y = GROUND - p.h; p.vy = 0; p.vx *= 0.85; }
  if (p.hit <= 0) {
    p.rot = 0;
    if (hearts <= 0) { state = "over"; return; }
    p.x = p.hitStreet.x - 110;
    p.y = GROUND - p.h; p.vx = 0; p.vy = 0; p.facing = 1;
    p.invuln = 140;
    camX = Math.max(0, p.x - 300);
  }
}

function siteHint(p, pcx) {
  const rx = pcx - site.x;
  if (rx < 0 || rx > site.w) return false;
  const feet = p.y + p.h;
  if (feet > GROUND - 6) {
    if (rx < SITE.WALL0) { p.hint = "¡Calle cerrada! Sube por el andamio"; p.hintGood = false; }
    else if (rx > SITE.WALL1) { p.hint = "¡Muy bien! Sigue tu camino"; p.hintGood = true; }
  } else if (feet <= L3 + 3 && rx < SITE.B0) { p.hint = "¡Cruza el puente!"; p.hintGood = true; }
  else if (rx >= SITE.BR1) { p.hint = "¡Baja con cuidado!"; p.hintGood = true; }
  return true;
}

/* Mensajes del camión de mudanza */
function truckHint(p, pcx) {
  if (!truck || pcx < truck.zoneA || pcx > truck.zoneB) return false;
  const feet = p.y + p.h;
  const crate = truck.crate;
  if (feet > GROUND - 6) {   // en la vereda
    if (pcx > truck.endX) { p.hint = "¡Muy bien! Sigue tu camino"; p.hintGood = true; }
    else if (crate.docked) { p.hint = "¡Salta sobre la caja y sube!"; p.hintGood = true; }
    else if (pcx < truck.stackX) { p.hint = "¡Camión! Empuja la caja roja con la cabeza"; p.hintGood = false; }
  } else if (pcx < truck.stackX - 80) {
    /* saltando lejos del camión: sin mensaje */
  } else if (pcx < truck.roofX) { p.hint = "¡Sigue subiendo!"; p.hintGood = true; }
  else if (pcx < truck.cabX) { p.hint = "¡Cruza el camión!"; p.hintGood = true; }
  else { p.hint = "¡Baja con cuidado!"; p.hintGood = true; }
  return true;
}

/* Mensajes de la cuadra del camión varado */
function liftHint(p, pcx) {
  if (!lift || pcx < lift.zoneA || pcx > lift.zoneB) return false;
  const fk = lift.fk, feet = p.y + p.h;
  if (p.driving) {
    p.hintGood = true;
    if (!fk.load) p.hint = "¡Toca una caja con las horquillas!";
    else if (liftAligned()) p.hint = "¡Ahora! Pulsa Saltar para dejar la caja";
    else p.hint = "Lleva la caja al hueco amarillo";
    return true;
  }
  if (feet > GROUND - 6) {   // en la vereda
    if (pcx > lift.endX) { p.hint = "¡Muy bien! Sigue tu camino"; p.hintGood = true; }
    else if (!fk.done) { p.hint = "¡Camión varado! Sube al autoelevador"; p.hintGood = false; }
    else { p.hint = "¡Sube por la escalera de cajas!"; p.hintGood = true; }
  } else if (pcx < lift.tx - 200) {
    /* saltando lejos del camión: sin mensaje */
  } else if (pcx < lift.tx) { p.hint = "¡Sigue subiendo!"; p.hintGood = true; }
  else if (pcx < lift.cargoEnd) { p.hint = "¡Cruza el camión!"; p.hintGood = true; }
  else { p.hint = "¡Baja con cuidado!"; p.hintGood = true; }
  return true;
}

/* Mensajes de la cuadra de la excavadora */
function excHint(p, pcx) {
  if (!exc || pcx < exc.zoneA || pcx > exc.zoneB) return false;
  const e = exc, feet = p.y + p.h;
  if (p.driving === "ex") {
    p.hintGood = true;
    if (e.anim) { p.hint = null; return true; }
    if (!e.load) p.hint = excDigOK() ? "¡Ahora! Pulsa Saltar para cavar" : "Lleva la pala a la zona de tierra marcada";
    else p.hint = excDumpOK() ? "¡Ahora! Pulsa Saltar para soltar la tierra" : "Lleva la tierra al hueco amarillo junto al muro";
    return true;
  }
  if (feet > GROUND - 6) {   // en la vereda
    if (pcx > e.endX) { p.hint = "¡Muy bien! Sigue tu camino"; p.hintGood = true; }
    else if (!e.done) { p.hint = "¡Muro enorme! Sube a la excavadora"; p.hintGood = false; }
    else { p.hint = "¡Sube por la montaña de tierra!"; p.hintGood = true; }
  } else if (pcx < e.wx - 200) {
    /* saltando lejos del muro: sin mensaje */
  } else if (pcx < e.wx) { p.hint = "¡Sigue subiendo!"; p.hintGood = true; }
  else if (pcx < e.wx + DG_WALL_W) { p.hint = "¡Cruza el muro!"; p.hintGood = true; }
  else { p.hint = "¡Baja con cuidado!"; p.hintGood = true; }
  return true;
}

function updateHint(p) {
  p.hint = null; p.hintGood = false;
  if (state !== "play") return;
  const pcx = p.x + p.w / 2;
  if (p.riding) return;
  if (bus.state === "wait" && pcx < bus.x && bus.x - pcx < 650) { p.hint = "¡Sube al bus!"; p.hintGood = true; return; }
  if (p.skate) {
    const nx = streets.find((s) => s.x + STREET_W > pcx);
    if (nx && nx.x - pcx < 520) { p.hint = "¡Cuidado! Ahí viene el semáforo"; p.hintGood = false; }
    return;
  }
  if (boards.some((b) => !b.got && !b.dropped && b.x > pcx && b.x - pcx < 500)) { p.hint = "¡Una patineta! Súbete"; p.hintGood = true; return; }
  if (siteHint(p, pcx)) return;
  if (truckHint(p, pcx)) return;
  if (liftHint(p, pcx)) return;
  if (excHint(p, pcx)) return;
  const next = streets.find((s) => s.x + STREET_W > pcx);
  if (!next) return;
  const L = lightState(next);
  const dx = next.x - (p.x + p.w);
  const inside = pcx > next.x && pcx < next.x + STREET_W;
  if (!inside && dx < 260 && dx > -10) {
    if (L.ped === "red") p.hint = "¡Espera el semáforo en verde!";
    else if (L.ped === "flash") p.hint = "Está titilando… ¡mejor espera!";
    else p.hint = "¡Verde! Cruza ahora";
  } else if (inside) {
    p.hint = L.ped === "green" ? null : "¡Corre!";
  }
}

/* Autobús: espera en la parada, Clarita sube al tocarlo, viaja 3 cuadras y baja */
function updateBus() {
  const p = player, b = bus;
  const pcx = p.x + p.w / 2;
  if (b.state === "wait") {
    if (state === "play" && p.hit <= 0 && p.onGround && Math.abs(pcx - b.x) < 110) { b.state = "ride"; b.v = 0; p.riding = true; coinSound(); }
  } else if (b.state === "ride") {
    const left = b.endX - b.x;
    b.v = Math.min(b.v + 0.12, BUS_SPEED, Math.max(1.2, left * 0.05));
    b.x += b.v; b.wheel += b.v / 20;
    if (left < 2) {
      b.x = b.endX; b.state = "stop"; b.t = 0; b.v = 0;
      p.riding = false; p.x = b.x + 170; p.y = GROUND - p.h; p.invuln = 90; p.facing = 1;
    }
  } else if (b.state === "stop") {
    if (++b.t > 100) b.state = "leave";
  } else if (b.state === "leave") {
    b.v = Math.min(b.v + 0.15, 9); b.x += b.v; b.wheel += b.v / 20;
    if (b.x - camX > W + 400) b.state = "gone";
  }
}

/* Micro del final: cuando Clarita se acerca, arranca y se va hacia la izquierda */
function updateEndBus() {
  const e = endBus;
  const pcx = player.x + player.w / 2;
  if (e.state === "park") {
    if (state === "play" && pcx > any.x - END_BUS_TRIGGER) { e.state = "leave"; e.v = 0; }
  } else if (e.state === "leave") {
    e.v = Math.min(e.v + 0.18, 10);
    e.x -= e.v; e.wheel -= e.v / 20;
    if (e.x - camX < -420) e.state = "gone";
  }
}

function updateSkate() {
  const p = player, pcx = p.x + p.w / 2;
  if (state !== "play" || p.hit > 0 || p.riding) return;
  if (!p.skate) {
    for (const b of boards) if (!b.got && !b.dropped && p.onGround && Math.abs(pcx - b.x) < 45) { b.got = true; p.skate = true; coinSound(); }
  } else {   // al acercarse al semáforo, deja la patineta en la vereda
    const nx = streets.find((s) => s.x + STREET_W > pcx);
    if (nx && nx.x - pcx < 230) { p.skate = false; boards.push({ x: pcx, got: false, dropped: true }); }
  }
}

/* ============================================================
   Autoelevador: se maneja con ← → ; Saltar deja la caja
   Las horquillas levantan solas la caja que tocan. Cerca de la escalera suben a la altura
   del hueco; con la caja alineada, Saltar la deja (fuera de la escalera, Saltar la apoya en el piso).
   ============================================================ */
const fkCrateLeft = (fk) => fk.x + fk.f * (FK_REACH + CRATE / 2) - CRATE / 2;   // borde izquierdo de la caja que lleva

function liftNextSlot() {   // el próximo hueco de la escalera (se llena desde el camión hacia afuera)
  for (const c of lift.cols) if (c.n < c.max) return { col: c, x: c.x, bottom: c.n * CRATE };
  return null;
}

function liftAligned() {
  const fk = lift.fk, sl = liftNextSlot();
  return !!(sl && fk.load && Math.abs(fkCrateLeft(fk) - sl.x) <= FK_TOL && Math.abs(fk.h - sl.bottom) <= 4);
}

function placeLiftCrate(sl) {
  const c = sl.col;
  c.n++;
  if (!c.solid) {
    c.solid = { kind: "cratestack", type: "block", n: 1, x: c.x, y: GROUND - CRATE, w: CRATE, h: CRATE };
    solids.push(c.solid);
  } else {
    c.solid.n = c.n; c.solid.y = GROUND - c.n * CRATE; c.solid.h = c.n * CRATE;
  }
  lift.fk.load = false;
  thudSound();
  for (let i = 0; i < 8; i++) spawnDust(c.x + CRATE / 2, GROUND - (c.n - 1) * CRATE, rand(-1.8, 1.8), rand(-1.4, -0.3));
  if (!liftNextSlot()) finishLift();
}

/* Suelta la caja en el piso (para poder dar la vuelta); no se puede sobre la escalera ni dentro de un bloque */
function dropLiftCrate(cl) {
  const fk = lift.fk;
  const stairL = lift.cols[lift.cols.length - 1].x;
  if (cl + CRATE > stairL - 6 && cl < lift.tx + 6) return;
  for (const s of solids) if (s.type === "block" && cl + CRATE > s.x && cl < s.x + s.w) return;
  lift.crates.push({ x: cl, got: false });
  fk.load = false; fk.noPick = 45;
  thudSound();
  for (let i = 0; i < 5; i++) spawnDust(cl + CRATE / 2, GROUND - 2, rand(-1.4, 1.4), rand(-1, -0.2));
}

/* Escalera completa: Clarita baja del autoelevador y salta al primer escalón */
function finishLift() {
  const p = player, fk = lift.fk, first = lift.cols[lift.cols.length - 1];
  fk.done = true; fk.v = 0;
  p.driving = false;
  p.x = first.x + CRATE / 2 - p.w / 2;
  p.y = GROUND - CRATE - p.h;
  p.vx = 0; p.vy = -5; p.onGround = false; p.facing = 1;
  coinSound();
  for (let i = 0; i < 10; i++) {
    const a = rand(0, PI2);
    particles.push({ kind: "star", x: p.x + p.w / 2, y: p.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, life: 1, size: rand(3, 5) });
  }
  showBanner("¡Escalera lista! Sube por las cajas y cruza el camión.");
}

function driveLift(p) {
  const fk = lift.fk;
  const live = state === "play";
  const dir = live ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  const act = jumpPressed && live;
  jumpPressed = false;

  fk.v += (dir * FK_SPEED - fk.v) * 0.14;
  if (Math.abs(fk.v) < 0.05) fk.v = 0;
  if (dir !== 0) fk.f = dir;   // siempre mira hacia donde avanza (la caja va delante)

  // ayuda para alinear: con la caja cerca del hueco y sin tocar nada, se acomoda sola
  const cl0 = fkCrateLeft(fk), sl0 = liftNextSlot();
  let assist = 0;
  if (fk.load && fk.f > 0 && dir === 0 && sl0 && Math.abs(fk.v) < 1.2 && Math.abs(sl0.x - cl0) < 44) assist = clamp(sl0.x - cl0, -1.1, 1.1);

  // avanzar y frenar contra el camión o las cajas ya apiladas
  const half = FK_W / 2;
  let nx = clamp(fk.x + fk.v + assist, lift.fkMin, lift.endX);
  if (nx !== fk.x + fk.v + assist) fk.v = 0;   // topó con el límite
  if (fk.v !== 0) {
    for (const s of solids) {
      if (s.type !== "block") continue;
      if (nx + half > s.x && nx - half < s.x + s.w) { nx = fk.v > 0 ? s.x - half : s.x + s.w + half; fk.v = 0; }
    }
  }
  const moved = nx - fk.x;
  fk.x = nx;
  fk.wheel += moved / 13;
  if (Math.abs(moved) > 1.5 && time % 5 === 0) spawnDust(fk.x - Math.sign(moved) * 40, GROUND - 2, -Math.sign(moved) * rand(0.3, 1), rand(-0.8, -0.2));

  // mástil: viaja alto; cerca del hueco sube o baja a la altura exacta
  const cl = fkCrateLeft(fk);
  const sl = liftNextSlot();
  let target = 0;
  if (fk.load) target = (sl && fk.f > 0 && Math.abs(cl - sl.x) < 240) ? sl.bottom : FK_CARRY;
  fk.h += clamp(target - fk.h, -FK_LIFT, FK_LIFT);

  // levantar la caja que tocan las horquillas
  if (fk.noPick > 0) fk.noPick--;
  if (!fk.load && live && fk.noPick <= 0 && fk.h < 10) {
    for (const c of lift.crates) {
      if (!c.got && Math.abs(c.x - cl) < 20) {
        c.got = true; fk.load = true;
        coinSound();
        for (let i = 0; i < 5; i++) spawnDust(c.x + CRATE / 2, GROUND - 4, rand(-1.4, 1.4), rand(-1, -0.2));
        break;
      }
    }
  }

  // Saltar: deja la caja en el hueco si está alineada; si no, la apoya en el piso
  if (act && fk.load) {
    if (liftAligned()) placeLiftCrate(sl);
    else dropLiftCrate(cl);
  }

  if (p.driving) {   // Clarita va sentada en el asiento
    p.x = fk.x - p.w / 2; p.y = GROUND - p.h - 20;
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = fk.f; p.idle = 0;
  }
}

/* Subirse al autoelevador al tocarlo; el mástil baja solo si está parado */
function updateLift() {
  if (!lift) return;
  const fk = lift.fk, p = player;
  if (p.driving) return;
  fk.v = 0;
  fk.h = Math.max(0, fk.h - FK_LIFT);
  const pcx = p.x + p.w / 2;
  if (state === "play" && !fk.done && p.hit <= 0 && !p.riding && p.onGround && p.y + p.h >= GROUND - 2 && Math.abs(pcx - fk.x) < 46) {
    p.driving = true; p.vx = 0; p.vy = 0; p.skate = false; p.facing = fk.f;
    coinSound();
    for (let i = 0; i < 6; i++) spawnDust(fk.x, GROUND - 2, rand(-1.5, 1.5), rand(-1, -0.2));
  }
}

/* ============================================================
   Excavadora: se maneja con ← → ; Saltar cava (en la zona de tierra) o suelta la tierra (en el hueco amarillo)
   ============================================================ */
const excBucketX = (e) => e.x + e.f * EX_REACH;   // dónde está la pala

function excNextSlot() {   // el próximo hueco de la montaña (se llena desde el muro hacia afuera)
  for (const c of exc.cols) if (c.n < c.max) return { col: c, x: c.x + SOIL_W / 2, bottom: c.n * SOIL };
  return null;
}
const excDigOK = () => !exc.load && Math.abs(excBucketX(exc) - exc.dzC) <= 62;
function excDumpOK() {
  const sl = excNextSlot();
  return !!(sl && exc.load && exc.f > 0 && Math.abs(excBucketX(exc) - sl.x) <= EX_TOL);
}

function excDirt(x, y, n) {
  for (let i = 0; i < n; i++) particles.push({ kind: "dirt", x: x + rand(-14, 14), y: y + rand(-6, 6), vx: rand(-1.6, 1.6), vy: rand(-2.6, -0.4), life: 1, size: rand(2, 4.2) });
}

function placeSoil(sl) {
  const c = sl.col;
  c.n++;
  if (!c.solid) {
    c.solid = { kind: "soilstack", type: "block", n: 1, x: c.x, y: GROUND - SOIL, w: SOIL_W, h: SOIL };
    solids.push(c.solid);
  } else {
    c.solid.n = c.n; c.solid.y = GROUND - c.n * SOIL; c.solid.h = c.n * SOIL;
  }
  exc.load = false;
  thudSound();
  excDirt(c.x + SOIL_W / 2, GROUND - c.n * SOIL, 12);
  if (!excNextSlot()) finishDig();
}

/* Montaña completa: Clarita baja de la excavadora y salta al primer escalón */
function finishDig() {
  const p = player, e = exc, first = e.cols[e.cols.length - 1];
  e.done = true; e.v = 0; e.anim = null; e.animT = 0; e.f = -1;   // la excavadora queda mirando hacia atrás
  p.driving = false;
  p.x = first.x + SOIL_W / 2 - p.w / 2;
  p.y = GROUND - SOIL - p.h;
  p.vx = 0; p.vy = -5; p.onGround = false; p.facing = 1;
  coinSound();
  for (let i = 0; i < 10; i++) {
    const a = rand(0, PI2);
    particles.push({ kind: "star", x: p.x + p.w / 2, y: p.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3 - 1, life: 1, size: rand(3, 5) });
  }
  showBanner("¡Montaña lista! Sube por la tierra y cruza el muro.");
}

function driveExc(p) {
  const e = exc;
  const live = state === "play";
  const dir = live ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
  const act = jumpPressed && live;
  jumpPressed = false;

  if (e.anim) {   // cavando o soltando: la máquina queda quieta
    e.animT++; e.v = 0;
    const S = excWrist(e);
    if (e.anim === "dig") {
      if (e.animT === 34) { e.load = true; e.holes++; thudSound(); excDirt(e.x + e.f * (S.x + 12), GROUND - 2, 10); }
    } else {
      if (e.animT >= 22 && e.animT < 38 && e.load && time % 2 === 0) excDirt(e.x + e.f * (S.x + 16), GROUND + S.y + 22, 2);
      if (e.animT === 28) { if (e.spill || !e.slot) { e.load = false; thudSound(); excDirt(e.x + e.f * (S.x + 16), GROUND - 4, 8); } else placeSoil(e.slot); }
    }
    if (exc.done) return;   // placeSoil terminó la montaña
    if (e.animT >= (e.anim === "dig" ? 60 : 56)) { e.anim = null; e.animT = 0; }
  } else {
    e.v += (dir * EX_SPEED - e.v) * 0.12;
    if (Math.abs(e.v) < 0.05) e.v = 0;
    if (dir !== 0) e.f = dir;

    // ayuda para alinear: con la pala cerca del lugar y sin tocar nada, se acomoda sola
    const bx = excBucketX(e), sl0 = excNextSlot();
    let assist = 0;
    if (dir === 0 && Math.abs(e.v) < 1.2) {
      if (e.load && e.f > 0 && sl0 && Math.abs(sl0.x - bx) < 44) assist = clamp(sl0.x - bx, -1.1, 1.1);
      else if (!e.load && Math.abs(e.dzC - bx) < 40) assist = clamp(e.dzC - bx, -1.1, 1.1);
    }

    // avanzar y frenar contra el muro o la tierra ya apilada
    let nx = clamp(e.x + e.v + assist, e.xMin, e.wx - EX_HALF - 4);
    if (nx !== e.x + e.v + assist) e.v = 0;
    if (e.v !== 0) {
      for (const s of solids) {
        if (s.type !== "block") continue;
        if (nx + EX_HALF > s.x && nx - EX_HALF < s.x + s.w) { nx = e.v > 0 ? s.x - EX_HALF : s.x + s.w + EX_HALF; e.v = 0; }
      }
    }
    const moved = nx - e.x;
    e.x = nx;
    e.track += moved / 9;
    if (Math.abs(moved) > 1.5 && time % 5 === 0) spawnDust(e.x - Math.sign(moved) * 60, GROUND - 2, -Math.sign(moved) * rand(0.3, 1), rand(-0.8, -0.2));

    // Saltar: cava si la pala está en la zona de tierra; con carga, suelta la tierra
    if (act) {
      if (!e.load) {
        if (excDigOK()) { e.anim = "dig"; e.animT = 0; e.spill = false; }
      } else {
        const ok = excDumpOK(), sl = excNextSlot();
        e.anim = "dump"; e.animT = 0; e.spill = !ok; e.slot = ok ? sl : null;
        e.dumpY = ok ? -(sl.bottom + SOIL + 40) : -100;
      }
    }
  }

  if (p.driving === "ex") {   // Clarita va sentada en la cabina
    p.x = e.x - p.w / 2; p.y = GROUND - p.h - 24;
    p.vx = 0; p.vy = 0; p.onGround = true; p.facing = e.f; p.idle = 0;
  }
}

/* Subirse a la excavadora al tocarla */
function updateExc() {
  if (!exc) return;
  const e = exc, p = player;
  if (p.driving) return;
  e.v = 0;
  const pcx = p.x + p.w / 2;
  if (state === "play" && !e.done && p.hit <= 0 && !p.riding && p.onGround && p.y + p.h >= GROUND - 2 && Math.abs(pcx - e.x) < 70) {
    p.driving = "ex"; p.vx = 0; p.vy = 0; p.skate = false; p.facing = e.f;
    coinSound();
    for (let i = 0; i < 6; i++) spawnDust(e.x, GROUND - 2, rand(-1.5, 1.5), rand(-1, -0.2));
  }
}

function update() {
  time++;
  const p = player;
  if (state === "play") elapsed++;
  if (bannerT > 0) bannerT--;
  if (shake > 0) shake--;
  if (flash > 0) flash = Math.max(0, flash - 0.04);
  if (state === "won") wonT++;

  for (const s of streets) { s.t++; updateCars(s); }

  if (p.hit > 0) tumble(p);
  else control(p);
  updateBus();
  updateEndBus();
  updateSkate();
  updateLift();
  updateExc();

  // Cámara: solo avanza hacia la derecha
  const cxp = p.x + p.w / 2;
  if (cxp > site.x - 200 && cxp < site.x + site.w + 60) {   // en la obra la cámara puede volver un poco
    const target = Math.max(site.x - 520, p.x - 300);
    camX = camX > target ? Math.max(target, camX - 6) : target;
  } else if (truck && cxp > truck.zoneA - 200 && cxp < truck.zoneB + 60) {   // camión de mudanza: se puede volver a buscar la caja roja
    const floor = Math.min(camX, truck.zoneA - 110);   // la cámara puede retroceder hasta ver la caja, pero nunca salta hacia adelante
    const target = Math.max(floor, p.x - 300);
    camX = camX > target ? Math.max(target, camX - 6) : target;
  } else if (lift && cxp > lift.zoneA - 200 && cxp < lift.zoneB + 60) {   // con el autoelevador también (hay que ir y venir)
    const target = Math.max(lift.zoneA - 210, p.x - 300);
    camX = camX > target ? Math.max(target, camX - 6) : target;
  } else if (exc && cxp > exc.zoneA - 200 && cxp < exc.zoneB + 60) {   // con la excavadora también (hay que ir y venir)
    const target = Math.max(exc.zoneA - 210, p.x - 300);
    camX = camX > target ? Math.max(target, camX - 6) : target;
  } else camX = Math.max(camX, p.x - 300);
  camX = Math.min(camX, WORLD_END - W);

  // Animación
  if (p.hit <= 0 && p.onGround && !p.skate) p.phase += Math.abs(p.vx) * 0.085;
  p.squash *= 0.82;
  p.airT += ((p.onGround ? 0 : 1) - p.airT) * 0.25;
  p.upT += ((p.vy < 0 ? 1 : 0) - p.upT) * 0.2;
  p.sitT += ((p.idle > 45 ? 1 : 0) - p.sitT) * 0.25;
  if (p.invuln > 0) p.invuln--;

  const nowWet = p.onGround && !p.riding && !p.driving && inPuddle(p.x + p.w / 2);
  if (nowWet && !wasInPuddle && Math.abs(p.vx) > 1) splashSound();
  wasInPuddle = nowWet;
  if (nowWet && Math.abs(p.vx) > 1.5 && time % 3 === 0) {
    for (let i = 0; i < 3; i++) particles.push({ kind: "splash", x: p.x + p.w / 2, y: p.y + p.h, vx: rand(-2.2, 2.2), vy: rand(-3.4, -1.2), life: 1, size: rand(1.5, 3.2) });
  }
  if (p.onGround && Math.abs(p.vx) > 3 && time % 6 === 0) {
    spawnDust(p.x + p.w / 2 - p.facing * 20, p.y + p.h, -p.facing * rand(0.3, 1), rand(-0.8, -0.2));
  }

  const pcx = p.x + p.w / 2;

  // Autos
  if (state === "play" && p.hit <= 0 && p.invuln <= 0 && !p.riding && !p.driving) {
    outer:
    for (const s of streets) {
      if (pcx < s.x - 200 || pcx > s.x + STREET_W + 200) continue;
      for (const c of s.cars) {
        const k = kf(c.y);
        if (Math.abs(c.y - GROUND) < 13 * k + 7 && Math.abs(c.x - pcx) < 44 * k + p.w / 2 - 8) {
          hitByCar(s);
          break outer;
        }
      }
    }
  }

  // Monedas
  if (state === "play") {
    const pcy = p.y + p.h / 2;
    for (const c of coins) {
      if (c.got) continue;
      const dx = c.x - pcx, dy = c.y - pcy;
      if (dx * dx + dy * dy < 30 * 30) {
        c.got = true;
        coinCount++;
        coinSound();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI2;
          particles.push({ kind: "gold", x: c.x, y: c.y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, life: 1, size: 3 });
        }
      }
    }
  }

  // Avance de cuadras
  const b = blockOf(pcx);
  if (state === "play" && b > blockIdx) {
    blockIdx = b;
    checkpoint = blockStart(b) + 70;
    checkpointCoins = coinCount;
    if (hearts < 3) hearts++;
    showBanner(BANNERS[b]);
  }

  // Any
  if (any.state === "ride") {
    any.x += any.speed;
    any.wheel += any.speed / 17;
    if (any.x >= FINISH_X + 60) { any.x = FINISH_X + 60; any.state = "stop"; }
  }

  // Llegada
  if (state === "play" && b === BLOCKS - 1 && Math.abs(pcx - any.x) < 70) {
    state = "won";
    wonT = 0;
    victorySound();
    window.dispatchEvent(new CustomEvent("nivel-ganado", { detail: { nivel: 4 } }));
    musicWanted = false; music.pause();   // para que se escuche la fanfarria
    any.state = "stop";
    const total = Math.round(elapsed / 60);
    if (coinCount > best) {
      best = coinCount;
      try { localStorage.setItem("clarita-best-4", String(best)); } catch (_) { /* ignorar */ }
    }
    void total;
  }
  if (state === "won" && time % 7 === 0) {
    const mx = (pcx + any.x) / 2;
    particles.push({ kind: "heart", x: mx + rand(-50, 50), y: GROUND - 60, vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.8), life: 1.4, size: rand(5, 9) });
  }

  if (state === "won" && wonT === GIVE_T) {   // Any recibe el regalo
    coinSound();
    for (let i = 0; i < 14; i++) particles.push({ kind: "star", x: any.x - 24 + rand(-18, 18), y: GROUND - 96 + rand(-18, 18), vx: rand(-1.6, 1.6), vy: rand(-2.4, -0.6), life: 1, size: rand(3, 5.5) });
  }

  updateHint(p);

  for (const q of particles) {
    q.x += q.vx; q.y += q.vy;
    if (q.kind === "dust") q.vy += 0.03;
    if (q.kind === "dirt") q.vy += 0.25;
    if (q.kind === "splash") q.vy += 0.22;
    if (q.kind === "star") q.vy += 0.12;
    q.life -= q.kind === "heart" ? 0.012 : 0.035;
  }
  particles = particles.filter((q) => q.life > 0);
}

/* ============================================================
   Dibujo: fondo
   ============================================================ */
const WALLS = ["#b9a690", "#a98a86", "#8aa59c", "#b3a674", "#8d8fb3", "#a98fa0", "#7f9ab0"];
const AWN = ["#e4572e", "#2e86ab", "#6a994e", "#8e5572", "#e8a317"];
const SHOPS = ["PANADERÍA", "KIOSCO", "ABRIGOS", "LIBRERÍA", "FARMACIA", "CHOCOLATE", "VETERINARIA", "CAFÉ", "LANAS", "JUGUETES"];

function cloud(x, y, s) {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 28], [52, 0, 22], [26, 6, 26]]) {
    circle(x + dx * s, y + dy * s, r * s);
    ctx.fill();
  }
}

function skyline(par, baseY, slot, minH, maxH, palette, alpha) {
  const off = camX * par;
  const j0 = Math.floor(off / slot) - 1;
  const j1 = Math.floor((off + W) / slot) + 1;
  for (let j = j0; j <= j1; j++) {
    const x = j * slot - off;
    const bw = slot * (0.66 + 0.3 * hash(j + par * 100));
    const bh = minH + hash(j * 3.1 + par * 50) * (maxH - minH);
    ctx.fillStyle = palette[Math.floor(hash(j * 1.7 + par * 9) * palette.length)];
    ctx.fillRect(x, baseY - bh, bw, bh + 40);
    ctx.fillStyle = "#f3f8fc"; ctx.fillRect(x - 2, baseY - bh - 4, bw + 4, 6);   // nieve en los techos
    ctx.fillStyle = palette[Math.floor(hash(j * 1.7 + par * 9) * palette.length)];
    ctx.fillStyle = alpha;
    for (let wy = baseY - bh + 12; wy < baseY - 14; wy += 20) {
      for (let wx = x + 9; wx < x + bw - 12; wx += 18) ctx.fillRect(wx, wy, 8, 10);
    }
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
  g.addColorStop(0, "#b4cfe6");
  g.addColorStop(1, "#eaf2f8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // sol pálido de invierno
  ctx.fillStyle = "rgba(255,248,225,0.35)"; circle(740, 96, 52); ctx.fill();
  ctx.fillStyle = "rgba(255,248,225,0.92)"; circle(740, 96, 28); ctx.fill();

  // nubes que el viento arrastra hacia la izquierda (más rápido en las ráfagas)
  const span = W + 420;
  for (let i = 0; i < 7; i++) {
    const x = (((i * 260 - camX * 0.04 - cloudOff) % span) + span) % span - 210;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.92)" : "rgba(222,234,246,0.92)";
    for (const [dx, dy, r] of [[0, 0, 30], [34, -12, 40], [76, 0, 32], [38, 10, 36]]) {
      const sc = 0.9 + (i % 3) * 0.25;
      circle(x + dx * sc, 40 + (i % 3) * 24 + dy * sc, r * sc); ctx.fill();
    }
  }

  skyline(0.12, 372, 90, 70, 160, ["#9fb3c8", "#a7b9cc", "#97abc1"], "rgba(255,240,190,0.35)");
  skyline(0.35, 380, 150, 120, 235, ["#8fa2b8", "#9aa8bc", "#869bb0", "#93a5b8", "#9aa5b5"], "rgba(255,236,170,0.4)");
}

function drawGround() {
  // vereda nevada
  ctx.fillStyle = "#dbe4ed";
  ctx.fillRect(0, 360, W, 124);
  ctx.fillStyle = "#c5d1de";
  ctx.fillRect(0, 372, W, 12);

  ctx.strokeStyle = "rgba(70,95,130,0.10)";
  ctx.lineWidth = 1;
  const off = ((camX % 70) + 70) % 70;
  for (let x = -off; x < W; x += 70) {
    ctx.beginPath(); ctx.moveTo(x, 384); ctx.lineTo(x, 484); ctx.stroke();
  }
  for (const y of [404, 428, 456]) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // montoncitos de nieve junto a las paredes
  const j0 = Math.floor(camX / 140) - 1;
  for (let j = j0; j < j0 + 9; j++) {
    const h = hash(j * 3.7), x = j * 140 - camX + h * 60;
    ctx.fillStyle = "#f6fafd";
    ctx.beginPath(); ctx.ellipse(x, 384, 40 + h * 30, 6 + h * 6, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  }

  // cordón y avenida del frente (con nieve derretida)
  ctx.fillStyle = "#aeb9c6";
  ctx.fillRect(0, 484, W, 10);
  ctx.fillStyle = "#f6fafd";
  ctx.fillRect(0, 484, W, 3);
  ctx.fillStyle = "#3b404c";
  ctx.fillRect(0, 494, W, H - 494);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const dOff = ((camX % 60) + 60) % 60;
  for (let x = -dOff; x < W; x += 60) ctx.fillRect(x, 518, 32, 3);
}

function drawFacade(x, id) {
  const wall = WALLS[Math.floor(hash(id) * WALLS.length)];
  const dark = shade(wall, -0.18);
  const top = 140 + Math.floor(hash(id + 7) * 80);

  ctx.fillStyle = wall;
  ctx.fillRect(x, top, UNIT, 380 - top);
  ctx.fillStyle = dark;
  ctx.fillRect(x - 3, top - 9, UNIT + 6, 11);
  ctx.fillRect(x, 372, UNIT, 8);
  ctx.fillStyle = "#f4f8fc";   // nieve sobre la cornisa
  roundRect(x - 5, top - 18, UNIT + 10, 11, 5); ctx.fill();

  // ventanas de los pisos altos
  for (let yy = top + 20; yy < 236; yy += 56) {
    for (let wx = x + 20; wx < x + UNIT - 40; wx += 62) {
      ctx.fillStyle = "#fffdf6";
      roundRect(wx - 3, yy - 3, 44, 40, 3); ctx.fill();
      ctx.fillStyle = hash(wx * 0.37 + yy) < 0.55 ? "#f6d98a" : "#6f8ea3";
      ctx.fillRect(wx, yy, 38, 34);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(wx + 3, yy + 3, 10, 28);
      ctx.fillStyle = dark;
      ctx.fillRect(wx + 18, yy, 2, 34);
    }
  }

  // cartel
  const name = SHOPS[Math.floor(hash(id + 3) * SHOPS.length)];
  ctx.fillStyle = "#fffaf0";
  roundRect(x + 22, 250, UNIT - 44, 24, 4); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#3a3340";
  ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, x + UNIT / 2, 263);

  // toldo rayado con flecos
  const ac = AWN[Math.floor(hash(id + 11) * AWN.length)];
  for (let i = 0; i < 9; i++) {
    const col = i % 2 ? "#fffaf0" : ac;
    ctx.fillStyle = col;
    ctx.fillRect(x + 10 + i * 21, 280, 21, 18);
    circle(x + 10 + i * 21 + 10.5, 298, 10.5); ctx.fill();
  }

  ctx.fillStyle = "#f4f8fc"; ctx.fillRect(x + 8, 276, 9 * 21 + 4, 5);   // nieve sobre el toldo

  // vidriera
  ctx.fillStyle = "#2f3b46";
  roundRect(x + 16, 312, 100, 60, 4); ctx.fill();
  ctx.fillStyle = "#f3dc9a";
  roundRect(x + 20, 316, 92, 52, 3); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath(); ctx.moveTo(x + 30, 316); ctx.lineTo(x + 52, 316); ctx.lineTo(x + 34, 368); ctx.lineTo(x + 20, 368); ctx.closePath(); ctx.fill();

  // puerta
  ctx.fillStyle = "#7b4a2b";
  roundRect(x + 132, 308, 52, 64, 4); ctx.fill();
  ctx.fillStyle = "#bfe3ee";
  roundRect(x + 138, 314, 40, 30, 3); ctx.fill();
  ctx.fillStyle = "#f3d27a";
  circle(x + 142, 352, 2.4); ctx.fill();
}

function drawFacades() {
  const ranges = [[WORLD_START, 0]];
  for (let b = 0; b < BLOCKS; b++) ranges.push([blockStart(b), blockStart(b) + BLOCK_LEN]);
  for (const [a, z] of ranges) {
    for (let wx = a; wx < z; wx += UNIT) {
      const sx = wx - camX;
      if (sx > W + 10 || sx + UNIT < -10) continue;
      drawFacade(sx, Math.floor((wx - WORLD_START) / UNIT));
    }
  }
}

function drawPlaza() {
  const x = FINISH_X - camX;
  if (x > W + 400 || x < -1200) return;

  // pasto
  ctx.fillStyle = "#4f8a4a";
  ctx.fillRect(x + 140, 372, WORLD_END, 112);
  ctx.fillStyle = "#6aae5b";
  for (let i = 0; i < 40; i++) ctx.fillRect(x + 160 + i * 36, 396 + (i % 4) * 22, 14, 3);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = ["#ff7a9a", "#ffd24a", "#ffffff"][i % 3];
    circle(x + 180 + i * 50, 410 + ((i * 37) % 60), 3); ctx.fill();
  }

  // arco de entrada
  const ax = x + 60;
  ctx.fillStyle = "#8a6a4a";
  ctx.fillRect(ax - 70, 290, 14, 108);
  ctx.fillRect(ax + 56, 290, 14, 108);
  ctx.fillStyle = "#e07b39";
  roundRect(ax - 82, 270, 164, 30, 8); ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.font = "bold 17px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("PLAZA", ax, 286);
  // banderines
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = ["#ff7a9a", "#ffd24a", "#2e86ab", "#6a994e"][i % 4];
    ctx.beginPath();
    ctx.moveTo(ax - 82 + i * 22, 300); ctx.lineTo(ax - 82 + i * 22 + 18, 300); ctx.lineTo(ax - 82 + i * 22 + 9, 316);
    ctx.closePath(); ctx.fill();
  }
}

/* ---------- Calles ---------- */
function drawStreetBase(s, closed = false) {
  const sx = s.x - camX;
  if (sx > W + 320 || sx + STREET_W < -320) return;
  const cx = sx + STREET_W / 2;
  const hw = (y) => (STREET_W / 2) * kf(y);
  const poly = () => {
    ctx.beginPath();
    ctx.moveTo(cx - hw(HORIZON), HORIZON); ctx.lineTo(cx + hw(HORIZON), HORIZON);
    ctx.lineTo(cx + hw(H), H); ctx.lineTo(cx - hw(H), H);
    ctx.closePath();
  };

  poly();
  ctx.fillStyle = "#2a2d37";
  ctx.fill();

  ctx.save();
  poly(); ctx.clip();

  if (!closed) {
    // paso peatonal (cebra)
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (let xx = sx - 24; xx < sx + STREET_W + 40; xx += 40) ctx.fillRect(xx, 414, 22, 52);
    // líneas de pare
    ctx.fillRect(cx - hw(406), 404, hw(406) - 3, 5);
    ctx.fillRect(cx + 3, 484, hw(486) - 3, 5);
  } else {
    // calle cerrada: franja de cuadros blanco y negro
    ctx.fillStyle = "#2b2d33"; ctx.fillRect(sx - 40, 470, STREET_W + 80, 14);
    ctx.fillStyle = "#f2f2f2";
    for (let xx = sx - 40, i = 0; xx < sx + STREET_W + 40; xx += 14, i++) ctx.fillRect(xx, i % 2 ? 477 : 470, 14, 7);
  }
  // línea central discontinua
  ctx.fillStyle = "#f2d45c";
  let y = 338;
  while (y < H) {
    const k = kf(y), len = 16 * k;
    ctx.fillRect(cx - 1.6 * k, y, 3.2 * k, len);
    y += len * 2.1;
  }
  ctx.restore();

  // bordes
  ctx.strokeStyle = "#8f897f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - hw(HORIZON), HORIZON); ctx.lineTo(cx - hw(H), H);
  ctx.moveTo(cx + hw(HORIZON), HORIZON); ctx.lineTo(cx + hw(H), H);
  ctx.stroke();
}

function drawLightDisc(x, y, r, color, on) {
  if (on) {
    ctx.fillStyle = color + "55";
    circle(x, y, r + 5); ctx.fill();
  }
  ctx.fillStyle = on ? color : shade(color, -0.75);
  circle(x, y, r); ctx.fill();
}

/* Semáforo de autos: rojo = frenan, verde = pasan */
function drawCarHead(x, y, L) {
  const yel = L.name === "clear";
  ctx.fillStyle = "#22252f";
  roundRect(x - 11, y, 22, 58, 6); ctx.fill();
  drawLightDisc(x, y + 14, 6.5, "#ff4338", !L.carsGo && !yel);
  drawLightDisc(x, y + 29, 6.5, "#ffc93c", yel);
  drawLightDisc(x, y + 44, 6.5, "#3ddc84", L.carsGo);
}

/* Semáforo de peatones: mano roja (esperar) / persona verde (cruzar) */
function drawPedLamp(x, y, walk, on, count) {
  ctx.fillStyle = "#101218"; roundRect(x - 12, y - 12, 24, 24, 4); ctx.fill();
  const col = on ? (walk ? "#3ddc84" : "#ff4338") : (walk ? "#1d3a2a" : "#4a1d1b");
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  if (count) {   // cuenta regresiva mientras titila
    ctx.fillStyle = "#ffb02e"; ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(count), x, y + 1);
  } else if (walk) {
    circle(x + 1, y - 7, 2.6); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 4); ctx.lineTo(x - 1, y + 2);
    ctx.moveTo(x - 1, y + 2); ctx.lineTo(x - 5, y + 9); ctx.moveTo(x - 1, y + 2); ctx.lineTo(x + 5, y + 8);
    ctx.moveTo(x, y - 3); ctx.lineTo(x - 5, y + 1); ctx.moveTo(x, y - 3); ctx.lineTo(x + 6, y - 1);
    ctx.stroke();
  } else {
    roundRect(x - 5, y - 2, 10, 10, 2); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(x - 4.5 + i * 3, y - 1); ctx.lineTo(x - 4.5 + i * 3, y - (i === 0 || i === 3 ? 7 : 9)); }
    ctx.stroke();
  }
}

function drawPole(x, near, s) {
  const base = 470, top = 318;
  const L = lightState(s);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(x, base + 2, 11, 3, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = "#4a4f5c";
  ctx.fillRect(x - 3, top, 6, base - top);

  // cabeza peatonal
  const blink = Math.floor(time / 9) % 2 === 0;
  const walkOn = L.ped === "green" || (L.ped === "flash" && blink);
  ctx.fillStyle = "#22252f";
  roundRect(x - 17, top + 6, 34, 58, 6); ctx.fill();
  drawPedLamp(x, top + 22, false, L.ped === "red", L.ped === "flash" ? Math.ceil(L.left / 60) : 0);
  drawPedLamp(x, top + 49, true, walkOn, 0);

  // semáforo de autos: en un brazo sobre la calle (poste izquierdo) y sobre el poste derecho
  if (near) {
    const cxs = s.cx - camX;
    ctx.fillStyle = "#4a4f5c";
    ctx.fillRect(x, top - 4, cxs - x, 5);
    drawCarHead(cxs, top - 2, L);
  } else {
    drawCarHead(x, top - 62, L);
  }
}

/* ---------- Obra: edificios en construcción ---------- */
function drawSkeleton(x, w) {
  const top = 90, ys = [GROUND, L1, L2, L3];
  ctx.fillStyle = "rgba(34,37,46,0.88)";
  ctx.fillRect(x, top, w, GROUND + 4 - top);
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 7; ctx.lineCap = "butt";
  for (let i = 0; i < 3; i++) {   // escaleras de fondo
    const a = i % 2 ? x + w - 50 : x + 50, b = i % 2 ? x + 50 : x + w - 50;
    ctx.beginPath(); ctx.moveTo(a, ys[i]); ctx.lineTo(b, ys[i + 1]); ctx.stroke();
  }
  for (const y of [L1, L2, L3, top]) {   // losas
    ctx.fillStyle = "#9a9ea6"; ctx.fillRect(x - 8, y + 4, w + 16, 12);
    ctx.fillStyle = "#6f737b"; ctx.fillRect(x - 8, y + 14, w + 16, 3);
  }
  for (let i = 0; i < 4; i++) {   // columnas y hierros
    const cx = x + i * (w - 14) / 3;
    ctx.fillStyle = "#848890"; ctx.fillRect(cx, top - 14, 14, GROUND + 18 - top);
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(cx + 2, top - 14, 3, GROUND + 18 - top);
    ctx.strokeStyle = "#5a5d63"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + 4, top - 14); ctx.lineTo(cx + 4, top - 30); ctx.moveTo(cx + 10, top - 14); ctx.lineTo(cx + 10, top - 26); ctx.stroke();
  }
}

function drawSiteBack() {
  const sx = site.x - camX;
  if (sx > W + 60 || sx + site.w < -60) return;
  drawStreetBase({ x: site.x + SITE.A1 }, true);
  drawSkeleton(sx + SITE.A0, SITE.A1 - SITE.A0);
  drawSkeleton(sx + SITE.B0, SITE.B1 - SITE.B0);
  // carteles de los tres pasos
  ctx.font = "bold 13px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [rx, txt] of [[40, "1. Sube por el andamio"], [650, "2. Cruza el puente"], [1262, "3. Baja a salvo"]]) {
    const w = ctx.measureText(txt).width + 18;
    ctx.fillStyle = "#ffc82e"; roundRect(sx + rx - w / 2, 330, w, 22, 5); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(txt, sx + rx, 341);
  }
}

/* ---------- Skatepark ---------- */
function drawParkBack() {
  const sx = park.x - camX;
  if (sx > W + 60 || sx + park.w < -60) return;
  ctx.fillStyle = "#b8a58d"; ctx.fillRect(sx, 170, park.w, 210);
  ctx.strokeStyle = "rgba(0,0,0,0.10)"; ctx.lineWidth = 2; ctx.beginPath();
  for (let y = 192; y < 380; y += 22) { ctx.moveTo(sx, y); ctx.lineTo(sx + park.w, y); }
  ctx.stroke();
  ctx.fillStyle = "#7e8791"; ctx.fillRect(sx, 164, park.w, 6);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 60px 'Trebuchet MS', sans-serif";
  ctx.font = "bold 50px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#4a90b8"; ctx.fillText("EL BARTO", sx + 330, 245);
  ctx.font = "bold 44px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#e4572e"; ctx.fillText("DINOSAURIOS", sx + 670, 315);
  ctx.font = "bold 60px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#4f9d5d"; ctx.fillText("¡GUAU!", sx + 1130, 250);
  ctx.font = "bold 28px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#1fa89a"; roundRect(sx + 50, 300, 130, 30, 6); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#fff6e4"; ctx.font = "bold 15px 'Trebuchet MS', sans-serif"; ctx.fillText("SKATEPARK", sx + 115, 315);
}

function drawBoardShape() {   // centrada en x=0 y apoyada en y=0
  ctx.fillStyle = "#1fa89a"; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  roundRect(-28, -12, 56, 6, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ff8a3d";
  for (const wx of [-18, 18]) { circle(wx, -4, 4.2); ctx.fill(); ctx.stroke(); }
}

function drawBoardItem(b) {
  const x = b.x - camX;
  if (x < -40 || x > W + 40) return;
  ctx.save(); ctx.translate(x, GROUND);
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(0, 1, 30, 4, 0, 0, PI2); ctx.fill();
  drawBoardShape();
  if (!b.dropped) {   // destello para que se note
    ctx.fillStyle = "#ffe066"; circle(0, -28 + Math.sin(time * 0.1) * 4, 4 + Math.sin(time * 0.2) * 1.5); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Autobús ---------- */
function drawBus() {
  const b = bus;
  if (b.state === "wait") {   // cartel de la parada
    const px = b.startX - 200 - camX;
    if (px > -40 && px < W + 40) {
      ctx.fillStyle = "#4a4f5c"; ctx.fillRect(px - 2, GROUND - 100, 4, 100);
      ctx.fillStyle = "#2e86ab"; roundRect(px - 24, GROUND - 134, 48, 34, 6); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#fff6e4"; ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("PARADA", px, GROUND - 123); ctx.fillText("BUS", px, GROUND - 109);
    }
  }
  drawBusSprite(b, false, 0);
}

/* Micro de la parada final (mira hacia la izquierda, un poquito más al fondo que la vereda) */
function drawEndBus() {
  if (endBus.state !== "gone") drawBusSprite(endBus, true, -8);
}

function drawBusSprite(b, flip, dy) {
  if (b.state === "gone") return;
  const moving = b.state === "ride" || b.state === "leave";
  const x = b.x - camX - 150, y = GROUND - 122 + (moving ? Math.sin(time * 0.5) : 0);
  if (x > W + 40 || x + 300 < -40) return;
  ctx.save();
  if (dy) ctx.translate(0, dy);
  if (flip) { ctx.translate(x + 150, 0); ctx.scale(-1, 1); ctx.translate(-(x + 150), 0); }
  // el texto no se espeja aunque el micro sí
  const busText = (t, tx, ty) => {
    if (!flip) { ctx.fillText(t, tx, ty); return; }
    ctx.save(); ctx.translate(tx, ty); ctx.scale(-1, 1); ctx.fillText(t, 0, 0); ctx.restore();
  };
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(x + 150, GROUND + 3, 150, 6, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = "#d9382b"; roundRect(x, y, 300, 108, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(x + 2, y + 64, 296, 26);
  ctx.fillStyle = "#17171c"; ctx.fillRect(x + 100, y + 3, 100, 10);
  ctx.fillStyle = "#ffd24a"; ctx.font = "bold 8px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  busText("LÍNEA OESTE", x + 150, y + 8.5);
  const wins = [[14, 56], [76, 56], [206, 40], [252, 34]];
  for (const [wx, ww] of wins) { ctx.fillStyle = "#bfe3ee"; roundRect(x + wx, y + 16, ww, 42, 5); ctx.fill(); ctx.stroke(); }
  if (!flip && player.riding) {   // Clarita asomada a la ventanilla
    ctx.save(); ctx.beginPath(); ctx.rect(x + 78, y + 18, 52, 38); ctx.clip();
    ctx.translate(x + 104, y + 48); ctx.scale(0.95, 0.95);
    drawDogHead(0, 0, 0.3, true, 0);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (const [wx] of wins) ctx.fillRect(x + wx + 5, y + 19, 8, 36);
  ctx.fillStyle = "#9fc3d1"; roundRect(x + 146, y + 16, 50, 70, 4); ctx.fill(); ctx.stroke();   // puerta
  ctx.beginPath(); ctx.moveTo(x + 171, y + 16); ctx.lineTo(x + 171, y + 86); ctx.stroke();
  ctx.fillStyle = "#fff6e4"; ctx.fillRect(x + 258, y + 70, 26, 16);
  ctx.fillStyle = INK; ctx.font = "bold 14px 'Trebuchet MS', sans-serif"; busText("14", x + 271, y + 79);
  ctx.fillStyle = "#fff6c4"; circle(x + 294, y + 92, 4); ctx.fill();
  ctx.fillStyle = "#ff3b30"; circle(x + 6, y + 92, 4); ctx.fill();
  for (const wx of [60, 240]) {   // ruedas
    ctx.fillStyle = "#1d1d22"; circle(x + wx, GROUND - 17, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#aab0b8"; circle(x + wx, GROUND - 17, 8); ctx.fill();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x + wx + Math.cos(b.wheel) * 8, GROUND - 17 + Math.sin(b.wheel) * 8); ctx.lineTo(x + wx - Math.cos(b.wheel) * 8, GROUND - 17 - Math.sin(b.wheel) * 8);
    ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  }
  ctx.restore();
}

/* ---------- Decorado y objetos ---------- */
function drawTree(x, v) {
  const base = 396;
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.beginPath(); ctx.ellipse(x, base + 2, 28, 5, 0, 0, PI2); ctx.fill();
  const sway = -gust * 0.07 + Math.sin(time * 0.05 + x * 0.013) * 0.012 * (1 + gust * 3);   // el viento los inclina hacia la izquierda
  ctx.save();
  ctx.translate(x, base); ctx.rotate(sway);
  ctx.fillStyle = "#6b4a2e";
  ctx.fillRect(-5, -34, 10, 34);
  const h = 70 + v * 24;
  for (let i = 0; i < 3; i++) {
    const w = 46 - i * 10, y0 = -26 - i * (h / 3.2), y1 = y0 - h / 2.5;
    ctx.fillStyle = i % 2 ? "#2c5f45" : "#35704f";
    ctx.beginPath(); ctx.moveTo(-w, y0); ctx.lineTo(w, y0); ctx.lineTo(0, y1); ctx.closePath(); ctx.fill();
    const yb = y1 + (y0 - y1) * 0.5;
    ctx.fillStyle = "#f4f8fc";   // nieve encima
    ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(w * 0.55, yb); ctx.lineTo(w * 0.25, yb - 5); ctx.lineTo(0, yb + 1); ctx.lineTo(-w * 0.25, yb - 5); ctx.lineTo(-w * 0.55, yb); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawLamp(x) {
  const base = 396;
  ctx.fillStyle = "#3b3f4c";
  ctx.fillRect(x - 3, base - 116, 6, 116);
  ctx.fillRect(x - 3, base - 118, 24, 5);
  const halo = ctx.createRadialGradient(x + 21, base - 106, 2, x + 21, base - 106, 70);
  halo.addColorStop(0, "rgba(255,226,140,0.55)"); halo.addColorStop(1, "rgba(255,226,140,0)");
  ctx.fillStyle = halo; ctx.fillRect(x - 50, base - 180, 140, 140);
  ctx.fillStyle = "#fff0b8";
  roundRect(x + 14, base - 114, 14, 8, 3); ctx.fill();
}

function drawDeco() {
  for (const d of deco) {
    const sx = d.x - camX;
    if (sx < -80 || sx > W + 80) continue;
    if (d.type === "tree") drawTree(sx, d.v);
    else drawLamp(sx);
  }
}

function drawTracks() {
  // huellas de bici en la vereda (desde la cuadra 2)
  ctx.fillStyle = "rgba(60,60,75,0.28)";
  const from = Math.max(blockStart(1), camX - 40);
  const to = Math.min(FINISH_X, camX + W + 40);
  for (let x = Math.floor(from / 34) * 34; x < to; x += 34) {
    if (streetAt(x + 8, true)) continue;
    ctx.fillRect(x - camX, GROUND + 12, 20, 3);
    ctx.fillRect(x - camX + 6, GROUND + 19, 20, 3);
  }
}

/* Caja de madera */
function drawCrate(x, y, s) {
  ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
  ctx.fillStyle = "#c58b4e";
  roundRect(x, y, s, s, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#d9a064";
  ctx.fillRect(x + 3, y + 3, s - 6, 6);
  ctx.strokeStyle = "#8f5f2f"; ctx.lineWidth = 3;
  ctx.strokeRect(x + 5, y + 5, s - 10, s - 10);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + s - 6, y + s - 6);
  ctx.moveTo(x + s - 6, y + 6); ctx.lineTo(x + 6, y + s - 6);
  ctx.stroke();
}

/* Camión de mudanza (la caja de carga y la cabina son bloques invisibles "truckhit") */
function drawTruck() {
  if (!truck) return;
  const x = truck.x - camX;
  if (x > W + 60 || x + TRUCK_CARGO_W + TRUCK_CAB_W < -60) return;
  const top = GROUND - TRUCK_H, cabTop = GROUND - CAB_H;
  const cx = x + TRUCK_CARGO_W;
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.lineJoin = "round";

  // sombra y chasis
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(x + 150, GROUND + 3, 162, 7, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = "#2a2d38";
  roundRect(x - 2, GROUND - 40, TRUCK_CARGO_W + TRUCK_CAB_W + 4, 12, 3); ctx.fill();

  // caja de carga
  ctx.fillStyle = "#f5f6f8";
  roundRect(x, top, TRUCK_CARGO_W, TRUCK_H - 36, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#c9d6e3"; ctx.fillRect(x + 2, top + 2, TRUCK_CARGO_W - 4, 8);
  ctx.fillStyle = "#9aa6b5"; ctx.fillRect(x + 2, GROUND - 48, TRUCK_CARGO_W - 4, 10);
  ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let xx = x + 24; xx < x + TRUCK_CARGO_W - 6; xx += 24) { ctx.moveTo(xx, top + 12); ctx.lineTo(xx, GROUND - 49); }
  ctx.stroke();
  ctx.strokeStyle = "#aeb7c4"; ctx.lineWidth = 1.5;   // puertas traseras
  ctx.beginPath(); ctx.moveTo(x + 8, top + 12); ctx.lineTo(x + 8, GROUND - 49); ctx.stroke();
  ctx.fillStyle = "#2f3138"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 29px 'Trebuchet MS', sans-serif";
  ctx.fillText("FLETES", x + TRUCK_CARGO_W / 2 + 4, top + 34);
  ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
  ctx.fillText("MUDANZAS", x + TRUCK_CARGO_W / 2 + 4, top + 66);

  // cabina
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
  ctx.fillStyle = "#3d4a78";
  roundRect(cx, cabTop, TRUCK_CAB_W, CAB_H - 36, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(cx + 4, cabTop + 3, TRUCK_CAB_W - 8, 5);
  ctx.fillStyle = "#bcd6ea";
  roundRect(cx + 10, cabTop + 12, 56, 34, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath(); ctx.moveTo(cx + 18, cabTop + 13); ctx.lineTo(cx + 32, cabTop + 13); ctx.lineTo(cx + 20, cabTop + 45); ctx.lineTo(cx + 12, cabTop + 45); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#232c4b"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx + 72, cabTop + 10); ctx.lineTo(cx + 72, GROUND - 40); ctx.stroke();   // puerta
  ctx.fillStyle = "#cfd5dd"; ctx.fillRect(cx + 62, cabTop + 50, 8, 3);                                   // manija
  ctx.fillStyle = "#fff3b0"; circle(cx + 94, GROUND - 66, 4); ctx.fill();                                // faro
  ctx.fillStyle = "#1c2238"; ctx.fillRect(cx + 86, GROUND - 58, 12, 14);                                 // parrilla
  ctx.fillStyle = "#aab0b8"; roundRect(cx + 86, GROUND - 44, 16, 9, 3); ctx.fill();                      // paragolpes

  // ruedas
  for (const wx of [x + 55, x + 245]) {
    ctx.fillStyle = "#1a1b20";
    ctx.beginPath(); ctx.arc(wx, GROUND - 17, 22, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.fillStyle = "#1d1d22"; circle(wx, GROUND - 17, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#aab0b8"; circle(wx, GROUND - 17, 8); ctx.fill();
    ctx.fillStyle = "#6c727c"; circle(wx, GROUND - 17, 3); ctx.fill();
  }
}

function drawSolid(s) {
  const x = s.x - camX;
  if (x > W + 80 || x + s.w < -80) return;
  const y = s.y;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;

  switch (s.kind) {
    case "digwall": {      // muro de obra cubierto de nieve
      ctx.fillStyle = "#8d949e"; ctx.fillRect(x, y, s.w, s.h); ctx.strokeRect(x, y, s.w, s.h);
      ctx.strokeStyle = "rgba(35,26,28,0.35)"; ctx.lineWidth = 1.2;
      for (let yy = y + 22, r = 0; yy < y + s.h; yy += 22, r++) {
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + s.w, yy); ctx.stroke();
        for (let xx = x + (r % 2 ? 20 : 42); xx < x + s.w; xx += 44) { ctx.beginPath(); ctx.moveTo(xx, yy - 22); ctx.lineTo(xx, yy); ctx.stroke(); }
      }
      // franja de advertencia
      ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 26, s.w - 2, 16); ctx.clip();
      ctx.fillStyle = "#ffc82e"; ctx.fillRect(x, y + 26, s.w, 16);
      ctx.fillStyle = INK;
      for (let xx = x - 20; xx < x + s.w + 20; xx += 24) { ctx.beginPath(); ctx.moveTo(xx, y + 42); ctx.lineTo(xx + 10, y + 26); ctx.lineTo(xx + 22, y + 26); ctx.lineTo(xx + 12, y + 42); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      // nieve encima y alguna estalactita de hielo
      ctx.fillStyle = "#f4f8fc"; roundRect(x - 4, y - 11, s.w + 8, 15, 6); ctx.fill();
      ctx.fillStyle = "#cfe6f5";
      for (let xx = x + 10; xx < x + s.w - 8; xx += 34) { ctx.beginPath(); ctx.moveTo(xx, y + 3); ctx.lineTo(xx + 6, y + 3); ctx.lineTo(xx + 3, y + 12 + (xx % 3) * 3); ctx.closePath(); ctx.fill(); }
      break;
    }
    case "soilstack": {    // montaña de tierra hecha con la excavadora
      for (let i = 0; i < s.n; i++) {
        const by = GROUND - (i + 1) * SOIL;
        ctx.fillStyle = i % 2 ? "#7a4e2d" : "#8a5a35";
        roundRect(x, by, s.w, SOIL, 10); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "rgba(35,26,28,0.25)";
        for (let k = 0; k < 7; k++) { const px = x + 8 + hash(k * 3.1 + i) * (s.w - 16), py = by + 8 + hash(k * 7.7 + i * 2) * (SOIL - 16); circle(px, py, 2 + hash(k + i) * 2.2); ctx.fill(); }
        if (i === s.n - 1) {   // un poco de nieve arriba
          ctx.fillStyle = "#f4f8fc"; roundRect(x + 4, by - 3, s.w - 8, 8, 4); ctx.fill();
        }
      }
      break;
    }
    case "cratestack": {   // pila de cajas junto al camión
      for (let i = 0; i < s.n; i++) drawCrate(x, GROUND - (i + 1) * CRATE, CRATE);
      break;
    }
    case "pushbox": {      // la caja roja: es la única que se empuja
      drawCrate(x, y, s.w);
      ctx.strokeStyle = "#e02424"; ctx.lineWidth = 3.5;
      ctx.strokeRect(x - 5, y - 5, s.w + 10, s.h + 10);
      if (!s.pushed) {     // flechita para que se note
        const bob = Math.sin(time * 0.12) * 3;
        ctx.fillStyle = "#e02424"; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + s.w / 2 - 8, y - 26 + bob); ctx.lineTo(x + s.w / 2 + 8, y - 26 + bob); ctx.lineTo(x + s.w / 2, y - 13 + bob);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case "cone": {
      ctx.fillStyle = "#c95f12";
      roundRect(x - 2, GROUND - 5, s.w + 4, 5, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ff7a1a";
      ctx.beginPath(); ctx.moveTo(x + 3, GROUND - 5); ctx.lineTo(x + s.w - 3, GROUND - 5); ctx.lineTo(x + s.w / 2, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath(); ctx.moveTo(x + 7, GROUND - 14); ctx.lineTo(x + s.w - 7, GROUND - 14); ctx.lineTo(x + s.w - 9, GROUND - 20); ctx.lineTo(x + 9, GROUND - 20); ctx.closePath(); ctx.fill();
      break;
    }
    case "bin": {
      ctx.fillStyle = "#5c8a74";
      roundRect(x + 1, y + 6, s.w - 2, s.h - 6, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#47705d";
      roundRect(x - 2, y, s.w + 4, 9, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * s.w / 4, y + 12); ctx.lineTo(x + i * s.w / 4, GROUND - 4); ctx.stroke(); }
      break;
    }
    case "hydrant": {
      ctx.fillStyle = "#d9382b";
      roundRect(x + 3, y + 8, s.w - 6, s.h - 8, 4); ctx.fill(); ctx.stroke();
      roundRect(x, GROUND - 7, s.w, 7, 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + s.w / 2, y + 8, s.w / 2 - 3, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundRect(x - 2, y + 14, 6, 8, 2); ctx.fill(); ctx.stroke();
      roundRect(x + s.w - 4, y + 14, 6, 8, 2); ctx.fill(); ctx.stroke();
      break;
    }
    case "crate": {
      ctx.fillStyle = "#c58b4e";
      roundRect(x, y, s.w, s.h, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#8f5f2f";
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + s.w - 5, y + s.h - 5);
      ctx.moveTo(x + s.w - 5, y + 5); ctx.lineTo(x + 5, y + s.h - 5);
      ctx.stroke();
      break;
    }
    case "planter": {
      // planta
      ctx.fillStyle = "#4f9d5d";
      for (const [dx, dy, r] of [[14, -4, 12], [31, -10, 15], [48, -3, 12]]) { circle(x + dx, y + dy, r); ctx.fill(); }
      ctx.fillStyle = "#ff7a9a";
      for (const [dx, dy] of [[18, -8], [34, -14], [46, -6], [28, -2]]) { circle(x + dx, y + dy, 3); ctx.fill(); }
      ctx.fillStyle = "#c4693a";
      roundRect(x, y + 8, s.w, s.h - 8, 5); ctx.fill(); ctx.stroke();
      break;
    }
    case "bench": {
      ctx.fillStyle = "#a36a38";
      roundRect(x + 4, y - 24, s.w - 8, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#3b3f4c";
      ctx.fillRect(x + 10, y + 6, 6, s.h - 6);
      ctx.fillRect(x + s.w - 16, y + 6, 6, s.h - 6);
      ctx.fillStyle = "#b57a43";
      roundRect(x, y, s.w, 9, 3); ctx.fill(); ctx.stroke();
      break;
    }
    case "ramp": {   // rampa de madera
      const top = GROUND - s.h;
      ctx.fillStyle = "#d9a15b"; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + s.w, top); ctx.lineTo(x + s.w, GROUND); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(120,70,20,0.35)"; ctx.lineWidth = 2; ctx.beginPath();
      for (const f of [0.3, 0.55, 0.8]) { ctx.moveTo(x + s.w * f, GROUND); ctx.lineTo(x + s.w * f, GROUND - s.h * f); }
      ctx.stroke();
      ctx.strokeStyle = "#8f98a3"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + s.w - 14, top + 4); ctx.lineTo(x + s.w + 2, top); ctx.stroke();
      break;
    }
    case "plank": {   // andamio con tablas de madera
      ctx.fillStyle = "#f2b01e";
      ctx.fillRect(x + 8, y + 10, 6, GROUND - y - 10);
      ctx.fillRect(x + s.w - 14, y + 10, 6, GROUND - y - 10);
      ctx.strokeStyle = "#c98a0a"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let yy = y + 10; yy + 44 <= GROUND; yy += 44) {
        ctx.moveTo(x + 14, yy); ctx.lineTo(x + s.w - 14, yy + 44);
        ctx.moveTo(x + s.w - 14, yy); ctx.lineTo(x + 14, yy + 44);
      }
      ctx.stroke();
      ctx.fillStyle = "#b9824b"; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      roundRect(x, y, s.w, 9, 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let xx = x + 22; xx < x + s.w - 6; xx += 24) { ctx.moveTo(xx, y + 1); ctx.lineTo(xx, y + 8); }
      ctx.stroke();
      break;
    }
    case "bridge": {   // puente de estructura (viga reticulada amarilla)
      const bot = y + s.h;
      ctx.strokeStyle = "#d98e0c"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, bot - 5);
      let up = true;
      for (let xx = x + 11; xx <= x + s.w + 0.1; xx += 11) { ctx.lineTo(xx, up ? y + 5 : bot - 5); up = !up; }
      ctx.stroke();
      ctx.fillStyle = "#f2b01e"; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.fillRect(x, y, s.w, 6); ctx.strokeRect(x, y, s.w, 6);
      ctx.fillRect(x, bot - 6, s.w, 6); ctx.strokeRect(x, bot - 6, s.w, 6);
      break;
    }
    case "wall": {   // valla de chapa que cierra la calle
      const mid = x + s.w / 2;
      ctx.fillStyle = "#7f93a6"; ctx.fillRect(x, y, s.w, s.h);
      ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let xx = x + 9; xx < x + s.w; xx += 9) { ctx.moveTo(xx, y + 4); ctx.lineTo(xx, GROUND); }
      ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, s.w, 16); ctx.clip();
      ctx.fillStyle = "#ffc82e"; ctx.fillRect(x, y, s.w, 16);
      ctx.fillStyle = INK;
      for (let xx = x - 16; xx < x + s.w + 16; xx += 24) {
        ctx.beginPath(); ctx.moveTo(xx, y + 16); ctx.lineTo(xx + 12, y + 16); ctx.lineTo(xx + 28, y); ctx.lineTo(xx + 16, y); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#d9382b"; roundRect(x + 8, y + 34, s.w - 16, 56, 5); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#fffaf0"; ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("CALLE", mid, y + 52); ctx.fillText("CERRADA", mid, y + 68);
      for (let i = 0; i < 2; i++) {   // barreras de hormigón al pie
        const bx = x + 2 + i * (s.w / 2);
        ctx.fillStyle = "#eceff1"; roundRect(bx, GROUND - 34, s.w / 2 - 4, 34, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#d9382b"; ctx.fillRect(bx + 6, GROUND - 24, s.w / 2 - 16, 8);
      }
      const on = Math.floor(time / 20) % 2 === 0;   // lámpara intermitente
      ctx.fillStyle = on ? "#ffb02e" : "#8a5a14"; circle(mid, y - 7, 6); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
      break;
    }
    case "stall": {
      // mesa con frutas
      ctx.fillStyle = "#8a6a4a";
      ctx.fillRect(x + 6, y + 8, 4, GROUND - y - 8);
      ctx.fillRect(x + s.w - 10, y + 8, 4, GROUND - y - 8);
      ctx.fillStyle = "#a36a38";
      roundRect(x + 14, GROUND - 28, s.w - 28, 28, 3); ctx.fill(); ctx.stroke();
      const fruit = ["#e4572e", "#f3b61f", "#6a994e", "#8e5572"];
      for (let i = 0; i < 9; i++) { ctx.fillStyle = fruit[i % 4]; circle(x + 28 + i * 13, GROUND - 32, 6); ctx.fill(); }
      // toldo (plataforma de un solo sentido)
      for (let i = 0; i * 22 < s.w; i++) {
        ctx.fillStyle = i % 2 ? s.c[1] : s.c[0];
        ctx.fillRect(x + i * 22, y, Math.min(22, s.w - i * 22), 12);
        circle(x + i * 22 + 11, y + 12, 11); ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.strokeRect(x, y, s.w, 12);
      break;
    }
  }
}

function drawCoin(c) {
  const sx = c.x - camX;
  if (sx < -20 || sx > W + 20) return;
  const bob = Math.sin(time * 0.08 + c.x * 0.05) * 3;
  const sq = Math.abs(Math.cos(time * 0.06 + c.x * 0.02));
  ctx.fillStyle = "#ffcf4a";
  ctx.beginPath(); ctx.ellipse(sx, c.y + bob, 9 * (0.35 + 0.65 * sq), 9, 0, 0, PI2); ctx.fill();
  ctx.strokeStyle = "#b87d12"; ctx.lineWidth = 2; ctx.stroke();
}

/* ---------- Camión varado, autoelevador y escalera ---------- */
function drawLiftTruck() {
  const x = lift.tx - camX;
  if (x > W + 120 || x + LT_CARGO_W + LT_CAB_W + 220 < -60) return;
  const cx = x + LT_CARGO_W, cab = LT_CAB_W, cabTop = GROUND - LT_CAB_H;
  const blink = Math.floor(time / 18) % 2 === 0;
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(x + (LT_CARGO_W + cab) / 2, GROUND + 3, 190, 7, 0, 0, PI2); ctx.fill();

  // carga: 3 filas de cajas sobre la plataforma
  for (let r = 0; r < 3; r++) for (let c = 0; c < LT_CARGO_W / CRATE; c++) drawCrate(x + c * CRATE, GROUND - LT_BED - (r + 1) * CRATE, CRATE);

  // cabina azul
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
  ctx.fillStyle = "#3b4a7a";
  roundRect(cx, cabTop, cab, LT_CAB_H - 34, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(cx + 4, cabTop + 3, cab - 8, 5);
  ctx.fillStyle = "#bcd6ea";
  roundRect(cx + 10, cabTop + 14, 58, 38, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath(); ctx.moveTo(cx + 18, cabTop + 15); ctx.lineTo(cx + 34, cabTop + 15); ctx.lineTo(cx + 22, cabTop + 51); ctx.lineTo(cx + 12, cabTop + 51); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#232c4b"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx + 74, cabTop + 10); ctx.lineTo(cx + 74, GROUND - 40); ctx.stroke();
  ctx.fillStyle = "#cfd5dd"; ctx.fillRect(cx + 63, cabTop + 58, 8, 3);
  ctx.fillStyle = "#fff3b0"; circle(cx + cab - 7, GROUND - 66, 4); ctx.fill();
  ctx.fillStyle = "#1c2238"; ctx.fillRect(cx + cab - 15, GROUND - 58, 12, 14);
  ctx.fillStyle = "#aab0b8"; roundRect(cx + cab - 14, GROUND - 42, 18, 9, 3); ctx.fill();

  // chasis, ruedas y plataforma
  ctx.fillStyle = "#2a2d38"; ctx.fillRect(x + 4, GROUND - 34, LT_CARGO_W + cab - 8, 10);
  for (const wx of [x + 40, x + 92, cx + 68]) {
    ctx.fillStyle = "#17181d";
    ctx.beginPath(); ctx.arc(wx, GROUND - 24, 26, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#1d1d22"; circle(wx, GROUND - 24, 24); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = "#aab0b8"; circle(wx, GROUND - 24, 11); ctx.fill();
    ctx.fillStyle = "#6c727c"; circle(wx, GROUND - 24, 4); ctx.fill();
  }
  ctx.fillStyle = "#2a2d38"; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
  roundRect(x - 2, GROUND - LT_BED, LT_CARGO_W + 4, 14, 3); ctx.fill(); ctx.stroke();

  // luces de emergencia
  ctx.fillStyle = blink ? "#ffb02e" : "#8a5a14"; circle(cx + 40, cabTop - 6, 5); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
  if (blink) { ctx.fillStyle = "rgba(255,176,46,0.25)"; circle(cx + 40, cabTop - 6, 13); ctx.fill(); }
  ctx.fillStyle = blink ? "#ff3b30" : "#8a1f19"; roundRect(x - 3, GROUND - LT_BED - 22, 5, 14, 2); ctx.fill();

  // conos y cartel: el tránsito está cortado
  const sx = cx + cab + 70;
  for (const dx of [24, 118]) drawSolid({ kind: "cone", x: cx + cab + dx, y: GROUND - 28, w: 24, h: 28 });
  ctx.fillStyle = "#4a4f5c"; ctx.fillRect(sx - 2, GROUND - 90, 4, 90);
  ctx.fillStyle = "#d9382b"; roundRect(sx - 60, GROUND - 124, 120, 38, 6); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#fffaf0"; ctx.font = "bold 10px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("CAMIÓN VARADO", sx, GROUND - 112); ctx.fillText("TRÁNSITO CORTADO", sx, GROUND - 98);
}

function drawLiftScene() {
  if (!lift) return;
  drawLiftTruck();
  const fk = lift.fk, p = player;
  const sl = liftNextSlot();

  // huecos de la escalera: el siguiente titila y se pone verde al alinear la caja
  if (sl) {
    const ok = liftAligned();
    const pulse = 0.55 + 0.45 * Math.sin(time * 0.15);
    ctx.save();
    ctx.setLineDash([6, 5]);
    for (const c of lift.cols) {
      for (let l = c.n; l < c.max; l++) {
        const gx = c.x - camX, gy = GROUND - (l + 1) * CRATE;
        if (gx > W + 60 || gx + CRATE < -60) continue;
        if (c === sl.col && l === c.n) {
          ctx.fillStyle = ok ? "rgba(61,220,132,0.28)" : "rgba(255,224,102,0.16)";
          ctx.fillRect(gx, gy, CRATE, CRATE);
          ctx.strokeStyle = ok ? "#3ddc84" : `rgba(255,224,102,${pulse})`;
          ctx.lineWidth = 3;
        } else { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; }
        ctx.strokeRect(gx + 1, gy + 1, CRATE - 2, CRATE - 2);
      }
    }
    ctx.restore();
  }

  // cajas sueltas
  const cl = fkCrateLeft(fk);
  let near = null;
  for (const c of lift.crates) {
    if (c.got) continue;
    const gx = c.x - camX;
    if (gx > W + 60 || gx + CRATE < -60) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(gx + CRATE / 2, GROUND + 2, 26, 4, 0, 0, PI2); ctx.fill();
    drawCrate(gx, GROUND - CRATE, CRATE);
    if (!near || Math.abs(c.x - cl) < Math.abs(near.x - cl)) near = c;
  }
  if (p.driving && !fk.load && near) {   // flechita sobre la caja más cercana
    const bob = Math.sin(time * 0.12) * 3, ax = near.x - camX + CRATE / 2;
    ctx.fillStyle = "#ffe066"; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ax - 8, GROUND - CRATE - 30 + bob); ctx.lineTo(ax + 8, GROUND - CRATE - 30 + bob); ctx.lineTo(ax, GROUND - CRATE - 16 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

/* Escena de la excavadora: agujero, zona de tierra y huecos de la montaña */
function drawDigScene() {
  if (!exc) return;
  const e = exc, p = player, drv = p.driving === "ex";
  const hx = e.dzC - camX;
  if (hx > -160 && hx < W + 160) {
    const n = e.holes;
    // tierra al descubierto y agujero que crece con cada palada
    ctx.fillStyle = "#7a5a3c";
    ctx.beginPath(); ctx.ellipse(hx, GROUND + 9, 64 + n * 6, 14 + n * 2, 0, 0, PI2); ctx.fill();
    if (n > 0) {
      ctx.fillStyle = "#2a1d14";
      ctx.beginPath(); ctx.ellipse(hx, GROUND + 10, 44 + n * 8, 8 + n * 4, 0, 0, PI2); ctx.fill();
    }
    if (drv && !e.load && !e.done) {   // marcador: dónde cavar
      const ok = excDigOK(), pulse = 0.55 + 0.45 * Math.sin(time * 0.15);
      ctx.save(); ctx.setLineDash([7, 5]); ctx.lineWidth = 3;
      ctx.strokeStyle = ok ? "#3ddc84" : `rgba(255,224,102,${pulse})`;
      ctx.beginPath(); ctx.ellipse(hx, GROUND + 9, 78, 20, 0, 0, PI2); ctx.stroke();
      ctx.restore();
      const bob = Math.sin(time * 0.12) * 3;
      ctx.fillStyle = "#ffe066"; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx - 9, GROUND - 40 + bob); ctx.lineTo(hx + 9, GROUND - 40 + bob); ctx.lineTo(hx, GROUND - 24 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // huecos de la montaña: el siguiente titila y se pone verde al alinear la pala
  const sl = excNextSlot();
  if (sl && drv && e.load) {
    const ok = excDumpOK(), pulse = 0.55 + 0.45 * Math.sin(time * 0.15);
    ctx.save(); ctx.setLineDash([6, 5]);
    for (const c of e.cols) {
      for (let l = c.n; l < c.max; l++) {
        const gx = c.x - camX, gy = GROUND - (l + 1) * SOIL;
        if (gx > W + 60 || gx + SOIL_W < -60) continue;
        if (c === sl.col && l === c.n) {
          ctx.fillStyle = ok ? "rgba(61,220,132,0.28)" : "rgba(255,224,102,0.16)";
          ctx.fillRect(gx, gy, SOIL_W, SOIL);
          ctx.strokeStyle = ok ? "#3ddc84" : `rgba(255,224,102,${pulse})`; ctx.lineWidth = 3;
        } else { ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; }
        ctx.strokeRect(gx + 1, gy + 1, SOIL_W - 2, SOIL - 2);
      }
    }
    ctx.restore();
  }
}

/* Cinemática de la pala: boom y brazo (2 segmentos) para que la muñeca llegue al punto pedido */
const EX_P0 = { x: 30, y: -52 }, EX_L1 = 100, EX_L2 = 78;
function excWrist(e) {   // posición de la muñeca (donde se une el balde) y ángulo del balde, según la animación
  const CARRY = -78, DIG = -22, X0 = EX_REACH - 20;
  let sx = X0, sy = CARRY, b = e.load ? -0.55 : 0.35;
  const t = e.animT;
  if (e.anim === "dig") {
    if (t < 18) { const k = t / 18; sy = lerp(CARRY, DIG, k); b = lerp(0.35, 0.9, k); }
    else if (t < 34) { const k = (t - 18) / 16; sy = DIG; sx = X0 - 30 * k; b = lerp(0.9, -0.55, k); }
    else { const k = (t - 34) / 26; sy = lerp(DIG, CARRY, k); sx = X0 - 30 * (1 - k); b = -0.55; }
  } else if (e.anim === "dump") {
    const top = e.dumpY;
    if (t < 20) { const k = t / 20; sy = lerp(CARRY, top, k); b = -0.55; }
    else if (t < 38) { const k = (t - 20) / 18; sy = top; b = lerp(-0.55, 1.25, k); }
    else { const k = (t - 38) / 18; sy = lerp(top, CARRY, k); b = lerp(1.25, 0.35, k); }
  }
  return { x: sx, y: sy, b };
}
function excArm(S) {
  const vx = S.x - EX_P0.x, vy = S.y - EX_P0.y;
  const d = clamp(Math.hypot(vx, vy), 24, EX_L1 + EX_L2 - 1);
  const a = Math.atan2(vy, vx);
  const A = Math.acos(clamp((EX_L1 * EX_L1 + d * d - EX_L2 * EX_L2) / (2 * EX_L1 * d), -1, 1));
  const th = a - A;   // codo hacia arriba
  const E = { x: EX_P0.x + EX_L1 * Math.cos(th), y: EX_P0.y + EX_L1 * Math.sin(th) };
  const a2 = Math.atan2(S.y - E.y, S.x - E.x);
  return { E, W: { x: E.x + EX_L2 * Math.cos(a2), y: E.y + EX_L2 * Math.sin(a2) } };
}

/* Excavadora amarilla (mira a la derecha; se espeja si va hacia la izquierda) */
function drawExcavator() {
  if (!exc) return;
  const e = exc, p = player, f = e.f;
  const x = e.x - camX;
  if (x < -240 || x > W + 240) return;
  const yel = "#f0b81c", yelD = "#d19a0c", dark = "#3b3f4c";

  ctx.save();
  ctx.translate(x, GROUND);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(0, 2, 92, 6, 0, 0, PI2); ctx.fill();
  ctx.scale(f, 1);
  ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.lineCap = "round";

  // orugas
  ctx.fillStyle = "#2b2e36"; roundRect(-74, -30, 148, 30, 15); ctx.fill(); ctx.stroke();
  for (const wx of [-50, -17, 17, 50]) {
    ctx.fillStyle = "#8f98a3"; circle(wx, -15, 9); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(wx + Math.cos(e.track) * 6, -15 + Math.sin(e.track) * 6); ctx.lineTo(wx - Math.cos(e.track) * 6, -15 - Math.sin(e.track) * 6); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  }
  // cuerpo giratorio y contrapeso
  ctx.fillStyle = yel; roundRect(-66, -54, 124, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = yelD; roundRect(-74, -66, 34, 40, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = yelD; ctx.fillRect(-60, -42, 100, 3);

  // cabina con Clarita adentro
  if (p.driving === "ex") { ctx.save(); ctx.translate(-14, -54); ctx.scale(0.56, 0.56); drawDogSit(); ctx.restore(); }
  ctx.fillStyle = "rgba(190,225,240,0.55)"; roundRect(-38, -102, 52, 50, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(-33, -97, 8, 38);
  ctx.fillStyle = yel; roundRect(-42, -108, 60, 9, 4); ctx.fill(); ctx.stroke();           // techo de la cabina
  ctx.fillStyle = "#f4f8fc"; roundRect(-40, -113, 56, 7, 3); ctx.fill();                    // nieve en el techo
  const on = Math.floor(time / 14) % 2 === 0;
  ctx.fillStyle = on ? "#ffb02e" : "#8a5a14"; circle(-28, -120, 4); ctx.fill(); ctx.stroke();   // baliza

  // pala: boom + brazo + balde
  const S = excWrist(e), A = excArm(S);
  limb([EX_P0, A.E], 15, yel);
  limb([A.E, A.W], 11, yel);
  ctx.fillStyle = yelD; circle(A.E.x, A.E.y, 5); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.translate(A.W.x, A.W.y); ctx.rotate(S.b);
  ctx.fillStyle = "#6b727d";
  ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(24, -10); ctx.lineTo(34, 6); ctx.lineTo(16, 24); ctx.lineTo(-6, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#c9ced6";   // dientes
  for (const [tx, ty] of [[26, -6], [31, 2], [28, 12]]) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 8, ty + 3); ctx.lineTo(tx, ty + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (e.load) {   // la tierra que lleva
    ctx.fillStyle = "#7a4e2d";
    ctx.beginPath(); ctx.ellipse(12, -8, 17, 10, -0.1, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#6c727c"; circle(0, 0, 4.5); ctx.fill(); ctx.stroke();
  ctx.restore();

  if (p.driving !== "ex" && !e.done) {   // flechita: "sube acá"
    const bob = Math.sin(time * 0.12) * 3;
    ctx.fillStyle = "#ffe066"; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-36, -146 + bob); ctx.lineTo(-20, -146 + bob); ctx.lineTo(-28, -132 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/* Autoelevador amarillo (mira a la derecha; se espeja si va hacia la izquierda) */
function drawForklift() {
  if (!lift) return;
  const fk = lift.fk, p = player, f = fk.f;
  const x = fk.x - camX;
  if (x < -170 || x > W + 170) return;
  const yel = "#f2b01e", yelD = "#d99c0b", dark = "#3b3f4c";

  ctx.save();
  ctx.translate(x, GROUND);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(10 * f, 2, 66, 5, 0, 0, PI2); ctx.fill();
  ctx.scale(f, 1);
  ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.lineCap = "round";

  const wheel = (wx, wy, r) => {
    ctx.fillStyle = "#1d1d22"; circle(wx, wy, r); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#aab0b8"; circle(wx, wy, r * 0.5); ctx.fill();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(wx + Math.cos(fk.wheel) * r * 0.5, wy + Math.sin(fk.wheel) * r * 0.5);
    ctx.lineTo(wx - Math.cos(fk.wheel) * r * 0.5, wy - Math.sin(fk.wheel) * r * 0.5);
    ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  };

  wheel(-27, -13, 13);
  ctx.fillStyle = yel; roundRect(-40, -44, 82, 30, 7); ctx.fill(); ctx.stroke();            // cuerpo
  ctx.fillStyle = yelD; ctx.fillRect(-34, -30, 70, 3);
  ctx.fillStyle = yelD; roundRect(-46, -52, 30, 40, 8); ctx.fill(); ctx.stroke();           // contrapeso
  ctx.fillStyle = dark; roundRect(-22, -52, 22, 9, 3); ctx.fill(); ctx.stroke();            // asiento
  ctx.fillStyle = "#fff6c4"; circle(40, -34, 3); ctx.fill();                                // faro

  if (p.driving) {   // Clarita al volante
    ctx.save(); ctx.translate(-6, -50); ctx.scale(0.62, 0.62); drawDogSit(); ctx.restore();
  }

  // jaula de seguridad y volante
  ctx.strokeStyle = dark; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-28, -46); ctx.lineTo(-28, -98); ctx.moveTo(10, -44); ctx.lineTo(12, -98); ctx.stroke();
  ctx.fillStyle = dark; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  roundRect(-34, -106, 52, 8, 3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, -44); ctx.lineTo(5, -62); ctx.stroke();
  ctx.fillStyle = "#222"; ctx.beginPath(); ctx.ellipse(4, -64, 3, 8, -0.3, 0, PI2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  const on = Math.floor(time / 14) % 2 === 0;
  ctx.fillStyle = on ? "#ffb02e" : "#8a5a14"; circle(-10, -112, 4); ctx.fill(); ctx.stroke();

  // mástil, carro y horquillas (suben y bajan con fk.h)
  ctx.fillStyle = "#8f98a3";
  roundRect(38, -152, 9, 140, 2); ctx.fill(); ctx.stroke();
  roundRect(47, -152, 5, 140, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#6c727c"; roundRect(50, -fk.h - 46, 7, 46, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#c9ced6"; roundRect(52, -fk.h - 5, 56, 5, 1.5); ctx.fill(); ctx.stroke();
  if (fk.load) drawCrate(FK_REACH, -fk.h - CRATE, CRATE);
  wheel(24, -16, 16);

  if (!p.driving && !fk.done) {   // flechita: "sube acá"
    const bob = Math.sin(time * 0.12) * 3;
    ctx.fillStyle = "#ffe066"; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-18, -134 + bob); ctx.lineTo(-2, -134 + bob); ctx.lineTo(-10, -120 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Autos ---------- */
function drawCar(c) {
  const k = kf(c.y);
  const x = c.x - camX, y = c.y;
  if (x < -150 || x > W + 150) return;
  const front = c.lane === 0;
  const w = 96 * k, h = 58 * k;

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(x, y + 1 * k, w * 0.56, 6 * k, 0, 0, PI2); ctx.fill();

  ctx.fillStyle = "#17171c";
  roundRect(x - w / 2 + 3 * k, y - 17 * k, 14 * k, 17 * k, 3 * k); ctx.fill();
  roundRect(x + w / 2 - 17 * k, y - 17 * k, 14 * k, 17 * k, 3 * k); ctx.fill();

  ctx.lineWidth = Math.max(1, 1.3 * k);
  ctx.strokeStyle = INK;
  ctx.fillStyle = c.color;
  roundRect(x - w / 2, y - h * 0.62, w, h * 0.46, 9 * k); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.cabin;
  roundRect(x - w * 0.35, y - h, w * 0.7, h * 0.5, 10 * k); ctx.fill(); ctx.stroke();
  ctx.fillStyle = front ? "#bfe6f5" : "#8fb2c2";
  roundRect(x - w * 0.29, y - h * 0.94, w * 0.58, h * 0.3, 6 * k); ctx.fill();

  if (front) {
    ctx.fillStyle = "#fff6c4";
    ctx.beginPath(); ctx.ellipse(x - w * 0.34, y - h * 0.4, 6 * k, 4 * k, 0, 0, PI2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.34, y - h * 0.4, 6 * k, 4 * k, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = "#2b2d36";
    roundRect(x - w * 0.16, y - h * 0.4, w * 0.32, h * 0.1, 2 * k); ctx.fill();
  } else {
    ctx.fillStyle = c.v < 0.4 ? "#ff3b30" : "#b3261e";
    roundRect(x - w / 2 + 4 * k, y - h * 0.52, 14 * k, 8 * k, 2 * k); ctx.fill();
    roundRect(x + w / 2 - 18 * k, y - h * 0.52, 14 * k, 8 * k, 2 * k); ctx.fill();
  }
  ctx.fillStyle = "#fffaf0";
  roundRect(x - w * 0.12, y - h * 0.26, w * 0.24, h * 0.1, 1.5 * k); ctx.fill();
}

/* ============================================================
   Dibujo: Clarita
   ============================================================ */
const DC = {
  tan: "#d98f4b", tanFar: "#a8692f",
  white: "#fcf8f1", whiteFar: "#d9d2c6",
  ear: "#e8b49b", nose: "#241a1e", tongue: "#ee7f93",
};
const S_DOG = 0.82;
const D_UP = 8.5, D_LOW = 8.5;

/* Ángulos de las cuatro patas: [delantera cercana, delantera lejana, trasera cercana, trasera lejana] */
function dogLegs(p) {
  const r = clamp(Math.abs(p.vx) / RUN_SPEED, 0, 1);
  const ph = p.phase;
  const offs = [0, 0.55, Math.PI + 0.15, Math.PI + 0.7];
  const ground = offs.map((o, i) => {
    const front = i < 2;
    const s = Math.sin(ph + o);
    const c = Math.max(0, Math.cos(ph + o - 0.3));
    return {
      t: lerp(0, front ? 0.15 + 0.9 * s : -0.05 + 0.85 * s, r),
      f: lerp(0, front ? 0.15 + 1.0 * c : 0.1 + 0.75 * c, r),
    };
  });
  const u = p.upT;
  const air = [
    { t: lerp(0.5, 1.15, u), f: lerp(0.35, 0.15, u) },
    { t: lerp(0.35, 0.95, u), f: lerp(0.4, 0.25, u) },
    { t: lerp(-0.45, -1.1, u), f: lerp(0.35, 0.2, u) },
    { t: lerp(-0.3, -0.9, u), f: lerp(0.4, 0.3, u) },
  ];
  return ground.map((g, i) => ({ t: lerp(g.t, air[i].t, p.airT), f: lerp(g.f, air[i].f, p.airT) }));
}

function drawDogLeg(root, leg, near) {
  const knee = reach(root, leg.t, D_UP);
  const ankle = reach(knee, leg.t - leg.f, D_LOW);
  limb([knee, ankle], 5.4, near ? DC.white : DC.whiteFar);
  limb([root, knee], 6.2, near ? DC.tan : DC.tanFar);
  ctx.fillStyle = near ? DC.white : DC.whiteFar;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(ankle.x + 1.6, ankle.y + 0.6, 4.4, 2.7, 0, 0, PI2); ctx.fill(); ctx.stroke();
}

function drawEar(bx, by, tx, ty, fill, inner) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(bx - 5, by);
  ctx.quadraticCurveTo((bx + tx) / 2 - 6, (by + ty) / 2, tx, ty);
  ctx.quadraticCurveTo((bx + tx) / 2 + 7, (by + ty) / 2 + 2, bx + 5, by);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (inner) {
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(bx - 2.5, by - 1);
    ctx.quadraticCurveTo((bx + tx) / 2 - 3, (by + ty) / 2 + 1, tx * 0.9 + bx * 0.1, ty * 0.9 + by * 0.1 + 4);
    ctx.quadraticCurveTo((bx + tx) / 2 + 4, (by + ty) / 2 + 3, bx + 3, by - 1);
    ctx.closePath(); ctx.fill();
  }
}

/* Cabeza de perfil: (hx, hy) es el centro del cráneo */
/* Bufanda en la boca de Clarita: un extremo cuelga y flamea con el viento (coordenadas de la cabeza) */
function drawScarfMouth() {
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const n = 7, amp = 2.5 + gust * 7;
  const pts = [];
  for (let i = 0; i <= n; i++) {   // la bufanda cuelga de la boca y flamea con el viento
    const t = i / n;
    pts.push({ x: 2 - t * 40, y: 3 + t * 8 + Math.sin(time * 0.3 - i * 0.9) * amp * t });
  }
  for (let i = 0; i < n; i++) limb([pts[i], pts[i + 1]], 8 - (i / n) * 2.5, i % 2 ? "#fff1d6" : "#d62839", INK, 1.6);
  const e = pts[n];   // flecos
  ctx.strokeStyle = "#d62839"; ctx.lineWidth = 1.6;
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(e.x - 2, e.y + k * 2.2); ctx.lineTo(e.x - 7, e.y + k * 3 + Math.sin(time * 0.4 + k) * 1.5); ctx.stroke(); }
  ctx.fillStyle = "#d62839"; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  circle(2, 3, 4); ctx.fill(); ctx.stroke();   // el nudo en la boca
  ctx.restore();
}

function drawDogHead(hx, hy, earBack, panting, tilt) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;

  // cuello blanco
  limb([{ x: -11, y: 17 }, { x: -2, y: 4 }], 11, DC.white);

  // oreja lejana
  drawEar(2, -7, 1 - earBack * 11, -21 + earBack * 4, DC.tanFar, null);

  // cráneo
  ctx.fillStyle = DC.tan;
  circle(0, 0, 8); ctx.fill(); ctx.stroke();

  // mejilla y hocico blancos
  ctx.fillStyle = DC.white;
  ctx.beginPath(); ctx.ellipse(-1.5, 3.6, 5, 4, 0, 0, PI2); ctx.fill();
  roundRect(3, -3.5, 12.5, 8.5, 4); ctx.fill(); ctx.stroke();
  // franja blanca entre los ojos
  ctx.strokeStyle = DC.white; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0.5, -7.6); ctx.lineTo(3.4, -3.8); ctx.stroke();

  // nariz y boca
  ctx.fillStyle = DC.nose;
  circle(15.2, -1.3, 2.3); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(6, 4.3); ctx.quadraticCurveTo(10, 5.6, 14, 3.4); ctx.stroke();
  if (panting) {
    ctx.fillStyle = DC.tongue;
    ctx.beginPath(); ctx.ellipse(11, 6.6 + Math.sin(time * 0.4) * 0.6, 2.4, 3.2, 0, 0, PI2); ctx.fill();
  }

  // ojo
  ctx.fillStyle = INK;
  circle(4.4, -3.6, 1.9); ctx.fill();
  ctx.fillStyle = "#fff";
  circle(5, -4.2, 0.6); ctx.fill();

  if (!(state === "won" && wonT >= GIVE_T)) drawScarfMouth();   // la bufanda va en la boca hasta entregársela a Any

  // oreja cercana
  ctx.lineWidth = 1.3; ctx.strokeStyle = INK;
  drawEar(-5, -6, -6 - earBack * 12, -23 + earBack * 5, DC.tan, DC.ear);

  ctx.restore();
}

function drawDogRun(p) {
  const legs = dogLegs(p);
  const r = clamp(Math.abs(p.vx) / RUN_SPEED, 0, 1);
  let lowest = 0;
  for (const l of legs) lowest = Math.max(lowest, Math.cos(l.t) * D_UP + Math.cos(l.t - l.f) * D_LOW);
  ctx.translate(0, -(lowest + 2.6));
  ctx.rotate(p.airT * lerp(0.2, -0.25, p.upT));
  if (p.pushing) ctx.rotate(0.07);   // se inclina hacia adelante

  const S = { x: 13, y: -1 }, Hp = { x: -16, y: -1 };

  // patas lejanas
  drawDogLeg(Hp, legs[3], false);
  drawDogLeg(S, legs[1], false);

  // cola
  const wag = Math.sin(time * 0.45) * 3 * (1 - r * 0.6);
  const run = r * (1 - p.airT * 0.3);
  const p0 = { x: -23, y: -12 };
  const p1 = { x: -31, y: -16 - 4 * run + wag * 0.5 };
  const p2 = { x: -37 - 3 * run, y: -24 - 3 * run + wag };
  const p3 = { x: -39 - 4 * run + wag * 0.3, y: -31 - 2 * run + wag * 0.6 };
  limb([p0, p1, p2], 7.5, DC.tan);
  limb([p2, p3], 6.8, DC.white);

  // cuerpo
  ctx.lineWidth = 1.3; ctx.strokeStyle = INK;
  ctx.fillStyle = DC.tan;
  roundRect(-25, -18, 46, 18, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DC.white;
  ctx.beginPath(); ctx.ellipse(-3, -3.2, 17, 3.4, 0, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -9, 8, 9, 0, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-12, -17, 3.5, 1.6, 0, 0, PI2); ctx.fill();

  // cabeza
  drawDogHead(27, -27, r * 0.9 + p.airT * 0.4, r > 0.3 || p.airT > 0.5, p.airT * lerp(-0.1, 0.1, p.upT) + (p.pushing ? 0.5 : 0));

  // patas cercanas
  drawDogLeg(Hp, legs[2], true);
  drawDogLeg(S, legs[0], true);
}

function drawDogSit() {
  const wagY = Math.sin(time * 0.5) * 4;

  // pata delantera lejana
  limb([{ x: 8, y: -3 }, { x: 8, y: -22 }], 5.4, DC.whiteFar);
  limb([{ x: 8, y: -13 }, { x: 8, y: -24 }], 6.2, DC.tanFar);

  // cola moviéndose
  limb([{ x: -19, y: -6 }, { x: -29, y: -4 + wagY * 0.3 }, { x: -37, y: -6 + wagY }], 7.5, DC.tan);
  limb([{ x: -37, y: -6 + wagY }, { x: -42, y: -8 + wagY * 1.1 }], 6.8, DC.white);

  // cuerpo inclinado
  limb([{ x: -12, y: -12 }, { x: 11, y: -30 }], 17, DC.tan);
  ctx.fillStyle = DC.white;
  circle(11, -26, 8.5); ctx.fill();

  // anca y pata trasera apoyada
  ctx.lineWidth = 1.3; ctx.strokeStyle = INK;
  ctx.fillStyle = DC.tan;
  ctx.beginPath(); ctx.ellipse(-12, -10, 11, 9.5, 0, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DC.white;
  ctx.beginPath(); ctx.ellipse(-3, -2.6, 8.5, 2.8, 0, 0, PI2); ctx.fill(); ctx.stroke();

  // cabeza
  drawDogHead(20, -45, 0.05, true, -0.05);

  // pata delantera cercana
  limb([{ x: 14, y: -3 }, { x: 14, y: -22 }], 5.4, DC.white);
  limb([{ x: 14, y: -13 }, { x: 14, y: -24 }], 6.2, DC.tan);
  ctx.fillStyle = DC.white; ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(15.5, -1.8, 4.4, 2.5, 0, 0, PI2); ctx.fill(); ctx.stroke();
}

function drawDog(p) {
  const cx = p.x + p.w / 2 - camX;
  const bottom = p.y + p.h;

  if (p.onGround && p.hit <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(cx, bottom + 2, 30, 4.5, 0, 0, PI2); ctx.fill();
  }
  if (p.invuln > 0 && Math.floor(time / 4) % 2 === 0) ctx.globalAlpha = 0.45;

  if (p.skate && p.hit <= 0) {   // patineta debajo de Clarita
    ctx.save(); ctx.translate(cx, bottom); ctx.rotate(p.facing * clamp(p.vy * 0.025, -0.3, 0.3)); ctx.scale(p.facing, 1);
    drawBoardShape(); ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, bottom - (p.skate && p.hit <= 0 ? 10 : 0));
  if (p.hit > 0) { ctx.translate(0, -14); ctx.rotate(p.rot); ctx.translate(0, 14); }
  ctx.scale(p.facing * S_DOG * (1 + p.squash * 0.5), S_DOG * (1 - p.squash * 0.5));
  if (p.sitT > 0.5 && p.onGround && p.hit <= 0 && !p.skate) drawDogSit();
  else drawDogRun(p);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ============================================================
   Dibujo: Any esperando el micro y la bufanda
   ============================================================ */
/* Paraguas abierto (cuando Clarita se lo entrega a Any) */
function drawOpenUmbrella(cx, cy, rx, ry, hand) {
  // varilla y mango
  limb([{ x: cx, y: cy }, { x: hand.x, y: hand.y + 12 }], 2.4, "#6b5a4a");
  ctx.strokeStyle = INK; ctx.lineWidth = 3.8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y + 12); ctx.arc(hand.x - 3.5, hand.y + 12, 3.5, 0, Math.PI * 0.95); ctx.stroke();
  ctx.strokeStyle = "#8a5a35"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(hand.x, hand.y + 12); ctx.arc(hand.x - 3.5, hand.y + 12, 3.5, 0, Math.PI * 0.95); ctx.stroke();
  // tela: media elipse con borde festoneado
  const n = 5, seg = (rx * 2) / n;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  for (let k = 0; k < n; k++) {
    const x0 = cx + rx - k * seg, x1 = x0 - seg;
    ctx.quadraticCurveTo((x0 + x1) / 2, cy + 11, x1, cy);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffcf4a"; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  // gajos alternados y varillas
  for (let k = 0; k < n; k++) {
    const x0 = cx - rx + k * seg;
    if (k % 2 === 0) {
      ctx.fillStyle = "#e4572e";
      ctx.beginPath(); ctx.moveTo(cx, cy - ry); ctx.lineTo(x0, cy); ctx.lineTo(x0 + seg, cy); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(35,26,28,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy - ry); ctx.lineTo(x0, cy); ctx.stroke();
  }
  ctx.fillStyle = INK; circle(cx, cy - ry - 2, 2.4); ctx.fill();
}

/* Bufanda de Any (coordenadas espejadas de Any): vuelta al cuello y una punta que flamea con el viento */
function drawAnyScarf(k) {
  const e = 0.25 + 0.75 * (1 - Math.pow(1 - k, 3));
  ctx.save();
  ctx.translate(3, -78); ctx.scale(e, e); ctx.translate(-3, 78);
  const sw = Math.sin(time * 0.3) * (2 + gust * 7);
  limb([{ x: 9, y: -77 }, { x: 13 + sw * 0.5, y: -66 }, { x: 14 + sw, y: -54 }], 7, "#d62839");       // la punta que cuelga
  limb([{ x: 13 + sw * 0.5, y: -69 }, { x: 14 + sw * 0.7, y: -62 }], 7.4, "#fff1d6", "rgba(0,0,0,0)", 0);
  limb([{ x: -6, y: -79 }, { x: 3, y: -76 }, { x: 10, y: -79 }], 8.5, "#d62839");                      // vuelta al cuello
  for (const xx of [-3, 2, 7]) limb([{ x: xx, y: -82 }, { x: xx + 1, y: -73 }], 2.4, "#fff1d6", "rgba(0,0,0,0)", 0);
  ctx.restore();
}

/* Cartel de la parada de micro donde espera Any */
function drawFinishStop() {
  const px = any.x + 80 - camX;
  if (px < -60 || px > W + 60) return;
  ctx.fillStyle = "#4a4f5c"; ctx.fillRect(px - 2, GROUND - 124, 4, 124);
  ctx.fillStyle = "#2e86ab"; roundRect(px - 28, GROUND - 160, 56, 40, 6); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#fff6e4"; ctx.font = "bold 11px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("PARADA", px, GROUND - 148); ctx.fillText("LÍNEA 14", px, GROUND - 132);
  // franja amarilla en el cordón
  ctx.fillStyle = "#f2d45c"; ctx.fillRect(px - 60, GROUND + 38, 120, 4);
}

function drawAny() {
  const x = any.x - camX;
  if (x < -160 || x > W + 160) return;
  const won = state === "won";
  const gave = won && wonT >= GIVE_T;   // ya recibió el regalo
  const near = won || Math.abs((player.x + player.w / 2) - any.x) < 420;   // ve venir a su perrito
  const hop = near && !gave ? Math.abs(Math.sin(time * 0.3)) * 5 : 0;      // saltito de alegría
  const shiver = near ? 0 : Math.sin(time * 0.9) * 0.6;   // tiembla de frío bajo la nieve

  ctx.save();
  ctx.translate(x, GROUND);

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(0, 2, 24, 4.5, 0, 0, PI2); ctx.fill();

  ctx.save();
  ctx.scale(-1, 1);          // mira hacia Clarita, que llega por la izquierda
  ctx.translate(shiver, -hop);

  const skin = "#e8b88e", jacket = "#8c52d9", jeans = "#3d5a9c";
  const hip = { x: 0, y: -44 }, sh = { x: 1, y: -78 };

  // piernas
  limb([hip, { x: -3, y: -22 }, { x: -6, y: -3 }], 6.6, "#324a82");
  limb([hip, { x: 3, y: -22 }, { x: 6, y: -3 }], 6.6, jeans);
  ctx.fillStyle = "#ff7a9a"; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(-3, -1.4, 5.6, 2.8, 0, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(10, -1.4, 5.6, 2.8, 0, 0, PI2); ctx.fill(); ctx.stroke();

  // torso con campera violeta
  limb([hip, sh], 15, jacket);
  limb([{ x: -4, y: -46 }, { x: 5, y: -46 }], 3, "#6d3fb0", "rgba(0,0,0,0)", 0);   // dobladillo

  // brazos
  if (gave) {   // se acomoda la bufanda
    const hand = { x: 12, y: -81 };
    const el = { x: 12, y: -70 };
    limb([{ x: 1, y: -74 }, el, hand], 5.4, jacket);
    ctx.fillStyle = skin; circle(hand.x, hand.y, 2.8); ctx.fill();
  } else if (won) {   // estira la mano para recibir el regalo de Clarita
    const hand = { x: 22, y: -64 };
    const el = { x: 12, y: -68 };
    limb([{ x: 1, y: -74 }, el, hand], 5.4, jacket);
    ctx.fillStyle = skin; circle(hand.x, hand.y, 2.8); ctx.fill();
  } else if (near) {   // ¡saluda con la mano!
    const hand = { x: 15 + Math.sin(time * 0.45) * 4, y: -101 };
    const el = { x: 10, y: -84 };
    limb([{ x: 1, y: -74 }, el, hand], 5.4, jacket);
    ctx.fillStyle = skin; circle(hand.x, hand.y, 2.8); ctx.fill();
  } else {     // esperando con los brazos cruzados
    limb([{ x: 1, y: -73 }, { x: 10, y: -62 }], 5.6, jacket);
    limb([{ x: 10, y: -62 }, { x: -4, y: -57 }], 5, jacket);
    ctx.fillStyle = skin; circle(-5, -57, 2.6); ctx.fill();
  }

  // capucha y cabeza
  const hx = 4, hy = -90;
  ctx.fillStyle = "#7a44c4"; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  circle(hx - 4, hy + 1, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = skin;
  circle(hx + 2, hy, 8.6); ctx.fill(); ctx.stroke();
  // flequillo mojado
  ctx.fillStyle = "#4a2c1d";
  ctx.beginPath(); ctx.arc(hx + 2, hy - 1, 9, Math.PI * 1.05, Math.PI * 1.85); ctx.lineTo(hx + 5, hy - 3); ctx.closePath(); ctx.fill();
  // borde de la capucha por delante
  ctx.strokeStyle = jacket; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(hx + 1, hy, 11.4, Math.PI * 1.15, Math.PI * 0.2, false); ctx.stroke();
  // cara
  ctx.fillStyle = INK; circle(hx + 7, hy + 0.5, 1.4); ctx.fill();
  ctx.strokeStyle = "#4a2c1d"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(hx + 4.6, hy - 3); ctx.lineTo(hx + 9, hy - (near ? 4.6 : 3.4)); ctx.stroke();
  ctx.strokeStyle = "#8a4a3a"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (near) { ctx.lineWidth = 1.7; ctx.arc(hx + 6.2, hy + 2.6, 3.4, 0.05, 2.7); }   // sonrisa grande
  else { ctx.moveTo(hx + 5, hy + 5.4); ctx.lineTo(hx + 8.4, hy + 5.2); }             // cara tranquila
  ctx.stroke();
  ctx.fillStyle = near ? "rgba(255,110,135,0.6)" : "rgba(255,120,140,0.35)"; circle(hx + 3, hy + 4, near ? 3.2 : 2.4); ctx.fill();
  if (gave) drawAnyScarf(Math.min(1, (wonT - GIVE_T) / 14));   // se pone la bufanda

  ctx.restore();

  // nombre
  ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
  const label = "Any";
  const tw = ctx.measureText(label).width + 18;
  ctx.fillStyle = "rgba(20,24,40,0.78)";
  roundRect(-tw / 2, -134, tw, 22, 11); ctx.fill();
  ctx.fillStyle = "#fff6e4"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, 0, -123);

  ctx.restore();
}

function drawParticles() {
  for (const q of particles) {
    const x = q.x - camX;
    ctx.globalAlpha = clamp(q.life, 0, 1);
    if (q.kind === "heart") heart(x, q.y, q.size, "#ff5c85");
    else if (q.kind === "star") { ctx.fillStyle = "#ffe066"; circle(x, q.y, q.size * clamp(q.life, 0.2, 1)); ctx.fill(); }
    else {
      ctx.fillStyle = q.kind === "gold" ? "#ffcf4a" : q.kind === "dirt" ? "#7a4e2d" : "#f2f8ff";
      circle(x, q.y, q.size * q.life + 0.5); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBubble(text, cx, cy, color) {
  ctx.font = "bold 15px 'Trebuchet MS', 'Segoe UI', sans-serif";
  const w = ctx.measureText(text).width + 26;
  const x = clamp(cx - w / 2, 8, W - w - 8);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(x, cy - 34, w, 28, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy - 7); ctx.lineTo(cx, cy + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color || "#b3261e";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, cy - 19);
}

function drawHUD() {
  const p = player;

  // monedas
  ctx.fillStyle = "rgba(20,24,40,0.55)";
  roundRect(14, 12, 128, 34, 12); ctx.fill();
  ctx.fillStyle = "#ffcf4a"; circle(34, 29, 9); ctx.fill();
  ctx.strokeStyle = "#b87d12"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#fff6e4";
  ctx.font = "bold 18px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(`${coinCount} / ${totalCoins}`, 52, 30);

  // corazones
  for (let i = 0; i < 3; i++) heart(32 + i * 30, 66, 10, i < hearts ? "#ff5c85" : "rgba(255,255,255,0.28)");

  // cuadra y semáforo que viene
  const pcx = p.x + p.w / 2;
  const next = streets.find((s) => s.x + STREET_W > pcx && s.x - pcx < 1300);
  ctx.fillStyle = "rgba(20,24,40,0.55)";
  roundRect(W / 2 - 150, 12, 300, 38, 14); ctx.fill();
  ctx.font = "bold 15px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff6e4";
  const siteNow = pcx > site.x && pcx < site.x + site.w;
  const siteAhead = site.x + site.w > pcx && site.x - pcx < 1300;
  const truckNow = !!truck && pcx > truck.zoneA && pcx < truck.zoneB;
  const truckAhead = !!truck && truck.zoneB > pcx && truck.zoneA - pcx < 1300;
  const liftNow = !!lift && pcx > lift.zoneA && pcx < lift.zoneB;
  const liftAhead = !!lift && lift.zoneB > pcx && lift.zoneA - pcx < 1300;
  const excNow = !!exc && pcx > exc.zoneA && pcx < exc.zoneB;
  const excAhead = !!exc && exc.zoneB > pcx && exc.zoneA - pcx < 1300;
  if (p.riding) {
    ctx.fillStyle = "#e4572e"; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4";
    const left = Math.max(1, BUS_FIRST + BUS_BLOCKS - blockOf(pcx));
    ctx.fillText(`En bus: faltan ${left} cuadra${left > 1 ? "s" : ""}`, W / 2 - 108, 32);
  } else if (p.skate) {
    ctx.fillStyle = "#1fa89a"; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4"; ctx.fillText("¡En patineta! Salta las rampas", W / 2 - 108, 32);
  } else if (siteNow || (siteAhead && (!next || site.x < next.x))) {
    ctx.fillStyle = "#ffb02e"; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4";
    ctx.fillText(siteNow ? "¡Obra! Sube, cruza y baja" : "Adelante: calle en obra", W / 2 - 108, 32);
  } else if (truckNow || (truckAhead && (!next || truck.zoneA < next.x))) {
    ctx.fillStyle = "#e02424"; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4";
    ctx.fillText(truckNow ? "¡Mudanza! Empuja la caja roja" : "Adelante: camión de mudanza", W / 2 - 108, 32);
  } else if (liftNow || (liftAhead && (!next || lift.zoneA < next.x))) {
    ctx.fillStyle = "#f2b01e"; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4";
    const placed = lift.cols.reduce((a, c) => a + c.n, 0), need = lift.cols.reduce((a, c) => a + c.max, 0);
    ctx.fillText(!liftNow ? "Adelante: camión varado" : lift.fk.done ? "¡Escalera lista! Sube" : `Autoelevador: ${placed} de ${need} cajas`, W / 2 - 108, 32);
  } else if (excNow || (excAhead && (!next || exc.zoneA < next.x))) {
    ctx.fillStyle = "#f0b81c"; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4";
    const placed = exc.cols.reduce((a, c) => a + c.n, 0), need = exc.cols.reduce((a, c) => a + c.max, 0);
    ctx.fillText(!excNow ? "Adelante: muro enorme" : exc.done ? "¡Montaña lista! Sube" : `Excavadora: ${placed} de ${need} paladas`, W / 2 - 108, 32);
  } else if (next) {
    const L = lightState(next);
    const inside = pcx > next.x && pcx < next.x + STREET_W;
    const blink = Math.floor(time / 9) % 2 === 0;
    const col = L.ped === "red" ? "#ff4338" : (L.ped === "green" || blink ? "#3ddc84" : "#1f3d2b");
    ctx.fillStyle = col; circle(W / 2 - 128, 31, 9); ctx.fill();
    ctx.fillStyle = "#fff6e4";
    let msg;
    if (inside) msg = L.ped === "green" ? "¡Cruza, Clarita!" : "¡Corre, ya casi!";
    else if (L.ped === "green") msg = "Verde: ¡puedes cruzar!";
    else if (L.ped === "flash") msg = "Titila: ¡no cruces!";
    else msg = `Autos pasando: cruza en ${Math.ceil(framesUntilGreen(next) / 60)} s`;
    ctx.fillText(msg, W / 2 - 108, 32);
  } else {
    ctx.textAlign = "center";
    ctx.fillText(blockIdx === BLOCKS - 1 ? "¡Llega a la parada!" : `Cuadra ${blockIdx + 1} de ${BLOCKS}`, W / 2, 32);
  }

  // progreso
  const px0 = W - 250, px1 = W - 36;
  ctx.fillStyle = "rgba(20,24,40,0.55)";
  roundRect(px0 - 22, 12, px1 - px0 + 52, 38, 14); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(px0, 31); ctx.lineTo(px1, 31); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 1; i < BLOCKS; i++) {
    const tx = lerp(px0, px1, blockStart(i) / FINISH_X);
    ctx.beginPath(); ctx.moveTo(tx, 25); ctx.lineTo(tx, 37); ctx.stroke();
  }
  const mx = lerp(px0, px1, clamp(pcx / FINISH_X, 0, 1));
  ctx.fillStyle = DC.tan; circle(mx, 31, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#1fa89a"; circle(px1 + 12, 31, 6); ctx.fill();
  ctx.strokeStyle = INK; ctx.stroke();

  // aviso de Any fuera de pantalla
  if (state === "play" && any.x - camX > W - 10 && blockIdx === BLOCKS - 1) {
    ctx.fillStyle = "rgba(20,24,40,0.7)";
    roundRect(W - 86, H / 2 - 40, 80, 30, 12); ctx.fill();
    ctx.fillStyle = "#fff6e4"; ctx.textAlign = "center";
    ctx.fillText("Any ▶", W - 46, H / 2 - 24);
  }

  // cartel de cuadra
  if (bannerT > 0 && state !== "start") {
    const a = clamp(bannerT / 40, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = "bold 17px 'Trebuchet MS', 'Segoe UI', sans-serif";
    const w = ctx.measureText(bannerText).width + 40;
    ctx.fillStyle = "rgba(20,24,40,0.72)";
    roundRect(W / 2 - w / 2, 62, w, 36, 14); ctx.fill();
    ctx.fillStyle = "#fff6e4"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(bannerText, W / 2, 80);
    ctx.globalAlpha = 1;
  }
}

function drawOverlay(title, lines, tint) {
  ctx.fillStyle = tint || "rgba(20,24,40,0.62)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff6e4";
  ctx.font = "bold 50px 'Trebuchet MS', 'Segoe UI', sans-serif";
  ctx.fillText(title, W / 2, H / 2 - 90);
  ctx.font = "19px 'Trebuchet MS', 'Segoe UI', sans-serif";
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? "#ffcf4a" : "#efe3cd";
    ctx.fillText(l, W / 2, H / 2 - 30 + i * 30);
  });
}

function fmtTime(frames) {
  const s = Math.round(frames / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-4, 4), rand(-3, 3));

  drawBackground();
  drawGround();
  drawFacades();
  drawPuddles();
  drawSiteBack();
  drawParkBack();
  drawPlaza();
  for (const s of streets) drawStreetBase(s);
  drawDeco();

  // objetos y monedas
  drawTruck();
  drawLiftScene();
  drawDigScene();
  for (const s of solids) drawSolid(s);
  for (const c of coins) if (!c.got) drawCoin(c);
  for (const b of boards) if (!b.got) drawBoardItem(b);

  // autos lejanos, personajes, postes y autos cercanos (orden por profundidad)
  const allCars = [];
  for (const s of streets) for (const c of s.cars) allCars.push(c);
  allCars.sort((a, b) => a.y - b.y);
  for (const c of allCars) if (c.y <= GROUND) drawCar(c);

  drawBus();
  drawEndBus();
  drawFinishStop();
  drawAny();
  drawForklift();
  drawExcavator();
  if (!player.riding && !player.driving) drawDog(player);

  for (const s of streets) {
    const sx = s.x - camX;
    if (sx > W + 80 || sx + STREET_W < -80) continue;
    drawPole(sx - 26, true, s);
    drawPole(sx + STREET_W + 26, false, s);
  }
  for (const c of allCars) if (c.y > GROUND) drawCar(c);

  drawParticles();

  // globo de ayuda sobre Clarita
  const p = player;
  if (state === "play" && p.hint && p.hit <= 0) {
    drawBubble(p.hint, p.x + p.w / 2 - camX, p.driving ? GROUND - (p.driving === "ex" ? 132 : 112) : p.y - 28, (p.hintGood || p.hint.startsWith("¡Verde")) ? "#1c8a4d" : "#b3261e");
  }
  ctx.restore();

  drawStormOverlay();

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,60,60,${flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state !== "start") drawHUD();

  if (state === "start" && introReady()) {
    ctx.drawImage(introImg, 0, 0, W, H);
    ctx.fillStyle = "rgba(10,14,28,0.7)"; ctx.fillRect(0, H - 26, W, 26);
    ctx.fillStyle = "#fff6e4"; ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Mover: ← →   Saltar: Espacio   M: música   |   Espera el verde para cruzar   |   Espacio, Enter o toca para empezar", W / 2, H - 13);
  } else if (state === "start") {
    drawOverlay("Nivel 4: Invierno", [
      "Any tiene mucho frío y espera el micro en la nieve. ¡Clarita le lleva la bufanda en la boca!",
      `Recorre ${BLOCKS} cuadras con nieve y MUCHO viento: las ráfagas te empujan hacia atrás y el hielo resbala.`,
      "Si una calle está en obra: sube por el edificio, cruza el puente y baja.",
      "Si un camión de mudanza tapa la vereda: empuja la caja roja con la cabeza y sube por las cajas.",
      "Si un camión varado corta el tránsito: maneja el autoelevador y arma una escalera de cajas.",
      "Si un muro enorme corta la vereda: maneja la excavadora, cava tierra y arma una montaña junto al muro.",
      "En la parada hay un bus: camina hasta él y viaja 3 cuadras. En el skatepark busca la patineta.",
      "Mover: ← →   Saltar: Espacio   (en la calle no se salta)",
      "Pulsa Espacio, Enter o toca la pantalla para empezar",
    ]);
  } else if (state === "over") {
    drawOverlay("¡Ay, Clarita!", [
      "Los autos no frenan en rojo. Siempre espera el verde.",
      `Vuelves a empezar la cuadra ${blockIdx + 1}.`,
      "Pulsa Enter o Espacio para reintentar",
    ]);
  } else if (state === "won" && wonT > 120) {
    drawOverlay("¡Clarita le llevó la bufanda a Any!", [
      `Moneditas: ${coinCount} de ${totalCoins}   (récord: ${best})`,
      `Tiempo: ${fmtTime(elapsed)}   Corazones: ${hearts} de 3`,
      "Pulsa Enter o Espacio para ver el final",
    ], "rgba(30,50,90,0.45)");
  }
}

/* ============================================================
   Bucle principal (60 FPS fijos)
   ============================================================ */
initWorld();

let last = performance.now();
let acc = 0;
const STEP = 1000 / 60;

function loop(now) {
  if (!__alive) return;
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP) {
    updateRain();
    if (state !== "over") update();
    acc -= STEP;
  }
  draw();
  __raf = requestAnimationFrame(loop);
}
__raf = requestAnimationFrame(loop);


/* --- Limpieza: el menú llama a esto antes de cargar otro nivel --- */
window.__nivelActual = {
  id: 4,
  destroy() {
    __alive = false;
    cancelAnimationFrame(__raf);
    for (const [t, ty, fn, o] of __listeners) t.removeEventListener(ty, fn, o);
    __listeners.length = 0;
    musicWanted = false; music.pause();
    stopRainSound();
    try { if (audioCtx) audioCtx.close(); } catch (_) {}
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  },
};
})();
