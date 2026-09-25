// Punto de entrada compartido. Los datos de la demo viven en localStorage.
// PARA PRODUCCIÓN: reemplazar DataStore/AuthDemo por Firebase Authentication,
// Firestore y Storage. Nunca usar localStorage para credenciales reales.
const DB_KEY = "bwc_demo_db_v1";
const SESSION_KEY = "bwc_demo_session_v1";

const CHALLENGES = [
  {
    id: "challenge-1", number: 1, title: "Cuida tu entorno", shortTitle: "CUIDA TU ENTORNO",
    instruction: "Realiza una acción que ayude a mantener limpio tu entorno. Puede ser recoger residuos de un espacio público, clasificar correctamente los residuos o realizar otra acción positiva para el ambiente.",
    icon: "♻️"
  },
  {
    id: "challenge-2", number: 2, title: "Una acción por el planeta", shortTitle: "UNA ACCIÓN POR EL PLANETA",
    instruction: "Realiza una acción que contribuya al cuidado del planeta. Por ejemplo, ahorrar agua, reutilizar materiales, evitar desperdicios o realizar una acción sostenible.",
    icon: "🌎"
  },
  {
    id: "challenge-3", number: 3, title: "Mejora tu comunidad", shortTitle: "MEJORA TU COMUNIDAD",
    instruction: "Realiza una acción positiva que ayude a mejorar tu comunidad o motive a otras personas a cuidarla.",
    icon: "💚"
  }
];

const DEMO_IMAGES = {
  "challenge-1": "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="100%" height="100%" fill="#dfeee3"/><circle cx="450" cy="235" r="130" fill="#7bad88"/><path d="M210 470 Q450 360 690 470" fill="none" stroke="#47765a" stroke-width="38"/><text x="450" y="540" text-anchor="middle" font-family="Arial" font-size="32" fill="#24553b">Evidencia demo · entorno</text></svg>`),
  "challenge-2": "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="100%" height="100%" fill="#eef6e9"/><circle cx="450" cy="250" r="145" fill="#65a97a"/><circle cx="392" cy="215" r="35" fill="#dcefd5"/><circle cx="505" cy="310" r="28" fill="#dcefd5"/><text x="450" y="540" text-anchor="middle" font-family="Arial" font-size="32" fill="#24553b">Evidencia demo · planeta</text></svg>`),
  "challenge-3": "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="100%" height="100%" fill="#f1e8df"/><path d="M120 430 Q450 170 780 430" fill="none" stroke="#977354" stroke-width="55"/><circle cx="330" cy="275" r="80" fill="#65a97a"/><circle cx="585" cy="275" r="80" fill="#7db990"/><text x="450" y="540" text-anchor="middle" font-family="Arial" font-size="32" fill="#5f4936">Evidencia demo · comunidad</text></svg>`)
};

function nowISO() { return new Date().toISOString(); }
function uid(prefix = "id") { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function initials(name = "") { return name.trim().split(/\s+/).map(p => p[0]).slice(0,2).join("").toUpperCase() || "U"; }
function formatDate(date) { return new Intl.DateTimeFormat("es-CR", {dateStyle:"medium", timeStyle:"short"}).format(new Date(date)); }

function createInitialDB() {
  return {
    version: 1,
    users: [
      {id:"demo_ashley", name:"Ashley", email:"ashley@demo.local", passwordHash:"demo", role:"participant", currentChallenge:2, completed:1, createdAt:"2026-09-20T14:00:00Z"},
      {id:"demo_daniel", name:"Daniel", email:"daniel@demo.local", passwordHash:"demo", role:"participant", currentChallenge:1, completed:0, createdAt:"2026-09-18T15:30:00Z"},
      {id:"demo_sofia", name:"Sofía", email:"sofia@demo.local", passwordHash:"demo", role:"participant", currentChallenge:3, completed:2, createdAt:"2026-09-17T13:25:00Z"},
      {id:"demo_mateo", name:"Mateo", email:"mateo@demo.local", passwordHash:"demo", role:"participant", currentChallenge:4, completed:3, createdAt:"2026-09-15T17:10:00Z"}
    ],
    evidences: [
      {id:"ev_demo_1", userId:"demo_ashley", userName:"Ashley", challengeId:"challenge-1", challengeNumber:1, image:DEMO_IMAGES["challenge-1"], submittedAt:"2026-09-21T16:40:00Z", status:"approved", moderatorComment:"Evidencia aprobada. ¡Buen trabajo!", reviewedAt:"2026-09-21T17:10:00Z"},
      {id:"ev_demo_2", userId:"demo_ashley", userName:"Ashley", challengeId:"challenge-2", challengeNumber:2, image:DEMO_IMAGES["challenge-2"], submittedAt:"2026-09-24T00:20:00Z", status:"pending", moderatorComment:""},
      {id:"ev_demo_3", userId:"demo_sofia", userName:"Sofía", challengeId:"challenge-1", challengeNumber:1, image:DEMO_IMAGES["challenge-1"], submittedAt:"2026-09-19T13:00:00Z", status:"approved", moderatorComment:"", reviewedAt:"2026-09-19T13:20:00Z"},
      {id:"ev_demo_4", userId:"demo_sofia", userName:"Sofía", challengeId:"challenge-2", challengeNumber:2, image:DEMO_IMAGES["challenge-2"], submittedAt:"2026-09-20T12:00:00Z", status:"approved", moderatorComment:"", reviewedAt:"2026-09-20T12:30:00Z"},
      {id:"ev_demo_5", userId:"demo_sofia", userName:"Sofía", challengeId:"challenge-3", challengeNumber:3, image:DEMO_IMAGES["challenge-3"], submittedAt:"2026-09-23T12:00:00Z", status:"rejected", moderatorComment:"La evidencia necesita una fotografía que muestre mejor la acción realizada.", reviewedAt:"2026-09-23T13:00:00Z"}
    ]
  };
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const db = createInitialDB();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
  try { return JSON.parse(raw); }
  catch { const db = createInitialDB(); localStorage.setItem(DB_KEY, JSON.stringify(db)); return db; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function resetDB() { localStorage.removeItem(DB_KEY); loadDB(); }

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function setSession(userId, role = "participant") {
  localStorage.setItem(SESSION_KEY, JSON.stringify({userId, role, createdAt:nowISO()}));
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getCurrentUser() {
  const s = getSession(); if (!s) return null;
  return loadDB().users.find(u => u.id === s.userId) || null;
}
function requireParticipant() {
  const session = getSession();
  if (!session || session.role !== "participant") { window.location.href = "login.html"; return null; }
  return getCurrentUser();
}
function requireAdmin() {
  const session = getSession();
  if (!session || session.role !== "admin") { window.location.href = "login.html"; return null; }
  return session;
}

function latestEvidence(userId, challengeId) {
  const all = loadDB().evidences.filter(e => e.userId === userId && e.challengeId === challengeId);
  return all.sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function showToast(message) {
  const root = document.getElementById("toastRoot"); if (!root) return;
  const item = document.createElement("div"); item.className = "toast"; item.textContent = message;
  root.appendChild(item); setTimeout(() => item.remove(), 3200);
}

function logout() { clearSession(); window.location.href = "login.html"; }
function wireLogout() { document.querySelectorAll("#logoutBtn,#adminLogoutBtn").forEach(btn => btn.addEventListener("click", logout)); }

window.BWC = {CHALLENGES, DEMO_IMAGES, loadDB, saveDB, resetDB, nowISO, uid, initials, formatDate, getSession, setSession, clearSession, getCurrentUser, requireParticipant, requireAdmin, latestEvidence, escapeHTML, showToast, logout, wireLogout};
wireLogout();
