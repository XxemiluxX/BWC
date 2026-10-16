import { auth, db } from "./firebase-client.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const THEME_KEY = "ecra_theme_v2";
export const ADMIN_EMAIL = "mongemoraemiliano60@gmail.com";
export const CONTACT_PHONE = "87506973";
export const CONTACT_EMAIL = "mongemoraemiliano60@gmail.com";

// Catálogo completo de retos de sostenibilidad ambiental accesibles, prácticos y seguros
export const CHALLENGES = [
  {
    id: "challenge-1",
    number: 1,
    title: "Manejo consciente y separación de residuos",
    shortTitle: "Residuos y reciclaje",
    category: "waste",
    categoryLabel: "Reciclaje y residuos",
    difficulty: "Fácil",
    duration: "20-30 min",
    icon: "♻️",
    summary: "Audita y clasifica adecuadamente los residuos en tu hogar o comunidad para reducir lo que llega al vertedero.",
    instruction: "Revisa los residuos generados hoy en tu hogar o espacio de trabajo. Separa al menos tres categorías: orgánicos (para compost), reciclables limpios y secos (plásticos, papel, cartón o vidrio) y no reciclables. Llévalos o déjalos listos para el centro de acopio o ruta de reciclaje local.",
    concreteActions: [
      "Limpia y seca envases de plástico, latas o vidrio antes de disponerlos.",
      "Separa cartón y papel evitando que se contaminen con grasa o líquidos.",
      "Identifica el centro de acopio o día de recolección selectiva de tu municipalidad."
    ],
    whyItMatters: "La separación en la fuente evita que toneladas de materiales útiles terminen contaminando ríos, costas y vertederos a cielo abierto."
  },
  {
    id: "challenge-2",
    number: 2,
    title: "Protección de nacientes y uso consciente del agua",
    shortTitle: "Conservación de agua",
    category: "water",
    categoryLabel: "Agua y nacientes",
    difficulty: "Media",
    duration: "30-45 min",
    icon: "💧",
    summary: "Inspecciona tu consumo hídrico, repara o reporta fugas y cuida las fuentes naturales de tu entorno.",
    instruction: "Realiza una inspección en tu casa o comunidad para detectar goteos en grifos, inodoros o mangueras. Implementa medidas inmediatas de ahorro: duchas de máximo 4 minutos, cerrar la llave al enjabonar platos y, si vives cerca de una quebrada o naciente, asegúrate de que no haya basura ni vertidos cerca.",
    concreteActions: [
      "Revisa empaques de llaves y tuberías para eliminar goteos continuos.",
      "Aprovecha el agua de lavado de frutas o lluvia para regar plantas de jardín.",
      "Evita verter aceites de cocina o químicos al desagüe; almacena el aceite usado en botellas plásticas."
    ],
    whyItMatters: "Las fuentes de agua dulce son vulnerables. Proteger nacientes garantiza agua limpia y vida para nuestras comunidades y ecosistemas."
  },
  {
    id: "challenge-3",
    number: 3,
    title: "Refugio para flora y polinizadores locales",
    shortTitle: "Flora y fauna",
    category: "wildlife",
    categoryLabel: "Protección de biodiversidad",
    difficulty: "Fácil",
    duration: "30 min",
    icon: "🦋",
    summary: "Fomenta la presencia de abejas, mariposas y aves sembrando plantas con flores o creando espacios seguros.",
    instruction: "Crea o cuida un pequeño espacio verde con plantas con flores atractivas para polinizadores (como ruda, lantana, girasoles o aromáticas). Si tienes jardín, evita podar en exceso la vegetación silvestre y no apliques pesticidas ni venenos que dañen a insectos benéficos.",
    concreteActions: [
      "Coloca un bebedero seguro para polinizadores (plato poco profundo con piedras limpias y agua fresca).",
      "Planta al menos una especie autóctona o aromática en maceta o suelo directo.",
      "Aprende a identificar 2 especies de aves o mariposas habituales en tu zona."
    ],
    whyItMatters: "Los polinizadores sostienen más del 75% de los cultivos que alimentan al mundo y están en declive por la pérdida de hábitat."
  },
  {
    id: "challenge-4",
    number: 4,
    title: "Concientización de energía y consumo eléctrico",
    shortTitle: "Ahorro de energía",
    category: "energy",
    categoryLabel: "Energía y consumo",
    difficulty: "Fácil",
    duration: "20 min",
    icon: "⚡",
    summary: "Reduce el consumo pasivo de electricidad y disminuye tu huella de carbono doméstica.",
    instruction: "Recorre tu casa y desconecta los cargadores, electrodomésticos y dispositivos que consumen energía 'fantasma' en modo de espera. Aprovecha al máximo la luz natural abriendo cortinas y planifica sustituir focos incandescentes por tecnología LED.",
    concreteActions: [
      "Desconecta cargadores de celular y computadoras cuando no estén en uso.",
      "Usa regletas con interruptor para apagar de un solo paso centros de entretenimiento.",
      "Limpia focos y lámparas para mejorar la luminosidad sin necesidad de más watts."
    ],
    whyItMatters: "La generación eléctrica muchas veces depende de combustibles fósiles; consumir menos energía reduce las emisiones de gases de efecto invernadero."
  },
  {
    id: "challenge-5",
    number: 5,
    title: "Recuperación y limpieza de un espacio público",
    shortTitle: "Limpieza comunitaria",
    category: "community",
    categoryLabel: "Espacios públicos",
    difficulty: "Media",
    duration: "45-60 min",
    icon: "🧤",
    summary: "Dedica un tiempo a sanear una acera, parque, parada de autobús o orilla de camino en tu localidad.",
    instruction: "Equípate con guantes reutilizables y bolsas para residuos. Escoge un tramo de acera, área verde o parque de tu comunidad y recoge plásticos, colillas de cigarro y latas. Si es posible, invita a un vecino o familiar a sumarse.",
    concreteActions: [
      "Lleva guantes de protección y recipiente seguro para objetos punzocortantes.",
      "Separa los plásticos y latas reciclables recogidos de la basura común.",
      "Toma una foto de antes y después para motivar a tu vecindario en los foros de ECRA."
    ],
    whyItMatters: "Un espacio público limpio fomenta el respeto comunitario, la convivencia saludable y previene que los desechos obstruyan alcantarillas."
  },
  {
    id: "challenge-6",
    number: 6,
    title: "Consumo responsable y cero plástico de un solo uso",
    shortTitle: "Consumo responsable",
    category: "consumption",
    categoryLabel: "Consumo responsable",
    difficulty: "Fácil",
    duration: "Todo el día",
    icon: "🛍️",
    summary: "Realiza tus compras diarias sin aceptar bolsas plásticas, pajillas ni botellas descartables.",
    instruction: "Durante al menos una semana completa, lleva siempre contigo tu bolsa de tela, una botella reutilizable de agua y un recipiente para alimentos cuando salgas. Elige productos locales, de temporada y a granel para evitar envases innecesarios.",
    concreteActions: [
      "Di activamente 'sin bolsa plástica, por favor' en el comercio local.",
      "Prefiere productos de agricultores y emprendedores locales de tu cantón o provincia.",
      "Planifica tu menú semanal para no comprar comida de más que termine descomponiéndose."
    ],
    whyItMatters: "El mejor residuo es aquel que no se produce. Reducir desde la compra disminuye drásticamente la demanda de plásticos vírgenes."
  },
  {
    id: "challenge-7",
    number: 7,
    title: "Iniciación al compostaje casero",
    shortTitle: "Compostaje y suelo",
    category: "waste",
    categoryLabel: "Suelo y materia orgánica",
    difficulty: "Media",
    duration: "30-40 min",
    icon: "🌱",
    summary: "Transforma cáscaras de frutas y restos de verduras en abono natural rico en nutrientes.",
    instruction: "Aparta un balde con tapa o espacio en tu patio para iniciar compostaje. Coloca una base de hojas secas o aserrín (material marrón) y agrega cáscaras de vegetales, restos de café y frutas (material verde). Mantén la mezcla húmeda pero aireada.",
    concreteActions: [
      "No agregues carnes, lácteos ni aceites para evitar malos olores o fauna no deseada.",
      "Mantén la proporción equilibrada: 2 partes de hojas secas por cada parte de restos frescos.",
      "Revuelve semanalmente para oxigenar los microorganismos que descomponen la materia."
    ],
    whyItMatters: "Más del 50% de la basura doméstica es orgánica. Al compostar se evita la generación de gas metano en los vertederos y se nutre la tierra."
  },
  {
    id: "challenge-8",
    number: 8,
    title: "Educación y diálogo ambiental en tu círculo",
    shortTitle: "Educación ambiental",
    category: "education",
    categoryLabel: "Educación y concientización",
    difficulty: "Fácil",
    duration: "30 min",
    icon: "🗣️",
    summary: "Comparte conocimientos sobre cambio climático y sostenibilidad con tu familia, amigos o centro de estudio.",
    instruction: "Conversa con al menos dos personas cercanas sobre una práctica ecológica sencilla que puedan adoptar juntos (como separar residuos o ahorrar agua). También puedes compartir una publicación informativa en los foros de ECRA o en tus redes sociales personales.",
    concreteActions: [
      "Explica de forma positiva por qué te importa el cuidado del planeta sin juzgar a otros.",
      "Comparte una receta de aprovechamiento de alimentos o un consejo de ahorro energético.",
      "Invita a un amigo o colega a registrarse en ECRA para realizar un reto en conjunto."
    ],
    whyItMatters: "El cambio cultural empieza con conversaciones honestas y cotidianas. La educación ambiental compartida multiplica el impacto colectivo."
  }
];

// Categorías oficiales de los Foros Comunitarios
export const FORUM_CATEGORIES = {
  campaign: { label: "Campañas ecológicas", icon: "🌱", description: "Jornadas, firmas, reforestación y actividades colectivas." },
  problem: { label: "Problemas ambientales de mi comunidad", icon: "⚠️", description: "Denuncias constructivas, vertederos clandestinos y puntos críticos." },
  project: { label: "Proyectos sostenibles", icon: "🛠️", description: "Iniciativas en marcha que requieren voluntarios o apoyo vecinal." },
  wildlife: { label: "Protección de flora y fauna", icon: "🦋", description: "Cuidado de especies nativas, rescate y siembra comunitaria." },
  waste: { label: "Reciclaje y contaminación", icon: "♻️", description: "Centros de acopio, compostaje barrial y reducción de plásticos." },
  water: { label: "Agua y conservación de nacientes", icon: "💧", description: "Cuidado de ríos, cuencas, quebradas y acueductos comunales." },
  education: { label: "Educación ambiental", icon: "📚", description: "Talleres, charlas, guías didácticas y recursos escolares." },
  idea: { label: "Ideas y propuestas ciudadanas", icon: "💡", description: "Propuestas innovadoras para mejorar barrios y ciudades." },
  general: { label: "General", icon: "🌐", description: "Cualquier otro tema ambiental y comunitario." }
};

// Estados oficiales de iniciativas en foros
export const FORUM_STATUSES = {
  proposal: { label: "Propuesta", class: "status-neutral", badge: "📋 Propuesta" },
  planning: { label: "En planificación", class: "status-pending", badge: "📝 En planificación" },
  development: { label: "En desarrollo", class: "status-progress", badge: "🚧 En desarrollo" },
  completed: { label: "Finalizada", class: "status-approved", badge: "✅ Finalizada" }
};

// Tipos de publicaciones
export const FORUM_TYPES = {
  idea: { label: "Idea", icon: "💡" },
  campaign: { label: "Campaña", icon: "📢" },
  problem: { label: "Problema", icon: "⚠️" },
  project: { label: "Proyecto", icon: "🌱" }
};

// Opciones de colaboración voluntaria
export const CONTRIBUTION_OPTIONS = [
  { id: "hands", label: "Manos a la obra / Trabajo en terreno", icon: "🧤" },
  { id: "ideas", label: "Aporte de ideas y planificación técnica", icon: "💡" },
  { id: "materials", label: "Donación o préstamo de herramientas/materiales", icon: "📦" },
  { id: "diffusion", label: "Difusión, comunicación y redes sociales", icon: "📢" },
  { id: "other", label: "Otra forma de apoyo", icon: "🤝" }
];

// Promesa para verificar el estado inicial de Auth
const authReady = new Promise(resolve => {
  const stop = onAuthStateChanged(auth, user => {
    stop();
    resolve(user || null);
  });
});

export async function waitForAuth() {
  return authReady;
}

export function nowISO() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

export function formatDate(date) {
  if (!date) return "—";
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(d);
}

export function formatDateShort(date) {
  if (!date) return "—";
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

export function timeValue(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[c]));
}

export function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

export function isConfiguredAdmin(userOrProfile) {
  const email = normalize(userOrProfile?.email || "");
  return email === normalize(ADMIN_EMAIL);
}

// Asegura que exista el perfil en Cloud Firestore y mantiene el rol admin sincronizado
export async function ensureUserProfile(user, preferredName = "") {
  if (!user?.uid) return null;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const admin = isConfiguredAdmin(user);

  if (!snap.exists()) {
    const profile = {
      firebaseUid: user.uid,
      name: preferredName || user.displayName || user.email?.split("@")[0] || "Participante ECRA",
      email: user.email || "",
      role: admin ? "admin" : "participant",
      currentChallenge: 1,
      completed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, profile);
    return { id: user.uid, ...profile, createdAt: nowISO(), updatedAt: nowISO() };
  }

  const existing = snap.data();
  const patch = { updatedAt: serverTimestamp() };
  if (preferredName || user.displayName) patch.name = preferredName || user.displayName;
  if (user.email && existing.email !== user.email) patch.email = user.email;
  if (admin && existing.role !== "admin") patch.role = "admin";

  if (Object.keys(patch).length > 1 || (admin && existing.role !== "admin")) {
    await updateDoc(ref, patch);
  }

  return { id: user.uid, ...existing, ...patch, role: admin ? "admin" : (patch.role || existing.role) };
}

export async function getCurrentProfile() {
  const user = await waitForAuth();
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return ensureUserProfile(user);
  const data = snap.data();
  return { id: snap.id, ...data };
}

export async function requireParticipant() {
  const user = await waitForAuth();
  if (!user) {
    window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  const profile = await getCurrentProfile();
  return profile;
}

export async function requireAdmin() {
  const user = await waitForAuth();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    window.location.href = "profile.html";
    return null;
  }
  return { user, profile };
}

export async function signOutAndGoLogin() {
  try {
    await signOut(auth);
  } finally {
    window.location.href = "login.html";
  }
}

// Sistema de notificaciones toast profesional
export function showToast(message, type = "info") {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.setAttribute("role", "status");
  item.textContent = message;
  root.appendChild(item);

  // Animación de entrada y auto-eliminación
  requestAnimationFrame(() => item.classList.add("visible"));
  setTimeout(() => {
    item.classList.remove("visible");
    setTimeout(() => item.remove(), 250);
  }, 3400);
}

// Modal accesible e interactivo con cierre ESC y clic fuera.
// Si el contenido no trae su propio .modal-overlay, se envuelve aquí: antes los
// modales de foros/perfil se pintaban sin contenedor al final de la página y no se veían.
export function openModal(html) {
  let root = document.getElementById("modalRoot") || document.getElementById("adminModalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "modalRoot";
    document.body.appendChild(root);
  }

  const hasOverlay = /class="[^"]*\bmodal-overlay\b/.test(html);
  root.innerHTML = hasOverlay
    ? html
    : `<div class="modal-overlay" data-close-modal><div class="modal-dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  root.setAttribute("aria-hidden", "false");

  const escHandler = (e) => {
    if (e.key === "Escape") close();
  };

  function close() {
    root.innerHTML = "";
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  document.body.style.overflow = "hidden";
  root.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", close));
  root.querySelectorAll("[data-close-modal]").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) close();
    });
  });
  document.addEventListener("keydown", escHandler);

  // Enfoca el primer campo para poder escribir de inmediato
  const firstField = root.querySelector("input:not([type=hidden]), textarea, select");
  if (firstField) setTimeout(() => firstField.focus({ preventScroll: true }), 60);

  return { close, root };
}

// Gestión del tema claro/oscuro
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    btn.title = theme === "dark" ? "Activar modo claro" : "Activar modo oscuro";
  });
}

export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  applyTheme(stored || preferred);

  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "light";
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  });

  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", event => {
    if (localStorage.getItem(THEME_KEY)) return;
    applyTheme(event.matches ? "dark" : "light");
  });
}

// Inicialización inmediata del tema para evitar parpadeos
(function bootTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    const preferred = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    document.documentElement.dataset.theme = stored || preferred;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();

// Soporte para mostrar/ocultar contraseñas
export function togglePasswordVisibility() {
  document.querySelectorAll("[data-toggle-password]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-toggle-password");
      const input = document.getElementById(targetId);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Mostrar" : "Ocultar";
      btn.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
    });
  });
}

// Conexión del botón de logout
export function wireLogout() {
  document.querySelectorAll("#logoutBtn, #adminLogoutBtn, [data-logout]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await signOutAndGoLogin();
      } catch (err) {
        console.error("Error al salir:", err);
        btn.disabled = false;
      }
    });
  });
}

// Actualiza dinámicamente el header según si el usuario está autenticado
export function syncNavigationHeader(user, profile) {
  const navLinksContainer = document.querySelector(".nav-links");
  if (!navLinksContainer) return;

  // Si estamos en admin.html dejamos la navegación lateral del panel intacta
  if (document.body.classList.contains("admin-page")) return;

  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  let html = `
    <a class="nav-link ${currentPath === "index.html" || currentPath === "" ? "active" : ""}" href="index.html">Inicio</a>
    <a class="nav-link ${currentPath === "challenges.html" || currentPath === "challenge.html" ? "active" : ""}" href="challenges.html">Retos Ambientales</a>
    <a class="nav-link ${currentPath === "forums.html" ? "active" : ""}" href="forums.html">Foros Comunitarios</a>
  `;

  if (user && profile) {
    if (profile.role === "admin") {
      html += `<a class="nav-link ${currentPath === "admin.html" ? "active" : ""}" href="admin.html">Moderación</a>`;
    }
    html += `
      <a class="nav-link user-pill ${currentPath === "profile.html" ? "active" : ""}" href="profile.html">
        <span class="user-pill-avatar">${initials(profile.name)}</span>
        <span>${escapeHTML(profile.name?.split(" ")[0] || "Mi perfil")}</span>
      </a>
      <button id="logoutBtn" class="btn btn-ghost btn-sm" type="button" data-logout>Cerrar sesión</button>
    `;
  } else {
    html += `
      <a class="nav-link ${currentPath === "login.html" ? "active" : ""}" href="login.html">Iniciar sesión</a>
      <a class="btn btn-primary btn-sm" href="register.html">Participar</a>
    `;
  }

  navLinksContainer.innerHTML = html;
  wireLogout();
}

// Añade el menú móvil si no existe
export function initMobileNav() {
  const headerContent = document.querySelector(".header-content");
  const navLinks = document.querySelector(".nav-links");
  if (!headerContent || !navLinks) return;

  let toggle = document.querySelector(".mobile-menu-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.className = "mobile-menu-toggle";
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span class="hamburger-line"></span><span class="hamburger-line"></span><span class="hamburger-line"></span>`;
    headerContent.appendChild(toggle);
  }

  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.classList.toggle("active", isOpen);
  });

  // Cerrar al hacer clic en un enlace
  navLinks.querySelectorAll("a, button").forEach(item => {
    item.addEventListener("click", () => {
      navLinks.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("active");
    });
  });
}

// Funciones para retos persistidos en Firestore
export async function getUserChallengeStatus(userId) {
  if (!userId) return {};
  try {
    const snap = await getDocs(query(collection(db, "user_challenges"), where("userId", "==", userId)));
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      map[data.challengeId] = { id: d.id, ...data };
    });
    return map;
  } catch (error) {
    console.error("Error al obtener estado de retos:", error);
    return {};
  }
}

export async function setChallengeProgress(userId, challengeId, status = "in_progress", notes = "") {
  if (!userId || !challengeId) return;
  const docId = `${userId}_${challengeId}`;
  const ref = doc(db, "user_challenges", docId);
  const snap = await getDoc(ref);

  const payload = {
    userId,
    challengeId,
    status,
    notes: notes || "",
    updatedAt: serverTimestamp()
  };

  if (status === "in_progress" && (!snap.exists() || !snap.data().startedAt)) {
    payload.startedAt = serverTimestamp();
  }
  if (status === "completed") {
    payload.completedAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });

  // Actualizar contador del usuario
  try {
    const all = await getUserChallengeStatus(userId);
    all[challengeId] = { ...payload, status };
    const countCompleted = Object.values(all).filter(c => c.status === "completed").length;
    await updateDoc(doc(db, "users", userId), {
      completed: countCompleted,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("No se pudo actualizar contador en users:", err);
  }
}

// Cálculo de estadísticas comunitarias con datos reales de Firestore
export async function getRealCommunityMetrics() {
  try {
    const [postsSnap, usersSnap, evidencesSnap] = await Promise.all([
      getDocs(collection(db, "forumPosts")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "users")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "evidences")).catch(() => ({ docs: [] }))
    ]);

    const activePosts = postsSnap.docs.filter(d => !d.data().deleted);
    const participants = usersSnap.docs.filter(d => d.data().role !== "admin");
    const completedChallengesCount = usersSnap.docs.reduce((acc, d) => {
      return acc + (Number(d.data().completed) || 0);
    }, 0);

    return {
      initiativesCount: activePosts.length,
      participantsCount: participants.length,
      challengesCompleted: completedChallengesCount,
      catalogCount: CHALLENGES.length
    };
  } catch (error) {
    console.error("Error al calcular métricas comunitarias:", error);
    return {
      initiativesCount: 0,
      participantsCount: 0,
      challengesCompleted: 0,
      catalogCount: CHALLENGES.length
    };
  }
}

// Escuchar cambios de Auth globalmente
onAuthStateChanged(auth, async user => {
  window.ECRA_AUTH_USER = user || null;
  if (user) {
    try {
      window.ECRA_PROFILE = await ensureUserProfile(user);
    } catch (error) {
      console.error("No se pudo sincronizar el perfil:", error);
      window.ECRA_PROFILE = null;
    }
  } else {
    window.ECRA_PROFILE = null;
  }
  syncNavigationHeader(window.ECRA_AUTH_USER, window.ECRA_PROFILE);
});

// Inicialización de DOM
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMobileNav();
  wireLogout();
  togglePasswordVisibility();
});

// --------------------------------------------------------------------------
// EFECTOS VISUALES: luz que sigue al puntero y revelado al hacer scroll
// --------------------------------------------------------------------------
const SPOTLIGHT_SELECTOR = ".card, .pillar-card, .challenge-card, .post-card, .metric-card, .progress-card, .admin-stat-card";
const REVEAL_SELECTOR = ".pillar-card, .challenge-card, .post-card, .metric-item, .metric-card, .card, .banner-highlight, .filter-bar, .profile-hero-card, .empty-state";

function initSpotlight() {
  const move = (e) => {
    const el = e.target.closest?.(SPOTLIGHT_SELECTOR);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerdown", move, { passive: true });
}

function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("rv-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

  const register = (root) => {
    const nodes = root.matches?.(REVEAL_SELECTOR) ? [root, ...root.querySelectorAll(REVEAL_SELECTOR)] : root.querySelectorAll(REVEAL_SELECTOR);
    let i = 0;
    nodes.forEach(el => {
      if (seen.has(el) || el.closest("#modalRoot, #adminModalRoot, .modal-overlay, #toastRoot")) return;
      seen.add(el);
      el.classList.add("rv");
      el.style.setProperty("--rv-delay", `${Math.min(i++, 6) * 70}ms`);
      io.observe(el);
    });
  };

  document.documentElement.classList.add("rv-ready");
  register(document.body);

  // Contenido que se inyecta después (retos, publicaciones, vistas de admin…)
  new MutationObserver((mutations) => {
    mutations.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) register(n); }));
  }).observe(document.body, { childList: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initSpotlight();
  initScrollReveal();
});

// Exposición en espacio de nombres ECRA
window.ECRA = {
  auth,
  db,
  CHALLENGES,
  FORUM_CATEGORIES,
  FORUM_STATUSES,
  FORUM_TYPES,
  CONTRIBUTION_OPTIONS,
  ADMIN_EMAIL,
  CONTACT_PHONE,
  CONTACT_EMAIL,
  waitForAuth,
  nowISO,
  uid,
  initials,
  formatDate,
  formatDateShort,
  timeValue,
  escapeHTML,
  isConfiguredAdmin,
  ensureUserProfile,
  getCurrentProfile,
  requireParticipant,
  requireAdmin,
  showToast,
  signOutAndGoLogin,
  applyTheme,
  openModal,
  getUserChallengeStatus,
  setChallengeProgress,
  getRealCommunityMetrics
};
