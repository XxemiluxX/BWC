import { auth, db, storage } from "./firebase-client.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const THEME_KEY = "bwc_theme_v2";
const ADMIN_EMAIL = "mongemoraemiliano60@gmail.com";

export const CHALLENGES = [
  {
    id: "challenge-1", number: 1, title: "Cuida tu entorno", shortTitle: "CUIDA TU ENTORNO",
    instruction: "Realiza una acción que ayude a mantener limpio tu entorno. Puede ser recoger residuos de un espacio público, clasificar correctamente los residuos o realizar otra acción positiva para el ambiente.", icon: "♻️"
  },
  {
    id: "challenge-2", number: 2, title: "Una acción por el planeta", shortTitle: "UNA ACCIÓN POR EL PLANETA",
    instruction: "Realiza una acción que contribuya al cuidado del planeta. Por ejemplo, ahorrar agua, reutilizar materiales, evitar desperdicios o realizar una acción sostenible.", icon: "🌎"
  },
  {
    id: "challenge-3", number: 3, title: "Mejora tu comunidad", shortTitle: "MEJORA TU COMUNIDAD",
    instruction: "Realiza una acción positiva que ayude a mejorar tu comunidad o motive a otras personas a cuidarla.", icon: "💚"
  }
];

const authReady = new Promise(resolve => {
  const stop = onAuthStateChanged(auth, user => { stop(); resolve(user || null); });
});

async function waitForAuth() { return authReady; }

function nowISO() { return new Date().toISOString(); }
function uid(prefix = "id") { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function initials(name = "") { return name.trim().split(/\s+/).map(p => p[0]).slice(0,2).join("").toUpperCase() || "U"; }
function formatDate(date) {
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function normalize(value = "") { return String(value).trim().toLowerCase(); }

function isConfiguredAdmin(userOrProfile) {
  const email = normalize(userOrProfile?.email || "");
  return email === normalize(ADMIN_EMAIL);
}

async function ensureUserProfile(user, preferredName = "") {
  if (!user?.uid) return null;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const admin = isConfiguredAdmin(user);

  if (!snap.exists()) {
    const profile = {
      firebaseUid: user.uid,
      name: preferredName || user.displayName || user.email?.split("@")[0] || "Usuario",
      email: user.email || "",
      role: admin ? "admin" : "participant",
      currentChallenge: 1,
      completed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, profile);
    return { id: user.uid, ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  const existing = snap.data();
  const patch = { updatedAt: serverTimestamp() };
  if (preferredName || user.displayName) patch.name = preferredName || user.displayName;
  if (user.email) patch.email = user.email;
  if (admin && existing.role !== "admin") patch.role = "admin";
  if (Object.keys(patch).length > 1 || admin && existing.role !== "admin") await updateDoc(ref, patch);

  return { id: user.uid, ...existing, ...patch, role: admin ? "admin" : (patch.role || existing.role) };
}

async function getCurrentProfile() {
  const user = await waitForAuth();
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return ensureUserProfile(user);
  const data = snap.data();
  return { id: snap.id, ...data };
}

async function requireParticipant() {
  const user = await waitForAuth();
  if (!user) { window.location.href = "login.html"; return null; }
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "admin") {
    window.location.href = profile?.role === "admin" ? "admin.html" : "login.html";
    return null;
  }
  return profile;
}

async function requireAdmin() {
  const user = await waitForAuth();
  if (!user) { window.location.href = "login.html"; return null; }
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") { window.location.href = "profile.html"; return null; }
  return { user, profile };
}

async function signOutAndGoLogin() {
  try { await signOut(auth); } finally { window.location.href = "login.html"; }
}

function showToast(message) {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = document.createElement("div"); root.id = "toastRoot"; root.className = "toast-root"; document.body.appendChild(root);
  }
  const item = document.createElement("div"); item.className = "toast"; item.textContent = message;
  root.appendChild(item); setTimeout(() => item.remove(), 3200);
}

function applyTheme(theme) {
  if (!document.body.classList.contains("landing")) return;
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", theme === "dark" ? "Activar modo claro" : "Activar modo oscuro");
    btn.title = theme === "dark" ? "Modo claro" : "Modo oscuro";
  });
}
function initTheme() {
  if (!document.body.classList.contains("landing")) return;
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  applyTheme(stored || preferred);
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next); applyTheme(next);
    });
  });
}

function wireLogout() {
  document.querySelectorAll("#logoutBtn,#adminLogoutBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await signOutAndGoLogin(); } catch { btn.disabled = false; }
    });
  });
}

onAuthStateChanged(auth, async user => {
  window.BWC_AUTH_USER = user || null;
  if (user) {
    try { window.BWC_PROFILE = await ensureUserProfile(user); } catch (error) { console.error("No se pudo sincronizar el perfil:", error); }
  } else {
    window.BWC_PROFILE = null;
  }
});

document.addEventListener("DOMContentLoaded", () => { initTheme(); wireLogout(); });

window.BWC = {
  auth, db, CHALLENGES, ADMIN_EMAIL, waitForAuth,
  nowISO, uid, initials, formatDate, escapeHTML,
  isConfiguredAdmin, ensureUserProfile, getCurrentProfile,
  requireParticipant, requireAdmin, showToast, signOutAndGoLogin,
  applyTheme
};
