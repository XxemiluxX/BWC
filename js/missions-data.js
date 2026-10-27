// ECRA — Catálogo de Misiones y Logros
// ---------------------------------------------------------------------------
// Este archivo NO depende de Firebase: lo pueden importar la página de misiones,
// el perfil, la clasificación y los foros para dibujar avatares con marco,
// títulos bajo el nombre y fondos de perfil.
//
// Cómo funciona el sistema:
//   1. Cada misión mide una "métrica" (días de sesión, racha, veces compartido,
//      misiones verdes completadas, publicaciones, etc.).
//   2. Cuando la métrica llega a la meta, la persona pulsa "Reclamar" y la misión
//      se guarda en users/{uid}.claimedMissions.
//   3. Las recompensas (marco, título, fondo) se desbloquean según las misiones
//      reclamadas, y la persona elige cuáles equipar (users/{uid}.equipped).
// ---------------------------------------------------------------------------

// ----------------------------- Utilidades de fecha -----------------------------

function pad(n) { return String(n).padStart(2, "0"); }

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export const todayKey = () => dateKey(new Date());
export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

// Páginas que cuentan para la misión "Explorador"
export const EXPLORE_PAGES = ["challenges", "forums", "ranking", "profile"];

export function pageKeyFromPath(pathname = window.location.pathname) {
  const file = (pathname.split("/").pop() || "index.html").replace(".html", "") || "index";
  if (file === "challenge") return "challenges";
  return file;
}

// ----------------------------- Categorías de misiones -----------------------------

export const MISSION_CATEGORIES = [
  { id: "start",     label: "Primeros pasos", icon: "🌱" },
  { id: "streak",    label: "Constancia",     icon: "🔥" },
  { id: "share",     label: "Compartir",      icon: "📣" },
  { id: "action",    label: "Acción verde",   icon: "🌎" },
  { id: "community", label: "Comunidad",      icon: "🤝" }
];

// ----------------------------- Recompensas: marcos -----------------------------
// El diseño de cada marco vive en css/style.css (clases .frame-<id>).

export const FRAMES = {
  semilla:    { label: "Semilla",          icon: "🌱", tier: "common",    blurb: "Un aro verde fresco, recién brotado." },
  hojas:      { label: "Corona de hojas",  icon: "🍃", tier: "common",    blurb: "Hojas girando alrededor de tu foto." },
  rio:        { label: "Río vivo",         icon: "🌊", tier: "rare",      blurb: "Agua cristalina que nunca deja de fluir." },
  mariposa:   { label: "Morpho azul",      icon: "🦋", tier: "rare",      blurb: "Los destellos azules de la mariposa más famosa de Costa Rica." },
  sol:        { label: "Sol tropical",     icon: "☀️", tier: "rare",      blurb: "Rayos de sol que giran sin parar." },
  perezoso:   { label: "Ritmo pura vida",  icon: "🦥", tier: "epic",      blurb: "Respira hondo… sin prisa, pero sin pausa." },
  volcan:     { label: "Volcán Arenal",    icon: "🌋", tier: "epic",      blurb: "Lava que late en el borde de tu perfil." },
  aurora:     { label: "Aurora del bosque",icon: "🌌", tier: "epic",      blurb: "Un resplandor verde, turquesa y violeta." },
  quetzal:    { label: "Plumas de quetzal",icon: "🪶", tier: "legendary", blurb: "Verde esmeralda con destellos rojos." },
  legendario: { label: "Corona dorada",    icon: "👑", tier: "legendary", blurb: "Solo para quienes lo han dado todo por el planeta." }
};

// ----------------------------- Recompensas: títulos -----------------------------

export const TITLES = {
  brote:        { label: "Brote curioso",           icon: "🌱", tier: "common" },
  explorador:   { label: "Explorador/a verde",      icon: "🧭", tier: "common" },
  constante:    { label: "Visitante constante",     icon: "📅", tier: "common" },
  rio:          { label: "Constante como el río",   icon: "💧", tier: "rare" },
  guardian:     { label: "Guardián/a del bosque",   icon: "🌳", tier: "epic" },
  habitante:    { label: "Habitante del bosque",    icon: "🏡", tier: "rare" },
  mensajero:    { label: "Mensajero/a verde",       icon: "📣", tier: "common" },
  embajador:    { label: "Embajador/a ECRA",        icon: "🌟", tier: "epic" },
  semilla:      { label: "Primera semilla",         icon: "🫘", tier: "common" },
  manos:        { label: "Manos a la tierra",       icon: "🧤", tier: "rare" },
  cazador:      { label: "Cazador/a de evidencias", icon: "📸", tier: "rare" },
  maestro:      { label: "Maestro/a del compost",   icon: "♻️", tier: "epic" },
  leyenda:      { label: "Leyenda de ECRA",         icon: "🏆", tier: "legendary" },
  voz:          { label: "Voz del barrio",          icon: "📢", tier: "common" },
  vecino:       { label: "Buen vecino/a",           icon: "🏘️", tier: "rare" },
  unidos:       { label: "Manos unidas",            icon: "🤝", tier: "rare" },
  polinizador:  { label: "Polinizador/a",           icon: "🐝", tier: "rare" }
};

// ----------------------------- Recompensas: fondos de perfil -----------------------------

export const BACKDROPS = {
  nuboso:    { label: "Bosque nuboso",         icon: "☁️", tier: "common" },
  noche:     { label: "Noche de luciérnagas",  icon: "✨", tier: "common" },
  naciente:  { label: "Naciente cristalina",   icon: "💧", tier: "rare" },
  atardecer: { label: "Atardecer en el Pacífico", icon: "🌅", tier: "epic" },
  arenal:    { label: "Amanecer en el Arenal", icon: "🌋", tier: "legendary" }
};

export const TIER_LABELS = {
  common: "Común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario"
};

// ----------------------------- Niveles -----------------------------

export const LEVELS = [
  { xp: 0,    label: "Semilla",  icon: "🫘" },
  { xp: 60,   label: "Brote",    icon: "🌱" },
  { xp: 150,  label: "Plántula", icon: "🌿" },
  { xp: 280,  label: "Arbusto",  icon: "🪴" },
  { xp: 450,  label: "Árbol",    icon: "🌳" },
  { xp: 650,  label: "Bosque",   icon: "🌲" },
  { xp: 900,  label: "Selva",    icon: "🦜" }
];

export function levelForXp(xp = 0) {
  let idx = 0;
  LEVELS.forEach((lv, i) => { if (xp >= lv.xp) idx = i; });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const pct = next ? Math.round(((xp - current.xp) / (next.xp - current.xp)) * 100) : 100;
  return { index: idx, current, next, pct, toNext: next ? next.xp - xp : 0 };
}

// ----------------------------- Catálogo de misiones -----------------------------
// metric: qué se mide · goal: meta · reward: { xp, frame?, title?, backdrop? }

export const MISSIONS = [
  // ---- Primeros pasos
  {
    id: "m-welcome", category: "start", icon: "👋", metric: "totalLogins", goal: 1,
    title: "¡Bienvenido/a a ECRA!",
    desc: "Inicia sesión por primera vez en la plataforma.",
    reward: { xp: 10, title: "brote", frame: "semilla" }
  },
  {
    id: "m-explorer", category: "start", icon: "🧭", metric: "visitedPages", goal: 4,
    title: "Explorador/a",
    desc: "Visita Misiones Verdes, Foros, Clasificación y tu Perfil estando con sesión iniciada.",
    reward: { xp: 20, title: "explorador", backdrop: "nuboso" }
  },
  {
    id: "m-night", category: "start", icon: "🌙", metric: "themeToggled", goal: 1,
    title: "Modo luciérnaga",
    desc: "Cambia entre modo claro y modo oscuro con el botón de la luna o el sol.",
    reward: { xp: 10, backdrop: "noche" }
  },
  {
    id: "m-style", category: "start", icon: "🎨", metric: "equippedCount", goal: 1,
    title: "A tu estilo",
    desc: "Equipa tu primera recompensa (marco, título o fondo) desde la colección.",
    reward: { xp: 15, frame: "hojas" }
  },

  // ---- Constancia (días con sesión iniciada)
  {
    id: "m-streak-3", category: "streak", icon: "🔥", metric: "bestStreak", goal: 3,
    title: "Tres días seguidos",
    desc: "Entra a ECRA tres días consecutivos.",
    reward: { xp: 20, title: "constante" }
  },
  {
    id: "m-streak-7", category: "streak", icon: "💧", metric: "bestStreak", goal: 7,
    title: "Una semana de río",
    desc: "Mantén una racha de 7 días seguidos.",
    reward: { xp: 40, title: "rio", frame: "rio" }
  },
  {
    id: "m-streak-14", category: "streak", icon: "💎", metric: "bestStreak", goal: 14,
    title: "Quincena cristalina",
    desc: "Mantén una racha de 14 días seguidos.",
    reward: { xp: 60, backdrop: "naciente" }
  },
  {
    id: "m-streak-30", category: "streak", icon: "🌌", metric: "bestStreak", goal: 30,
    title: "Guardián/a del bosque",
    desc: "Un mes entero de racha. Constancia de verdad.",
    reward: { xp: 120, title: "guardian", frame: "aurora" }
  },
  {
    id: "m-logins-20", category: "streak", icon: "🏡", metric: "totalLogins", goal: 20,
    title: "Ya eres de la casa",
    desc: "Suma 20 días distintos con sesión iniciada (no tienen que ser seguidos).",
    reward: { xp: 50, title: "habitante" }
  },

  // ---- Compartir
  {
    id: "m-share-1", category: "share", icon: "📣", metric: "shareDays", goal: 1,
    title: "Pásala bien, pásala verde",
    desc: "Comparte la página de ECRA con alguien (botón de compartir de esta sección).",
    reward: { xp: 20, title: "mensajero" }
  },
  {
    id: "m-share-3", category: "share", icon: "🦋", metric: "shareDays", goal: 3,
    title: "Vuelo de mariposa",
    desc: "Comparte ECRA en 3 días distintos. Cuenta una vez por día.",
    reward: { xp: 40, frame: "mariposa" }
  },
  {
    id: "m-share-7", category: "share", icon: "🌟", metric: "shareDays", goal: 7,
    title: "Embajador/a ECRA",
    desc: "Comparte ECRA en 7 días distintos y haz crecer la comunidad.",
    reward: { xp: 80, title: "embajador", backdrop: "atardecer" }
  },

  // ---- Acción verde (misiones verdes aprobadas)
  {
    id: "m-act-1", category: "action", icon: "🫘", metric: "challengesCompleted", goal: 1,
    title: "Tu primera misión verde",
    desc: "Completa una misión verde (se cuenta cuando un moderador aprueba tu evidencia).",
    reward: { xp: 40, title: "semilla", frame: "sol" }
  },
  {
    id: "m-act-evidence", category: "action", icon: "📸", metric: "evidences", goal: 1,
    title: "Foto o video como prueba",
    desc: "Envía tu primera evidencia desde la página de una misión verde.",
    reward: { xp: 25, title: "cazador" }
  },
  {
    id: "m-act-3", category: "action", icon: "🧤", metric: "challengesCompleted", goal: 3,
    title: "Manos a la tierra",
    desc: "Completa 3 misiones verdes.",
    reward: { xp: 60, title: "manos" }
  },
  {
    id: "m-act-5", category: "action", icon: "🦥", metric: "challengesCompleted", goal: 5,
    title: "Ritmo pura vida",
    desc: "Completa 5 misiones verdes sin perder la calma.",
    reward: { xp: 80, frame: "perezoso" }
  },
  {
    id: "m-act-10", category: "action", icon: "🌋", metric: "challengesCompleted", goal: 10,
    title: "Fuego en el Arenal",
    desc: "Completa 10 misiones verdes.",
    reward: { xp: 120, title: "maestro", frame: "volcan" }
  },
  {
    id: "m-act-20", category: "action", icon: "🪶", metric: "challengesCompleted", goal: 20,
    title: "Vuelo de quetzal",
    desc: "Completa 20 misiones verdes. Muy pocas personas llegan aquí.",
    reward: { xp: 200, frame: "quetzal" }
  },
  {
    id: "m-act-28", category: "action", icon: "🏆", metric: "challengesCompleted", goal: 28,
    title: "Leyenda de ECRA",
    desc: "Completa las 28 misiones verdes del catálogo.",
    reward: { xp: 300, title: "leyenda", frame: "legendario", backdrop: "arenal" }
  },

  // ---- Comunidad
  {
    id: "m-com-post", category: "community", icon: "📢", metric: "posts", goal: 1,
    title: "Voz del barrio",
    desc: "Publica tu primera iniciativa en los Foros Comunitarios.",
    reward: { xp: 30, title: "voz" }
  },
  {
    id: "m-com-comments", category: "community", icon: "💬", metric: "comments", goal: 3,
    title: "Buen vecino/a",
    desc: "Deja 3 comentarios en iniciativas de otras personas.",
    reward: { xp: 30, title: "vecino" }
  },
  {
    id: "m-com-collab", category: "community", icon: "🤝", metric: "collabs", goal: 1,
    title: "Manos unidas",
    desc: "Ofrécete como voluntario/a en una iniciativa de la comunidad.",
    reward: { xp: 40, title: "unidos" }
  },
  {
    id: "m-com-bees", category: "community", icon: "🐝", metric: "posts", goal: 3,
    title: "Polinizador/a de ideas",
    desc: "Publica 3 iniciativas en los foros.",
    reward: { xp: 60, title: "polinizador" }
  }
];

export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map(m => [m.id, m]));

// ----------------------------- Cálculos -----------------------------

export function claimedSet(userData) {
  const list = Array.isArray(userData?.claimedMissions) ? userData.claimedMissions : [];
  return new Set(list.filter(id => MISSION_BY_ID[id]));
}

export function xpFromClaimed(claimed) {
  let xp = 0;
  claimed.forEach(id => { xp += MISSION_BY_ID[id]?.reward?.xp || 0; });
  return xp;
}

export function unlockedRewards(claimed) {
  const out = { frame: new Set(), title: new Set(), backdrop: new Set() };
  claimed.forEach(id => {
    const r = MISSION_BY_ID[id]?.reward;
    if (!r) return;
    if (r.frame) out.frame.add(r.frame);
    if (r.title) out.title.add(r.title);
    if (r.backdrop) out.backdrop.add(r.backdrop);
  });
  return out;
}

// Qué misión da cada recompensa (para mostrar la pista en las recompensas bloqueadas)
export function rewardSource(kind, id) {
  return MISSIONS.find(m => m.reward?.[kind] === id) || null;
}

// Lo que se ve públicamente: solo cuenta lo que la persona realmente desbloqueó.
export function cosmeticsFromUser(userData) {
  const claimed = claimedSet(userData);
  const unlocked = unlockedRewards(claimed);
  const eq = userData?.equipped || {};
  const frame = unlocked.frame.has(eq.frame) ? eq.frame : null;
  const title = unlocked.title.has(eq.title) ? eq.title : null;
  const backdrop = unlocked.backdrop.has(eq.backdrop) ? eq.backdrop : null;
  const xp = xpFromClaimed(claimed);
  return { frame, title, backdrop, xp, level: levelForXp(xp).current };
}

// Métricas del usuario. `extra` trae lo que sale de otras colecciones.
export function metricsFromUser(userData = {}, extra = {}) {
  const eq = userData.equipped || {};
  return {
    totalLogins: Number(userData.totalLogins) || 0,
    bestStreak: Math.max(Number(userData.bestStreak) || 0, Number(userData.loginStreak) || 0),
    visitedPages: EXPLORE_PAGES.filter(p => (userData.visitedPages || []).includes(p)).length,
    themeToggled: userData.themeToggled ? 1 : 0,
    shareDays: Array.isArray(userData.shareDates) ? new Set(userData.shareDates).size : 0,
    equippedCount: [eq.frame, eq.title, eq.backdrop].filter(Boolean).length,
    challengesCompleted: extra.challengesCompleted ?? (Number(userData.completed) || 0),
    evidences: extra.evidences ?? 0,
    posts: extra.posts ?? 0,
    comments: extra.comments ?? 0,
    collabs: extra.collabs ?? 0
  };
}

export function missionState(mission, metrics, claimed) {
  const value = Math.min(metrics[mission.metric] || 0, mission.goal);
  const done = (metrics[mission.metric] || 0) >= mission.goal;
  return {
    value,
    pct: Math.round((value / mission.goal) * 100),
    ready: done && !claimed.has(mission.id),
    claimed: claimed.has(mission.id)
  };
}

// ----------------------------- HTML compartido -----------------------------

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

function initialsOf(name = "") {
  return name.trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";
}

// Avatar con marco. size: "sm" | "md" | "lg" | "xl"
// coreClass permite reutilizar el estilo del avatar existente (rank-avatar, post-avatar…).
export function avatarHTML(name, cosmetics = {}, { size = "md", coreClass = "af-default" } = {}) {
  const frame = cosmetics?.frame && FRAMES[cosmetics.frame] ? ` frame-${cosmetics.frame}` : "";
  return `<span class="avatar-frame af-${size}${frame}" aria-hidden="true"><span class="af-core ${coreClass}">${esc(initialsOf(name))}</span></span>`;
}

export function titleChipHTML(titleId, extraClass = "") {
  const t = TITLES[titleId];
  if (!t) return "";
  return `<span class="title-chip tier-${t.tier} ${extraClass}"><span aria-hidden="true">${t.icon}</span>${esc(t.label)}</span>`;
}
