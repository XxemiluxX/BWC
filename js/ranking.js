import "./app.js";
import { CHALLENGES, escapeHTML, initials, waitForAuth } from "./app.js";
import { db } from "./firebase-client.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MAX_LIST = 20;

const CATEGORY_CHIPS = [
  { id: "all", label: "General", icon: "🏆" },
  { id: "waste", label: "Reciclaje y residuos", icon: "♻️" },
  { id: "water", label: "Agua y nacientes", icon: "💧" },
  { id: "wildlife", label: "Flora y fauna", icon: "🦋" },
  { id: "energy", label: "Ahorro de energía", icon: "⚡" },
  { id: "community", label: "Espacios públicos", icon: "🧤" },
  { id: "consumption", label: "Consumo responsable", icon: "🛍️" },
  { id: "education", label: "Educación ambiental", icon: "📚" }
];

// Niveles según retos completados (se muestran en la tarjeta lateral)
const LEVELS = [
  { min: 15, label: "Bosque", icon: "🌲" },
  { min: 8, label: "Árbol", icon: "🌳" },
  { min: 3, label: "Brote", icon: "🌿" },
  { min: 1, label: "Semilla", icon: "🌱" }
];

const state = {
  category: "all",
  participants: [],
  myUid: null,
  loaded: false
};

const $ = (id) => document.getElementById(id);

function levelFor(count) {
  return LEVELS.find(l => count >= l.min) || null;
}

// Privacidad: nombre de pila + inicial del primer apellido ("Ana Mora Rojas" → "Ana M.")
function publicName(name = "") {
  const clean = String(name).includes("@") ? String(name).split("@")[0] : String(name);
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Participante";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

/* ------------------------------ Datos ------------------------------ */

async function loadData() {
  const [doneSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db, "user_challenges"), where("status", "==", "completed"))),
    getDocs(collection(db, "users"))
  ]);

  const catalogIds = new Set(CHALLENGES.map(c => c.id));
  const users = new Map();
  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.role === "admin") return;
    users.set(d.id, { uid: d.id, name: data.name || data.email || "", done: new Set() });
  });

  // Un reto cuenta una sola vez por persona, aunque haya más de un registro
  doneSnap.docs.forEach(d => {
    const { userId, challengeId } = d.data();
    const person = users.get(userId);
    if (person && catalogIds.has(challengeId)) person.done.add(challengeId);
  });

  state.participants = [...users.values()];
}

function buildBoard(category) {
  const scoped = CHALLENGES.filter(c => category === "all" || c.category === category);
  const ids = new Set(scoped.map(c => c.id));

  const rows = state.participants
    .map(p => ({
      uid: p.uid,
      name: publicName(p.name),
      count: [...p.done].filter(id => ids.has(id)).length
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  // Empates comparten posición (1, 1, 3…)
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].count === r.count ? rows[i - 1].rank : i + 1;
  });

  const popularity = scoped
    .map(c => ({
      challenge: c,
      count: state.participants.filter(p => p.done.has(c.id)).length
    }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count || a.challenge.number - b.challenge.number);

  return {
    rows,
    popularity,
    total: scoped.length,
    totalDone: rows.reduce((sum, r) => sum + r.count, 0)
  };
}

/* ------------------------------ Vistas ------------------------------ */

function renderFilters() {
  $("rankFilters").innerHTML = CATEGORY_CHIPS.map(c => `
    <button type="button" class="chip-filter ${c.id === state.category ? "active" : ""}"
            data-cat="${c.id}" aria-pressed="${c.id === state.category}">
      <span aria-hidden="true">${c.icon}</span> ${escapeHTML(c.label)}
    </button>
  `).join("");
}

function renderStats(board) {
  const top = board.popularity[0];
  $("rankStats").innerHTML = `
    <div class="card rank-stat">
      <span class="rank-stat-label">Participantes con retos</span>
      <span class="rank-stat-value">${board.rows.length}</span>
      <span class="rank-stat-note">${board.rows.length === 0 ? "Aún nadie en esta categoría" : "Con al menos un reto aprobado"}</span>
    </div>
    <div class="card rank-stat">
      <span class="rank-stat-label">Retos completados</span>
      <span class="rank-stat-value">${board.totalDone}</span>
      <span class="rank-stat-note">Sumando a toda la comunidad</span>
    </div>
    <div class="card rank-stat">
      <span class="rank-stat-label">Reto más realizado</span>
      ${top ? `
        <span class="rank-stat-value rank-stat-text"><span aria-hidden="true">${top.challenge.icon}</span> ${escapeHTML(top.challenge.shortTitle)}</span>
        <span class="rank-stat-note">${top.count} ${plural(top.count, "persona lo completó", "personas lo completaron")}</span>
      ` : `
        <span class="rank-stat-value rank-stat-text">—</span>
        <span class="rank-stat-note">Todavía sin datos</span>
      `}
    </div>
  `;
}

function avatar(name, large = false) {
  return `<span class="rank-avatar ${large ? "rank-avatar-lg" : ""}" aria-hidden="true">${escapeHTML(initials(name))}</span>`;
}

function levelChip(count) {
  const lv = levelFor(count);
  return lv ? `<span class="rank-level"><span aria-hidden="true">${lv.icon}</span> ${lv.label}</span>` : "";
}

function renderPodium(rows) {
  const top = rows.slice(0, 3);
  if (!top.length) return "";
  return `
    <ol class="podium" aria-label="Los tres primeros lugares">
      ${top.map(r => {
        const place = Math.min(r.rank, 3);
        return `
        <li class="card podium-card place-${place} ${r.uid === state.myUid ? "is-me" : ""}">
          <span class="rank-medal medal-${place}" aria-label="Posición ${r.rank}">${r.rank}</span>
          ${avatar(r.name, true)}
          <div class="podium-who">
            <strong class="podium-name">${escapeHTML(r.name)}${r.uid === state.myUid ? " (tú)" : ""}</strong>
            ${levelChip(r.count)}
          </div>
          <div class="podium-score"><b>${r.count}</b><span>${plural(r.count, "reto", "retos")}</span></div>
        </li>`;
      }).join("")}
    </ol>
  `;
}

function renderList(rows, total) {
  const rest = rows.slice(3, MAX_LIST);
  if (!rest.length) return "";
  return `
    <section class="card rank-board" aria-labelledby="rankListTitle">
      <h2 id="rankListTitle" class="rank-board-title">Posiciones ${rows[3].rank} a ${rest[rest.length - 1].rank}</h2>
      <ol class="rank-list" start="4">
        ${rest.map(r => `
          <li class="rank-row ${r.uid === state.myUid ? "is-me" : ""}">
            <span class="rank-pos">${r.rank}</span>
            ${avatar(r.name)}
            <div class="rank-who">
              <div class="rank-who-top">
                <strong>${escapeHTML(r.name)}${r.uid === state.myUid ? " (tú)" : ""}</strong>
                ${levelChip(r.count)}
              </div>
              <div class="rank-bar" role="img" aria-label="${r.count} de ${total} retos">
                <span style="width: ${Math.max(4, Math.round((r.count / total) * 100))}%"></span>
              </div>
            </div>
            <span class="rank-count"><b>${r.count}</b> ${plural(r.count, "reto", "retos")}</span>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderMe(board) {
  if (!state.loaded) return "";
  if (!state.myUid) {
    return `
      <div class="card rank-me">
        <div>
          <strong>¿Dónde quedarías tú?</strong>
          <p>Inicia sesión para ver tu posición y empezar a sumar retos.</p>
        </div>
        <a class="btn btn-primary btn-sm" href="login.html?returnUrl=${encodeURIComponent("ranking.html")}">Iniciar sesión</a>
      </div>`;
  }
  const mine = board.rows.find(r => r.uid === state.myUid);
  if (mine) {
    return `
      <div class="card rank-me is-me">
        <div>
          <strong>Tu posición: #${mine.rank}</strong>
          <p>${mine.count} de ${board.total} ${plural(board.total, "reto completado", "retos completados")}.</p>
        </div>
        <a class="btn btn-secondary btn-sm" href="challenges.html">Seguir con retos →</a>
      </div>`;
  }
  const isParticipant = state.participants.some(p => p.uid === state.myUid);
  if (!isParticipant) return "";
  return `
    <div class="card rank-me">
      <div>
        <strong>Todavía no estás en la clasificación</strong>
        <p>Completa un reto con evidencia aprobada para aparecer aquí.</p>
      </div>
      <a class="btn btn-primary btn-sm" href="challenges.html">Elegir un reto →</a>
    </div>`;
}

function renderEmpty() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">🌱</div>
      <h3>Aún no hay retos completados aquí</h3>
      <p class="text-muted">Los retos cuentan cuando un moderador aprueba tu evidencia. Puedes ser la primera persona en esta lista.</p>
      <a class="btn btn-primary btn-sm" href="challenges.html" style="margin-top: var(--space-sm);">Ver retos disponibles</a>
    </div>`;
}

function renderAside(board) {
  const topChallenges = board.popularity.slice(0, 5);
  const max = topChallenges[0]?.count || 1;
  $("rankAside").innerHTML = `
    <section class="card" aria-labelledby="popTitle">
      <h2 id="popTitle" class="aside-title">Retos más completados</h2>
      ${topChallenges.length ? `
        <ul class="pop-list">
          ${topChallenges.map(({ challenge, count }) => `
            <li>
              <span class="pop-icon" aria-hidden="true">${challenge.icon}</span>
              <div class="pop-body">
                <div class="pop-top"><span class="pop-name">${escapeHTML(challenge.shortTitle)}</span><b>${count}</b></div>
                <div class="rank-bar"><span style="width: ${Math.round((count / max) * 100)}%"></span></div>
              </div>
            </li>`).join("")}
        </ul>` : `<p class="text-muted" style="font-size: 0.9rem;">Cuando haya retos aprobados, aquí verás cuáles son los favoritos.</p>`}
    </section>

    <section class="card" aria-labelledby="levelsTitle">
      <h2 id="levelsTitle" class="aside-title">Niveles</h2>
      <ul class="level-list">
        ${[...LEVELS].reverse().map(l => `
          <li><span aria-hidden="true">${l.icon}</span><strong>${l.label}</strong><span class="text-muted">${l.min}+ ${plural(l.min, "reto", "retos")}</span></li>
        `).join("")}
      </ul>
    </section>
  `;
}

function render() {
  const board = buildBoard(state.category);
  renderFilters();
  renderStats(board);
  renderAside(board);

  $("rankMain").innerHTML = board.rows.length
    ? `${renderMe(board)}${renderPodium(board.rows)}${renderList(board.rows, board.total)}`
    : `${renderMe(board)}${renderEmpty()}`;
}

function renderLoading() {
  $("rankStats").innerHTML = "";
  $("rankAside").innerHTML = "";
  $("rankMain").innerHTML = `
    <div class="card" aria-busy="true">
      <div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>
    </div>`;
}

function renderError() {
  $("rankMain").innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">⚠️</div>
      <h3>No pudimos cargar la clasificación</h3>
      <p class="text-muted">Revisa tu conexión e inténtalo de nuevo.</p>
      <button id="rankRetry" class="btn btn-secondary btn-sm" type="button" style="margin-top: var(--space-sm);">Reintentar</button>
    </div>`;
  $("rankRetry")?.addEventListener("click", init);
}

async function init() {
  renderFilters();
  renderLoading();
  try {
    const [user] = await Promise.all([waitForAuth(), loadData()]);
    state.myUid = user?.uid || null;
    state.loaded = true;
    render();
  } catch (err) {
    console.error("Error al cargar la clasificación:", err);
    renderError();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("rankFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn || !state.loaded) return;
    state.category = btn.dataset.cat;
    render();
  });
  init();
});
