// Consentimiento de cookies de ECRA.
//
// - Esenciales: siempre activas (sesión, tema claro/oscuro y esta misma elección).
// - Analítica (Google Analytics a través de Firebase): solo después de aceptarla.
//
// Cualquier elemento con el atributo data-cookie-prefs abre el panel de preferencias.
// La elección se guarda en localStorage con la clave ecra_cookie_consent_v1.

const STORAGE_KEY = "ecra_cookie_consent_v1";
const POLICY_URL = "cookies.html";

const listeners = new Set();
let state = readStored();
let root = null;
let lastFocus = null;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.analytics === "boolean") return parsed;
  } catch (error) {
    // Almacenamiento bloqueado o dato dañado: se trata como "sin elección".
  }
  return null;
}

function notify() {
  const allowed = state ? state.analytics : false;
  listeners.forEach(callback => {
    try { callback(allowed); } catch (error) { console.error(error); }
  });
}

function setConsent(analytics) {
  state = { analytics, ts: Date.now(), v: 1 };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* sin almacenamiento */ }
  if (!analytics) clearAnalyticsCookies();
  notify();
}

/* ---------- API pública ---------- */

export function getConsent() {
  return state ? { ...state } : null;
}

export function hasAnalyticsConsent() {
  return state?.analytics === true;
}

export function onConsentChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Se resuelve cuando la persona acepta la analítica (de inmediato si ya la había aceptado).
export function whenAnalyticsAllowed() {
  if (hasAnalyticsConsent()) return Promise.resolve();
  return new Promise(resolve => {
    const stop = onConsentChange(allowed => {
      if (allowed) { stop(); resolve(); }
    });
  });
}

// Borra las cookies de Google Analytics (_ga, _ga_XXXX, _gid, _gat) en el dominio actual y sus padres.
export function clearAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map(item => item.split("=")[0].trim())
    .filter(name => name === "_ga" || name === "_gid" || name.startsWith("_ga_") || name.startsWith("_gat"));
  if (!names.length) return;

  const host = location.hostname;
  const parts = host.split(".");
  const domains = [null, host, "." + host];
  for (let i = 1; i < parts.length - 1; i++) domains.push("." + parts.slice(i).join("."));

  names.forEach(name => {
    domains.forEach(domain => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (domain ? `; domain=${domain}` : "");
    });
  });
}

export function openPreferences() {
  lastFocus = document.activeElement;
  ensureBanner();
  root.querySelector("#cookieAnalytics").checked = hasAnalyticsConsent();
  showView("prefs");
  root.hidden = false;
  root.querySelector('[data-view="prefs"] input:not([disabled])')?.focus();
}

/* ---------- Banner ---------- */

function ensureBanner() {
  if (root) return root;

  root = document.createElement("section");
  root.className = "cookie-banner";
  root.id = "cookieBanner";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "false");
  root.setAttribute("aria-labelledby", "cookieTitle");
  root.hidden = true;
  root.innerHTML = `
    <div class="cookie-view" data-view="main">
      <h2 class="cookie-title" id="cookieTitle">Cookies en ECRA</h2>
      <p class="cookie-text">
        Usamos almacenamiento esencial para que el sitio funcione. Con tu permiso, también usamos cookies de
        analítica para saber qué páginas se visitan y mejorarlas. Puedes cambiar tu decisión cuando quieras.
      </p>
      <div class="cookie-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-cookie-action="reject">Solo esenciales</button>
        <button type="button" class="btn btn-primary btn-sm" data-cookie-action="accept">Aceptar analítica</button>
      </div>
      <div class="cookie-links">
        <button type="button" class="cookie-link" data-cookie-action="customize">Personalizar</button>
        <a class="cookie-link" href="${POLICY_URL}">Política de cookies</a>
      </div>
    </div>

    <div class="cookie-view" data-view="prefs" hidden>
      <h2 class="cookie-title">Preferencias de cookies</h2>
      <label class="cookie-option">
        <input type="checkbox" checked disabled>
        <span><strong>Esenciales</strong>Mantienen tu sesión, recuerdan el tema claro u oscuro y guardan esta elección. Siempre activas.</span>
      </label>
      <label class="cookie-option">
        <input type="checkbox" id="cookieAnalytics">
        <span><strong>Analítica</strong>Google Analytics mide de forma agregada qué páginas se usan. Solo se carga si la activas.</span>
      </label>
      <div class="cookie-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-cookie-action="back">Cancelar</button>
        <button type="button" class="btn btn-primary btn-sm" data-cookie-action="save">Guardar preferencias</button>
      </div>
      <div class="cookie-links">
        <a class="cookie-link" href="${POLICY_URL}">Política de cookies</a>
      </div>
    </div>`;

  root.addEventListener("click", event => {
    const action = event.target.closest("[data-cookie-action]")?.dataset.cookieAction;
    if (!action) return;
    if (action === "accept") { setConsent(true); closeBanner(); }
    else if (action === "reject") { setConsent(false); closeBanner(); }
    else if (action === "customize") {
      root.querySelector("#cookieAnalytics").checked = hasAnalyticsConsent();
      showView("prefs");
      root.querySelector('[data-view="prefs"] input:not([disabled])')?.focus();
    }
    else if (action === "save") { setConsent(root.querySelector("#cookieAnalytics").checked); closeBanner(); }
    else if (action === "back") { state ? closeBanner() : showView("main"); }
  });

  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && state) closeBanner();
  });

  document.body.appendChild(root);
  return root;
}

function showView(name) {
  root.querySelectorAll("[data-view]").forEach(view => { view.hidden = view.dataset.view !== name; });
}

function closeBanner() {
  if (!root) return;
  root.hidden = true;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

/* ---------- Inicio ---------- */

function init() {
  document.addEventListener("click", event => {
    const trigger = event.target.closest?.("[data-cookie-prefs]");
    if (!trigger) return;
    event.preventDefault();
    openPreferences();
  });

  // Mantiene sincronizadas varias pestañas abiertas del sitio.
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY) return;
    state = readStored();
    if (state && root) root.hidden = true;
    if (state && !state.analytics) clearAnalyticsCookies();
    notify();
  });

  if (!state) {
    ensureBanner();
    showView("main");
    root.hidden = false;
  }
}

window.ecraOpenCookiePreferences = openPreferences;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
