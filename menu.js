/* ============================================================
   menu.js - Administrador Central de Niveles
   - Carga cada nivel como un script independiente.
   - Antes de cambiar de nivel llama a destroy() del nivel actual
     (detiene su bucle, su música y sus eventos).
   - Escucha los avisos "nivel-ganado" y "nivel-siguiente" que
     envían los niveles para desbloquear y pasar al próximo.
   - Al abrir el juego muestra primero el video de introducción
     (multimedia/videointro.mp4) y recién después carga el nivel 1.
     Cada nivel muestra después su propia imagen (intro, intro2, intro3, intro4).
   - Al ganar el último nivel (el 4) muestra la pantalla final (multimedia/finfin.jpg)
     con fuegos artificiales y dos botones: volver a empezar (desde el video)
     o terminar el juego.
   ============================================================ */

const NIVELES = [
  { id: 1, archivo: "script.js", boton: document.getElementById("btnNivel1"), texto: "Nivel 1: La Ciudad", icono: "🏙️" },
  { id: 2, archivo: "nivel2.js", boton: document.getElementById("btnNivel2"), texto: "Nivel 2: Tormenta",  icono: "🌧️" },
  { id: 3, archivo: "nivel3.js", boton: document.getElementById("btnNivel3"), texto: "Nivel 3: Noche",     icono: "🌙" },
  { id: 4, archivo: "nivel4.js", boton: document.getElementById("btnNivel4"), texto: "Nivel 4: Invierno",     icono: "❄️" },
];

// Cada nivel superado se guarda como "nivel1-superado", "nivel2-superado"... (el nivel 1 ya usaba esa clave)
const claveSuperado = (id) => "nivel" + id + "-superado";
let scriptActivo = null;
let videoActivo = true;   // true hasta que termina (o se saltea) el video de introducción
let finalActivo = false;  // true mientras se ve la pantalla final
let nivelActual = 0;

/* ---------- Progreso guardado ---------- */
const superadosSesion = {};   // por si el navegador no deja usar localStorage

// Un nivel está abierto si el anterior fue superado
function nivelDesbloqueado(id) {
  if (id === 1) return true;
  const previo = id - 1;
  if (superadosSesion[previo]) return true;
  try { return localStorage.getItem(claveSuperado(previo)) === "true"; } catch (_) { return false; }
}

function registrarNivelSuperado(id) {
  superadosSesion[id] = true;
  try { localStorage.setItem(claveSuperado(id), "true"); } catch (_) { /* sin almacenamiento */ }
  actualizarBotones();
}

/* ---------- Botones ---------- */
function actualizarBotones() {
  for (const n of NIVELES) {
    const abierto = nivelDesbloqueado(n.id);
    n.boton.disabled = !abierto;
    n.boton.className = "btn-nivel " + (abierto ? "btn-activo" : "btn-bloqueado");
    n.boton.innerText = (abierto ? n.icono : "🔒") + " " + n.texto;
    n.boton.style.opacity = (abierto && n.id !== nivelActual) ? "0.6" : "1";
    n.boton.style.border = n.id === nivelActual ? "2px solid #fff" : "none";
  }
}

/* ---------- Carga y descarga de niveles ---------- */
function limpiarNivelAnterior() {
  // Le pedimos al nivel que se apague solo: bucle, música y eventos.
  if (window.__nivelActual && typeof window.__nivelActual.destroy === "function") {
    try { window.__nivelActual.destroy(); } catch (e) { console.error("Error al cerrar el nivel:", e); }
  }
  window.__nivelActual = null;

  if (scriptActivo) {
    scriptActivo.remove();
    scriptActivo = null;
  }
}

function cargarNivel(id) {
  if (videoActivo || finalActivo) return;   // durante el video o la pantalla final no se cambia de nivel
  const nivel = NIVELES.find((n) => n.id === id);
  if (!nivel || !nivelDesbloqueado(id)) return;

  limpiarNivelAnterior();
  nivelActual = id;
  actualizarBotones();

  const nuevoScript = document.createElement("script");
  nuevoScript.src = nivel.archivo + "?v=" + Date.now();   // fuerza a ejecutarlo de cero
  nuevoScript.onerror = () => console.error("No se pudo cargar " + nivel.archivo);
  document.body.appendChild(nuevoScript);
  scriptActivo = nuevoScript;

  document.activeElement && document.activeElement.blur();   // que la barra espaciadora no "clickee" el botón
}

/* ---------- Avisos que llegan desde los niveles ---------- */
window.addEventListener("nivel-ganado", (e) => {
  if (e.detail && e.detail.nivel) registrarNivelSuperado(e.detail.nivel);
});

window.addEventListener("nivel-siguiente", (e) => {
  const actual = e.detail ? e.detail.nivel : nivelActual;
  // Si se pide pasar al siguiente es porque el nivel ya se ganó: nos aseguramos de dejarlo marcado como superado
  if (actual >= 1 && !nivelDesbloqueado(actual + 1)) registrarNivelSuperado(actual);
  if (actual >= NIVELES.length) { mostrarFinal(); return; }   // terminó el último nivel
  if (nivelDesbloqueado(actual + 1)) cargarNivel(actual + 1);
});

/* ---------- Eventos de los botones ---------- */
for (const n of NIVELES) {
  n.boton.addEventListener("click", () => cargarNivel(n.id));
}

/* ---------- Video de introducción ---------- */
const SRC_VIDEO = "multimedia/videointro.mp4";
const cajaVideo = document.getElementById("video-intro");
const videoEl = document.getElementById("videoIntro");
const btnPlayIntro = document.getElementById("btnPlayIntro");
const btnSkipIntro = document.getElementById("btnSkipIntro");

function terminarVideo() {
  if (!videoActivo) return;
  videoActivo = false;
  try { videoEl.pause(); } catch (_) { /* nada */ }
  if (cajaVideo) cajaVideo.style.display = "none";
  cargarNivel(1);
}

// Muestra el video desde el principio (al abrir el juego y al "comenzar de nuevo")
function mostrarVideoIntro() {
  // Si falta el video o el HTML no lo tiene, se empieza el juego directamente
  if (!cajaVideo || !videoEl || !btnPlayIntro || !btnSkipIntro) { videoActivo = false; cargarNivel(1); return; }
  videoActivo = true;
  videoEl.src = SRC_VIDEO;
  videoEl.load();
  btnPlayIntro.style.display = "";
  btnSkipIntro.style.display = "none";
  cajaVideo.style.display = "flex";
}

if (cajaVideo && videoEl && btnPlayIntro && btnSkipIntro) {
  btnPlayIntro.addEventListener("click", () => {
    // el clic del usuario permite reproducir el video CON sonido
    btnPlayIntro.style.display = "none";
    btnSkipIntro.style.display = "block";
    videoEl.play().catch(terminarVideo);
  });
  btnSkipIntro.addEventListener("click", terminarVideo);
  videoEl.addEventListener("ended", terminarVideo);
  videoEl.addEventListener("error", terminarVideo);   // archivo faltante o formato no soportado
}

/* ---------- Pantalla final: imagen + fuegos artificiales ---------- */
const pantallaFinal = document.getElementById("pantalla-final");
const cvFuegos = document.getElementById("fuegos");
const cxFuegos = cvFuegos ? cvFuegos.getContext("2d") : null;
const btnReiniciar = document.getElementById("btnReiniciar");
const btnFin = document.getElementById("btnFin");
const FUEGOS_W = 960, FUEGOS_H = 540;
const COLORES_FUEGOS = [0, 20, 45, 60, 120, 170, 200, 280, 320];   // tonos (hue)
let fuegosRaf = null, cohetes = [], chispas = [], tFuegos = 0, audioFuegos = null;

function sonidoExplosion() {
  try {
    audioFuegos = audioFuegos || new (window.AudioContext || window.webkitAudioContext)();
    if (audioFuegos.state === "suspended") audioFuegos.resume();
    const a = audioFuegos, n = Math.floor(a.sampleRate * 0.35);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    const g = a.createGain(); g.gain.value = 0.22;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  } catch (_) { /* sin audio */ }
}

function lanzarCohete() {
  cohetes.push({
    x: 120 + Math.random() * 720, y: FUEGOS_H,
    vx: (Math.random() - 0.5) * 1.2, vy: -(8 + Math.random() * 2.5),
    objetivo: 90 + Math.random() * 170,
    hue: COLORES_FUEGOS[(Math.random() * COLORES_FUEGOS.length) | 0],
  });
}

function explotar(c) {
  sonidoExplosion();
  const n = 70 + ((Math.random() * 50) | 0), doble = Math.random() < 0.5;
  const hue2 = (c.hue + 40 + Math.random() * 60) % 360;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.1;
    const v = doble ? (i % 2 ? 2.2 : 4.6) : 3 + Math.random() * 3;   // anillo doble o explosión redonda
    chispas.push({ x: c.x, y: c.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 1, decae: 0.008 + Math.random() * 0.01, hue: i % 3 === 0 ? hue2 : c.hue });
  }
}

function cuadroFuegos() {
  const g = cxFuegos;
  g.globalCompositeOperation = "destination-out";   // desvanece las estelas dejando ver la imagen
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(0, 0, FUEGOS_W, FUEGOS_H);
  g.globalCompositeOperation = "lighter";

  tFuegos++;
  if (tFuegos % 28 === 0 || (tFuegos % 13 === 0 && Math.random() < 0.3)) lanzarCohete();

  for (let i = cohetes.length - 1; i >= 0; i--) {
    const c = cohetes[i];
    c.x += c.vx; c.y += c.vy; c.vy += 0.12;
    g.fillStyle = "rgba(255,240,200,0.9)";
    g.beginPath(); g.arc(c.x, c.y, 2.2, 0, Math.PI * 2); g.fill();
    if (c.vy >= -1 || c.y <= c.objetivo) { explotar(c); cohetes.splice(i, 1); }
  }
  for (let i = chispas.length - 1; i >= 0; i--) {
    const s = chispas[i];
    s.x += s.vx; s.y += s.vy; s.vy += 0.05; s.vx *= 0.985; s.vy *= 0.985; s.vida -= s.decae;
    if (s.vida <= 0) { chispas.splice(i, 1); continue; }
    g.fillStyle = "hsla(" + s.hue + ",100%,65%," + s.vida.toFixed(2) + ")";
    g.beginPath(); g.arc(s.x, s.y, 0.8 + 2 * s.vida, 0, Math.PI * 2); g.fill();
  }
  fuegosRaf = requestAnimationFrame(cuadroFuegos);
}

function detenerFuegos() {
  if (fuegosRaf) cancelAnimationFrame(fuegosRaf);
  fuegosRaf = null;
  cohetes = []; chispas = [];
  if (cxFuegos) cxFuegos.clearRect(0, 0, FUEGOS_W, FUEGOS_H);
}

function mostrarFinal() {
  if (finalActivo) return;
  if (!pantallaFinal || !cxFuegos) { finalActivo = false; mostrarVideoIntro(); return; }   // sin pantalla final: se vuelve a empezar
  finalActivo = true;
  limpiarNivelAnterior();   // apaga el último nivel (bucle, música y eventos)
  nivelActual = 0;
  actualizarBotones();

  pantallaFinal.classList.remove("cerrado");
  pantallaFinal.style.display = "flex";
  detenerFuegos();
  tFuegos = 0;
  lanzarCohete(); lanzarCohete();
  fuegosRaf = requestAnimationFrame(cuadroFuegos);
  document.activeElement && document.activeElement.blur();
}

function comenzarDeNuevo() {
  detenerFuegos();
  pantallaFinal.style.display = "none";
  finalActivo = false;
  mostrarVideoIntro();   // vuelve a empezar desde el video de introducción
}

function terminarJuego() {
  detenerFuegos();
  pantallaFinal.classList.add("cerrado");   // pantalla negra de agradecimiento
  try { window.close(); } catch (_) { /* el navegador solo deja cerrar ventanas abiertas por script */ }
}

if (btnReiniciar) btnReiniciar.addEventListener("click", comenzarDeNuevo);
if (btnFin) btnFin.addEventListener("click", terminarJuego);

/* ---------- INICIO DEL JUEGO ---------- */
actualizarBotones();
mostrarVideoIntro();
