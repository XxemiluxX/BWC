import "./app.js";
import {
  CHALLENGES,
  escapeHTML,
  showToast,
  openModal,
  getUserChallengeStatus,
  setChallengeProgress,
  waitForAuth
} from "./app.js";

let userChallengeMap = {};
let currentUser = null;

const STATUS_LABELS = {
  completed: { label: "Completado", class: "status-approved", icon: "✓" },
  in_progress: { label: "En progreso", class: "status-pending", icon: "⏳" },
  not_started: { label: "Por empezar", class: "status-neutral", icon: "○" }
};

function getChallengeStatus(challengeId) {
  if (!currentUser) return null;
  const item = userChallengeMap[challengeId];
  return item ? (item.status || "not_started") : "not_started";
}

function renderChallengeCard(c) {
  const status = getChallengeStatus(c.id);
  const statusInfo = status ? STATUS_LABELS[status] : null;

  return `
    <article class="challenge-card" data-id="${c.id}" data-category="${c.category}" data-difficulty="${c.difficulty}">
      <div>
        <div class="challenge-header">
          <div class="challenge-icon-box" aria-hidden="true">${c.icon}</div>
          <div class="challenge-badge-row">
            <span class="badge badge-difficulty">${c.difficulty}</span>
            <span class="badge badge-duration">⏱️ ${c.duration}</span>
            ${statusInfo ? `<span class="status-badge ${statusInfo.class}">${statusInfo.icon} ${statusInfo.label}</span>` : ""}
          </div>
        </div>

        <h3 class="challenge-title">${escapeHTML(c.title)}</h3>
        <p class="challenge-summary">${escapeHTML(c.summary)}</p>
      </div>

      <div class="challenge-footer">
        <span class="badge" style="background: var(--bg-surface-secondary); text-transform: none; font-size: 0.8rem; font-weight: 600;">
          ${escapeHTML(c.categoryLabel)}
        </span>
        <button class="btn btn-primary btn-sm" data-action="view-challenge" data-id="${c.id}" type="button">
          Ver detalles →
        </button>
      </div>
    </article>
  `;
}

export function openChallengeDetailModal(challengeId) {
  const c = CHALLENGES.find(item => item.id === challengeId);
  if (!c) return;

  const status = getChallengeStatus(c.id) || "not_started";
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";

  const checklistHTML = (c.concreteActions || []).map((action, idx) => `
    <label style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; cursor: pointer; font-size: 0.925rem; line-height: 1.5;">
      <input type="checkbox" style="margin-top: 4px; accent-color: var(--forest-600); width: 17px; height: 17px;" ${isCompleted ? "checked" : ""}>
      <span>${escapeHTML(action)}</span>
    </label>
  `).join("");

  let actionsHTML = "";
  if (currentUser) {
    actionsHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-lg); border-top: 1px solid var(--border-subtle); padding-top: var(--space-md);">
        ${!isCompleted ? `
          <button id="markCompleteBtn" class="btn btn-primary" type="button">
            ${isInProgress ? "✓ Marcar como completado" : "✓ He completado este reto"}
          </button>
        ` : `
          <button id="markInProgressBtn" class="btn btn-secondary btn-sm" type="button">
            Reabrir reto
          </button>
        `}

        ${!isInProgress && !isCompleted ? `
          <button id="startChallengeBtn" class="btn btn-secondary" type="button">
            ⏳ Marcar como en progreso
          </button>
        ` : ""}

        <a href="challenge.html?id=${c.id}" class="btn btn-ghost" style="margin-left: auto;">
          📷 Subir fotografía de evidencia
        </a>
      </div>
    `;
  } else {
    actionsHTML = `
      <div style="background-color: var(--bg-surface-secondary); border-radius: var(--radius-md); padding: var(--space-md); margin-top: var(--space-lg); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-sm);">
        <span style="font-size: 0.875rem; color: var(--text-secondary);">¿Quieres registrar tu progreso y acumular logros en este reto?</span>
        <div style="display: flex; gap: 8px;">
          <a href="login.html" class="btn btn-secondary btn-sm">Iniciar sesión</a>
          <a href="register.html" class="btn btn-primary btn-sm">Crear cuenta</a>
        </div>
      </div>
    `;
  }

  const modal = openModal(`
    <div class="modal-overlay" data-close-modal>
      <div class="modal-dialog" role="dialog" aria-labelledby="modalChallengeTitle">
        <div class="modal-header">
          <div>
            <span class="eyebrow">${c.icon} ${escapeHTML(c.categoryLabel)} · Dificultad: ${c.difficulty}</span>
            <h2 id="modalChallengeTitle" style="font-size: 1.55rem; margin-top: 4px;">${escapeHTML(c.title)}</h2>
          </div>
          <button class="modal-close-btn" data-close aria-label="Cerrar ventana">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div>
            <h4 style="margin-bottom: 6px;">📋 Instrucciones del reto</h4>
            <p>${escapeHTML(c.instruction)}</p>
          </div>

          <div style="background-color: var(--forest-50); border: 1px solid var(--forest-100); border-radius: var(--radius-md); padding: var(--space-md);">
            <h4 style="color: var(--tint-text); margin-bottom: 8px;">Paso a paso para realizarlo:</h4>
            ${checklistHTML}
          </div>

          <div>
            <h4 style="margin-bottom: 6px;">🌍 ¿Por qué es importante?</h4>
            <p class="text-muted" style="margin-bottom: 0;">${escapeHTML(c.whyItMatters)}</p>
          </div>

          ${actionsHTML}
        </div>
      </div>
    </div>
  `);

  // Eventos de botones dentro del modal
  modal.root.querySelector("#markCompleteBtn")?.addEventListener("click", async () => {
    try {
      await setChallengeProgress(currentUser.id, c.id, "completed");
      showToast(`¡Excelente trabajo! Has completado: "${c.title}"`, "success");
      modal.close();
      await refreshState();
    } catch (err) {
      console.error(err);
      showToast("No se pudo actualizar el estado. Revisa tu conexión.", "error");
    }
  });

  modal.root.querySelector("#startChallengeBtn")?.addEventListener("click", async () => {
    try {
      await setChallengeProgress(currentUser.id, c.id, "in_progress");
      showToast(`Reto iniciado: "${c.title}". ¡Mucho éxito!`, "info");
      modal.close();
      await refreshState();
    } catch (err) {
      console.error(err);
      showToast("No se pudo iniciar el reto.", "error");
    }
  });

  modal.root.querySelector("#markInProgressBtn")?.addEventListener("click", async () => {
    try {
      await setChallengeProgress(currentUser.id, c.id, "in_progress");
      showToast("El reto vuelve a estar en progreso.");
      modal.close();
      await refreshState();
    } catch (err) {
      console.error(err);
      showToast("No se pudo cambiar el estado.", "error");
    }
  });
}

function filterChallenges() {
  const searchTerm = (document.getElementById("challengeSearch")?.value || "").trim().toLowerCase();
  const categoryFilter = document.getElementById("categoryFilter")?.value || "all";
  const difficultyFilter = document.getElementById("difficultyFilter")?.value || "all";
  const grid = document.getElementById("challengesGrid");
  const noResults = document.getElementById("noResults");

  if (!grid) return;

  const filtered = CHALLENGES.filter(c => {
    const matchesSearch = !searchTerm ||
      c.title.toLowerCase().includes(searchTerm) ||
      c.instruction.toLowerCase().includes(searchTerm) ||
      c.summary.toLowerCase().includes(searchTerm) ||
      c.categoryLabel.toLowerCase().includes(searchTerm);

    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    const matchesDifficulty = difficultyFilter === "all" || c.difficulty === difficultyFilter;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    noResults?.style.setProperty("display", "block");
  } else {
    noResults?.style.setProperty("display", "none");
    grid.innerHTML = filtered.map(renderChallengeCard).join("");
  }

  // Vincular clics en las tarjetas
  grid.querySelectorAll("[data-action='view-challenge']").forEach(btn => {
    btn.addEventListener("click", () => openChallengeDetailModal(btn.dataset.id));
  });
}

async function refreshState() {
  if (currentUser) {
    userChallengeMap = await getUserChallengeStatus(currentUser.id);
  }
  filterChallenges();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const initialCategory = params.get("cat");
  if (initialCategory) {
    const catSelect = document.getElementById("categoryFilter");
    if (catSelect && catSelect.querySelector(`option[value="${initialCategory}"]`)) {
      catSelect.value = initialCategory;
    }
  }

  const user = await waitForAuth();
  if (user) {
    currentUser = { id: user.uid, email: user.email, name: user.displayName };
    const banner = document.getElementById("authStatusBanner");
    if (banner) banner.style.display = "flex";
    userChallengeMap = await getUserChallengeStatus(user.uid);
  }

  filterChallenges();

  document.getElementById("challengeSearch")?.addEventListener("input", filterChallenges);
  document.getElementById("categoryFilter")?.addEventListener("change", filterChallenges);
  document.getElementById("difficultyFilter")?.addEventListener("change", filterChallenges);

  document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
    const searchInput = document.getElementById("challengeSearch");
    const catSelect = document.getElementById("categoryFilter");
    const diffSelect = document.getElementById("difficultyFilter");
    if (searchInput) searchInput.value = "";
    if (catSelect) catSelect.value = "all";
    if (diffSelect) diffSelect.value = "all";
    filterChallenges();
  });
}

document.addEventListener("DOMContentLoaded", init);
