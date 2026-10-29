
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
  { id: "streak",    label: "Constancia",     icon: "" },
  { id: "share",     label: "Compartir",      icon: "" },
  { id: "action",    label: "Retos ecológicos", icon: "" },
  { id: "community", label: "Comunidad",      icon: "" },
  { id: "collection",label: "Colección",      icon: "" }
];

// ----------------------------- Recompensas: marcos -----------------------------
// El diseño de cada marco vive en css/style.css (clases .frame-<id>).

export const FRAMES = {
  semilla:    { label: "Semilla",          icon: "🌱", tier: "common",    blurb: "Un aro verde fresco, recién brotado." },
  hojas:      { label: "Corona de hojas",  icon: "", tier: "common",    blurb: "Hojas girando alrededor de tu foto." },
  rio:        { label: "Río vivo",         icon: "", tier: "rare",      blurb: "Agua cristalina que nunca deja de fluir." },
  mariposa:   { label: "Morpho azul",      icon: "", tier: "rare",      blurb: "Los destellos azules de la mariposa más famosa de Costa Rica." },
  sol:        { label: "Sol tropical",     icon: "", tier: "rare",      blurb: "Rayos de sol que giran sin parar." },
  nube:       { label: "Bosque nuboso",    icon: "", tier: "rare",      blurb: "Neblina suave que abraza tu foto." },
  luciernaga: { label: "Luciérnagas",      icon: "", tier: "epic",      blurb: "Puntos de luz que parpadean en la noche." },
  perezoso:   { label: "Ritmo pura vida",  icon: "", tier: "epic",      blurb: "Respira hondo… sin prisa, pero sin pausa." },
  volcan:     { label: "Volcán Arenal",    icon: "", tier: "epic",      blurb: "Lava que late en el borde de tu perfil." },
  aurora:     { label: "Aurora del bosque",icon: "", tier: "epic",      blurb: "Un resplandor verde, turquesa y violeta." },
  quetzal:    { label: "Plumas de quetzal",icon: "", tier: "legendary", blurb: "Verde esmeralda con destellos rojos." },
  legendario: { label: "Corona dorada",    icon: "", tier: "legendary", blurb: "Solo para quienes lo han dado todo por el planeta." }
};

// ----------------------------- Recompensas: títulos -----------------------------

export const TITLES = {
  brote:        { label: "Brote curioso",           icon: "🌱", tier: "common" },
  explorador:   { label: "Explorador/a verde",      icon: "", tier: "common" },
  constante:    { label: "Visitante constante",     icon: "", tier: "common" },
  rio:          { label: "Constante como el río",   icon: "", tier: "rare" },
  guardian:     { label: "Guardián/a del bosque",   icon: "", tier: "epic" },
  habitante:    { label: "Habitante del bosque",    icon: "", tier: "rare" },
  mensajero:    { label: "Mensajero/a verde",       icon: "", tier: "common" },
  embajador:    { label: "Embajador/a ECRA",        icon: "", tier: "epic" },
  semilla:      { label: "Primera semilla",         icon: "", tier: "common" },
  manos:        { label: "Manos a la tierra",       icon: "", tier: "rare" },
  cazador:      { label: "Cazador/a de evidencias", icon: "", tier: "rare" },
  maestro:      { label: "Maestro/a del compost",   icon: "", tier: "epic" },
  leyenda:      { label: "Leyenda de ECRA",         icon: "", tier: "legendary" },
  voz:          { label: "Voz de la comunidad",          icon: "", tier: "common" },
  vecino:       { label: "Buen vecino/a",           icon: "", tier: "rare" },
  unidos:       { label: "Manos unidas",            icon: "", tier: "rare" },
  polinizador:  { label: "Polinizador/a",           icon: "", tier: "rare" },
  veterano:     { label: "Veterano/a del bosque",   icon: "", tier: "epic" },
  aguador:      { label: "Guardián/a del agua",     icon: "", tier: "rare" },
  reciclador:   { label: "Reciclador/a estrella",   icon: "", tier: "rare" },
  solar:        { label: "Energía solar",           icon: "", tier: "rare" },
  fauna:        { label: "Amigo/a de la fauna",     icon: "", tier: "rare" },
  corazon:      { label: "Corazón de la comunidad", icon: "", tier: "rare" },
  consciente:   { label: "Consumo consciente",      icon: "", tier: "rare" },
  educador:     { label: "Educador/a verde",        icon: "", tier: "rare" },
  todoterreno:  { label: "Todoterreno ecológico",   icon: "", tier: "epic" },
  conversador:  { label: "Conversador/a del foro",  icon: "", tier: "common" },
  lider:        { label: "Líder de iniciativas",    icon: "", tier: "epic" },
  equipo:       { label: "Jugador/a de equipo",     icon: "", tier: "rare" },
  coleccionista:{ label: "Coleccionista",           icon: "", tier: "common" },
  centenario:   { label: "Árbol centenario",        icon: "", tier: "epic" }
};

// ----------------------------- Recompensas: fondos de perfil -----------------------------

export const BACKDROPS = {
  nuboso:    { label: "Bosque nuboso",         icon: "", tier: "common" },
  noche:     { label: "Noche de luciérnagas",  icon: "", tier: "common" },
  naciente:  { label: "Naciente cristalina",   icon: "", tier: "rare" },
  atardecer: { label: "Atardecer en el Pacífico", icon: "", tier: "epic" },
  arrecife:  { label: "Arrecife de coral",     icon: "", tier: "rare" },
  cafetal:   { label: "Cafetal al amanecer",   icon: "", tier: "epic" },
  arenal:    { label: "Amanecer en el Arenal", icon: "", tier: "legendary" }
};

export const TIER_LABELS = {
  common: "Común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario"
};

// ----------------------------- Niveles -----------------------------

export const LEVELS = [
  { xp: 0,    label: "Semilla",    icon: "" },
  { xp: 60,   label: "Brote",      icon: "🌱" },
  { xp: 150,  label: "Plántula",   icon: "🌿" },
  { xp: 300,  label: "Arbusto",    icon: "" },
  { xp: 500,  label: "Árbol",      icon: "" },
  { xp: 800,  label: "Bosque",     icon: "" },
  { xp: 1200, label: "Selva",      icon: "" },
  { xp: 1800, label: "Cordillera", icon: "" },
  { xp: 2600, label: "Guardián/a del planeta", icon: "" }
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
    desc: "Visita Retos Ecológicos, Foros, Clasificación y tu Perfil estando con sesión iniciada.",
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

  // ---- Acción verde (retos ecológicos aprobados)
  {
    id: "m-act-1", category: "action", icon: "🫘", metric: "challengesCompleted", goal: 1,
    title: "Tu primer reto ecológico",
    desc: "Completa un reto ecológico (se cuenta cuando un moderador aprueba tu evidencia).",
    reward: { xp: 40, title: "semilla", frame: "sol" }
  },
  {
    id: "m-act-evidence", category: "action", icon: "📸", metric: "evidences", goal: 1,
    title: "Foto o video como prueba",
    desc: "Envía tu primera evidencia desde la página de un reto ecológico.",
    reward: { xp: 25, title: "cazador" }
  },
  {
    id: "m-act-3", category: "action", icon: "🧤", metric: "challengesCompleted", goal: 3,
    title: "Manos a la tierra",
    desc: "Completa 3 retos ecológicos.",
    reward: { xp: 60, title: "manos" }
  },
  {
    id: "m-act-5", category: "action", icon: "🦥", metric: "challengesCompleted", goal: 5,
    title: "Ritmo pura vida",
    desc: "Completa 5 retos ecológicos sin perder la calma.",
    reward: { xp: 80, frame: "perezoso" }
  },
  {
    id: "m-act-10", category: "action", icon: "🌋", metric: "challengesCompleted", goal: 10,
    title: "Fuego en el Arenal",
    desc: "Completa 10 retos ecológicos.",
    reward: { xp: 120, title: "maestro", frame: "volcan" }
  },
  {
    id: "m-act-20", category: "action", icon: "🪶", metric: "challengesCompleted", goal: 20,
    title: "Vuelo de quetzal",
    desc: "Completa 20 retos ecológicos. Muy pocas personas llegan aquí.",
    reward: { xp: 200, frame: "quetzal" }
  },
  {
    id: "m-act-28", category: "action", icon: "🏆", metric: "challengesCompleted", goal: 28,
    title: "Leyenda de ECRA",
    desc: "Completa los 28 retos ecológicos del catálogo.",
    reward: { xp: 300, title: "leyenda", frame: "legendario", backdrop: "arenal" }
  },

  // ---- Comunidad
  {
    id: "m-com-post", category: "community", icon: "📢", metric: "posts", goal: 1,
    title: "Voz de la comunidad",
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
  },
  // ---- Constancia (más difíciles)
  {
    id: "m-logins-50", category: "streak", icon: "🧓", metric: "totalLogins", goal: 50,
    title: "Raíces profundas",
    desc: "Suma 50 días distintos con sesión iniciada.",
    reward: { xp: 100, title: "veterano" }
  },
  {
    id: "m-streak-60", category: "streak", icon: "✨", metric: "bestStreak", goal: 60,
    title: "Luciérnaga incansable",
    desc: "Dos meses seguidos de racha. Casi nadie lo logra.",
    reward: { xp: 200, frame: "luciernaga" }
  },

  // ---- Compartir
  {
    id: "m-share-14", category: "share", icon: "☁️", metric: "shareDays", goal: 14,
    title: "Semillas al viento",
    desc: "Comparte ECRA en 14 días distintos.",
    reward: { xp: 120, frame: "nube" }
  },

  // ---- Retos ecológicos por tema (según la categoría del reto)
  {
    id: "m-cat-water", category: "action", icon: "💧", metric: "cat_water", goal: 3,
    title: "Guardián/a del agua",
    desc: "Completa 3 retos de la categoría Agua y nacientes.",
    reward: { xp: 60, title: "aguador", backdrop: "arrecife" }
  },
  {
    id: "m-cat-waste", category: "action", icon: "♻️", metric: "cat_waste", goal: 3,
    title: "Reciclador/a estrella",
    desc: "Completa 3 retos de Reciclaje, basura o compost.",
    reward: { xp: 60, title: "reciclador" }
  },
  {
    id: "m-cat-energy", category: "action", icon: "☀️", metric: "cat_energy", goal: 3,
    title: "Cazador/a de vampiros eléctricos",
    desc: "Completa 3 retos de Luz y energía o movilidad.",
    reward: { xp: 60, title: "solar" }
  },
  {
    id: "m-cat-wildlife", category: "action", icon: "🦜", metric: "cat_wildlife", goal: 2,
    title: "Amigo/a de la fauna",
    desc: "Completa 2 retos de Plantas y animales.",
    reward: { xp: 50, title: "fauna" }
  },
  {
    id: "m-cat-community", category: "action", icon: "🧤", metric: "cat_community", goal: 2,
    title: "Corazón de la comunidad",
    desc: "Completa 2 retos de la categoría Mi comunidad.",
    reward: { xp: 50, title: "corazon" }
  },
  {
    id: "m-cat-consumption", category: "action", icon: "🛍️", metric: "cat_consumption", goal: 2,
    title: "Compras con cabeza",
    desc: "Completa 2 retos de Compras con cabeza o huerta y comida.",
    reward: { xp: 50, title: "consciente" }
  },
  {
    id: "m-cat-education", category: "action", icon: "🎓", metric: "cat_education", goal: 2,
    title: "Educador/a verde",
    desc: "Completa 2 retos de Hablemos del ambiente.",
    reward: { xp: 50, title: "educador" }
  },
  {
    id: "m-cat-all", category: "action", icon: "🧗", metric: "categoriesDone", goal: 5,
    title: "Todoterreno ecológico",
    desc: "Completa retos de 5 categorías distintas.",
    reward: { xp: 150, title: "todoterreno" }
  },
  {
    id: "m-act-started", category: "action", icon: "🚀", metric: "challengesStarted", goal: 5,
    title: "Con ganas de más",
    desc: "Empieza 5 retos ecológicos distintos (marca tu avance en tu perfil).",
    reward: { xp: 30 }
  },
  {
    id: "m-act-evid-5", category: "action", icon: "🖼️", metric: "evidences", goal: 5,
    title: "Álbum de evidencias",
    desc: "Envía 5 evidencias (fotos o videos) de tus retos.",
    reward: { xp: 60 }
  },
  {
    id: "m-act-15", category: "action", icon: "☕", metric: "challengesCompleted", goal: 15,
    title: "Amanecer en el cafetal",
    desc: "Completa 15 retos ecológicos.",
    reward: { xp: 150, backdrop: "cafetal" }
  },

  // ---- Comunidad (más difíciles)
  {
    id: "m-com-comments-10", category: "community", icon: "💬", metric: "comments", goal: 10,
    title: "Conversador/a del foro",
    desc: "Deja 10 comentarios en los foros comunitarios.",
    reward: { xp: 60, title: "conversador" }
  },
  {
    id: "m-com-post-5", category: "community", icon: "🚩", metric: "posts", goal: 5,
    title: "Líder de iniciativas",
    desc: "Publica 5 iniciativas en los foros.",
    reward: { xp: 100, title: "lider" }
  },
  {
    id: "m-com-collab-3", category: "community", icon: "🫶", metric: "collabs", goal: 3,
    title: "Jugador/a de equipo",
    desc: "Colabora como voluntario/a en 3 iniciativas.",
    reward: { xp: 80, title: "equipo" }
  },

  // ---- Colección (misiones sobre tu propio progreso)
  {
    id: "m-col-claim-10", category: "collection", icon: "🎒", metric: "claimedCount", goal: 10,
    title: "Coleccionista",
    desc: "Reclama 10 misiones.",
    reward: { xp: 60, title: "coleccionista" }
  },
  {
    id: "m-col-frames-5", category: "collection", icon: "🖼️", metric: "framesUnlocked", goal: 5,
    title: "Vitrina de marcos",
    desc: "Desbloquea 5 marcos de perfil distintos.",
    reward: { xp: 70 }
  },
  {
    id: "m-col-claim-25", category: "collection", icon: "🏅", metric: "claimedCount", goal: 25,
    title: "Gran colección",
    desc: "Reclama 25 misiones.",
    reward: { xp: 120 }
  },
  {
    id: "m-col-level", category: "collection", icon: "🌳", metric: "xp", goal: 500,
    title: "Árbol centenario",
    desc: "Alcanza 500 XP en total y llega al nivel Árbol.",
    reward: { xp: 100, title: "centenario" }
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

// XP total: recompensas reclamadas + XP de retos ecológicos aprobados por moderación.
export function xpFromUserData(userData = {}) {
  return xpFromClaimed(claimedSet(userData)) + Math.max(0, Number(userData?.challengeXp) || 0);
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
  const xp = xpFromUserData(userData);
  return { frame, title, backdrop, xp, level: levelForXp(xp).current };
}

// Métricas del usuario. `extra` trae lo que sale de otras colecciones.
export function metricsFromUser(userData = {}, extra = {}) {
  const eq = userData.equipped || {};
  const claimed = claimedSet(userData);
  const unlocked = unlockedRewards(claimed);
  const cats = extra.cats || {};
  const metrics = {
    totalLogins: Number(userData.totalLogins) || 0,
    bestStreak: Math.max(Number(userData.bestStreak) || 0, Number(userData.loginStreak) || 0),
    visitedPages: EXPLORE_PAGES.filter(p => (userData.visitedPages || []).includes(p)).length,
    themeToggled: userData.themeToggled ? 1 : 0,
    shareDays: Array.isArray(userData.shareDates) ? new Set(userData.shareDates).size : 0,
    equippedCount: [eq.frame, eq.title, eq.backdrop].filter(Boolean).length,
    challengesCompleted: extra.challengesCompleted ?? (Number(userData.completed) || 0),
    challengesStarted: extra.challengesStarted ?? 0,
    evidences: extra.evidences ?? 0,
    posts: extra.posts ?? 0,
    comments: extra.comments ?? 0,
    collabs: extra.collabs ?? 0,
    claimedCount: claimed.size,
    framesUnlocked: unlocked.frame.size,
    xp: xpFromUserData(userData),
    categoriesDone: Object.values(cats).filter(n => n > 0).length
  };
  // Retos completados por categoría: cat_water, cat_waste, cat_energy…
  Object.entries(cats).forEach(([key, n]) => { metrics[`cat_${key}`] = n; });
  // La categoría "Luz y energía" también cubre movilidad; "consumption" cubre huerta y comida.
  return metrics;
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
