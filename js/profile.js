import "./app.js";
import { auth, db } from "./firebase-client.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { cosmeticsFromUser, titleChipHTML, FRAMES } from "./missions-data.js";

const {
  CHALLENGES,
  FORUM_CATEGORIES,
  FORUM_STATUSES,
  CONTRIBUTION_OPTIONS,
  requireParticipant,
  formatDate,
  formatDateShort,
  escapeHTML,
  showToast,
  initials,
  openModal,
  isConfiguredAdmin,
  nowISO,
  setChallengeProgress,
  getUserChallengeStatus
} = window.ECRA;

let currentUser = null;
let userChallengesMap = {};
let userPosts = [];
let userCollabs = [];
let userEvidences = [];

function timeValue(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function evidenceStatusBadge(status) {
  if (status === "approved") {
    return `<span class="status-badge status-approved">Aprobada</span>`;
  }
  if (status === "rejected") {
    return `<span class="status-badge status-rejected">Requiere ajustes</span>`;
  }
  return `<span class="status-badge status-pending">En revisión</span>`;
}

// Inicializar pestañas
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;

      tabBtns.forEach(b => {
        const isActive = b === btn;
        b.classList.toggle("active", isActive);
        b.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      tabPanels.forEach(panel => {
        const isMatch = panel.id === `panel-${target}`;
        panel.classList.toggle("active", isMatch);
      });
    });
  });

  // Leer hash de URL si existe (ej: #posts)
  const hash = window.location.hash.replace("#", "").replace("tab-", "");
  if (hash) {
    const targetBtn = document.querySelector(`.tab-btn[data-target="${hash}"]`);
    if (targetBtn) targetBtn.click();
  }
}

// Modal para editar perfil
function openEditProfileModal() {
  if (!currentUser) return;

  const modal = openModal(`
    <div class="modal-header">
      <div>
        <span class="eyebrow">MI CUENTA ECRA</span>
        <h2>Editar nombre de perfil</h2>
      </div>
      <button class="modal-close-btn" data-close type="button">✕</button>
    </div>

    <form id="editProfileForm">
      <div class="form-group">
        <label class="form-label" for="editNameInput">Nombre público visible *</label>
        <input class="form-input" id="editNameInput" type="text" value="${escapeHTML(currentUser.name || "")}" required minlength="2" maxlength="60">
        <span class="form-helper">Este es el nombre con el que aparecerás en misiones, iniciativas y comentarios.</span>
      </div>

      <div class="form-group">
        <label class="form-label">Correo electrónico</label>
        <input class="form-input" type="email" value="${escapeHTML(currentUser.email || "")}" disabled style="opacity: 0.7; cursor: not-allowed;">
        <span class="form-helper">El correo está vinculado a tu cuenta y no puede modificarse directamente.</span>
      </div>

      <div id="editProfileMsg" class="form-message" role="status"></div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg);">
        <button class="btn btn-ghost" data-close type="button">Cancelar</button>
        <button class="btn btn-primary" type="submit">Guardar cambios</button>
      </div>
    </form>
  `);

  const form = modal.root.querySelector("#editProfileForm");
  const msg = modal.root.querySelector("#editProfileMsg");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newName = form.querySelector("#editNameInput").value.trim();
    if (!newName || newName.length < 2) {
      msg.className = "form-message error";
      msg.textContent = "Por favor ingresa un nombre válido de al menos 2 letras.";
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";

    try {
      await updateDoc(doc(db, "users", currentUser.id), {
        name: newName,
        updatedAt: nowISO()
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName });
      }

      currentUser.name = newName;
      modal.close();
      showToast("Nombre actualizado exitosamente.");
      updateHeroCard();
    } catch (err) {
      console.error("Error al actualizar perfil:", err);
      msg.className = "form-message error";
      msg.textContent = "No se pudieron guardar los cambios. Intenta de nuevo.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar cambios";
    }
  });
}

function updateHeroCard() {
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const avatarEl = document.getElementById("profileAvatar");
  const roleBadgeEl = document.getElementById("roleBadge");
  const adminBtn = document.getElementById("adminLinkBtn");
  const joinedEl = document.getElementById("profileJoined");

  const isAdmin = currentUser.isAdmin || isConfiguredAdmin(currentUser.email);

  if (nameEl) nameEl.textContent = currentUser.name || "Participante";
  if (emailEl) emailEl.textContent = currentUser.email || "";
  if (avatarEl) avatarEl.textContent = initials(currentUser.name || "U");

  // Recompensas equipadas desde la sección Misiones: marco, título y fondo
  const cos = cosmeticsFromUser(currentUser);
  const frameEl = document.getElementById("profileFrame");
  if (frameEl) frameEl.className = `avatar-frame af-xl${cos.frame && FRAMES[cos.frame] ? ` frame-${cos.frame}` : ""}`;
  const heroCard = document.querySelector(".profile-hero-card");
  if (heroCard) {
    [...heroCard.classList].filter(c => c === "has-bd" || c.startsWith("bd-")).forEach(c => heroCard.classList.remove(c));
    if (cos.backdrop) heroCard.classList.add("has-bd", `bd-${cos.backdrop}`);
  }
  const titleRow = document.getElementById("profileTitleRow");
  if (titleRow) {
    titleRow.innerHTML = `
      ${cos.title ? titleChipHTML(cos.title, "title-chip--hero") : ""}
      <a class="hero-level" href="missions.html"><span aria-hidden="true">${cos.level.icon}</span>${cos.level.label} · ${cos.xp} XP</a>`;
  }

  if (roleBadgeEl) {
    if (isAdmin) {
      roleBadgeEl.textContent = "Moderador / Administrador";
      roleBadgeEl.style.background = "rgba(217, 119, 54, 0.35)";
      roleBadgeEl.style.borderColor = "rgba(217, 119, 54, 0.6)";
    } else {
      roleBadgeEl.textContent = "🌱 Miembro ECRA";
    }
  }

  if (adminBtn) {
    adminBtn.style.display = isAdmin ? "inline-flex" : "none";
  }

  if (joinedEl && currentUser.createdAt) {
    joinedEl.textContent = `Miembro desde el ${formatDateShort(currentUser.createdAt)}`;
  }
}

// Cargar estado de misiones del usuario
async function loadUserChallenges() {
  try {
    const q = query(collection(db, "user_challenges"), where("userId", "==", currentUser.id));
    const snap = await getDocs(q);
    userChallengesMap = {};
    snap.docs.forEach(d => {
      const data = d.data();
      userChallengesMap[data.challengeId] = data.status;
    });
  } catch (err) {
    console.error("Error al cargar misiones del usuario:", err);
  }
}

// Cargar publicaciones del usuario
async function loadUserPosts() {
  try {
    const q = query(
      collection(db, "forumPosts"),
      where("authorId", "==", currentUser.id)
    );
    const snap = await getDocs(q);
    userPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
  } catch (err) {
    console.error("Error al cargar publicaciones del usuario:", err);
  }
}

// Cargar colaboraciones del usuario
async function loadUserCollabs() {
  try {
    const q = query(
      collection(db, "forumParticipations"),
      where("userId", "==", currentUser.id)
    );
    const snap = await getDocs(q);
    userCollabs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
  } catch (err) {
    console.error("Error al cargar colaboraciones del usuario:", err);
  }
}

// Cargar evidencias fotográficas del usuario
async function loadUserEvidences() {
  try {
    const q = query(
      collection(db, "evidences"),
      where("userId", "==", currentUser.id)
    );
    const snap = await getDocs(q);
    userEvidences = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => timeValue(b.submittedAt) - timeValue(a.submittedAt));
  } catch (err) {
    console.error("Error al cargar evidencias del usuario:", err);
  }
}

// Renderizar Panel 1: Mis Misiones
function renderChallengesPanel() {
  const grid = document.getElementById("userChallengesGrid");
  const percentText = document.getElementById("challengesPercentText");
  const progressBar = document.getElementById("challengesProgressBar");
  const metricEl = document.getElementById("metricChallenges");

  if (!grid) return;

  let completedCount = 0;

  const cardsHtml = CHALLENGES.map(ch => {
    let currentStatus = userChallengesMap[ch.id] || "not_started";
    
    // Si tiene evidencia aprobada, marcar como completado
    const hasApprovedEvidence = userEvidences.some(e => (e.challengeId === ch.id || e.challengeNumber === ch.number) && e.status === "approved");
    if (hasApprovedEvidence) {
      currentStatus = "completed";
    }

    if (currentStatus === "completed") {
      completedCount++;
    }

    let statusBadgeHtml = `<span class="status-badge status-neutral">No iniciado</span>`;
    if (currentStatus === "in_progress") {
      statusBadgeHtml = `<span class="status-badge status-pending">En progreso</span>`;
    } else if (currentStatus === "completed") {
      statusBadgeHtml = `<span class="status-badge status-approved">Completado</span>`;
    }

    return `
      <div class="challenge-card" data-challenge-id="${ch.id}">
        <div class="challenge-header">
          <div class="challenge-icon-box" aria-hidden="true">${ch.icon}</div>
          <div>${statusBadgeHtml}</div>
        </div>

        <div>
          <span class="badge badge-outline" style="font-size: 0.7rem; margin-bottom: 4px;">Misión #${ch.number} · ${escapeHTML(ch.categoryLabel)}</span>
          <h3 class="challenge-title" style="font-size: 1.15rem;">${escapeHTML(ch.title)}</h3>
          <p class="challenge-summary" style="font-size: 0.875rem;">${escapeHTML(ch.summary)}</p>
        </div>

        <div class="challenge-footer" style="flex-direction: column; align-items: stretch; gap: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.775rem; color: var(--text-muted);">
            <span>${escapeHTML(ch.duration)}</span>
            <span>Dificultad: ${escapeHTML(ch.difficulty)}</span>
          </div>

          <div style="display: flex; gap: 6px; margin-top: 4px;">
            ${currentStatus === "completed" ? `
              <span class="status-badge status-approved" style="flex: 1; justify-content: center;">Misión cumplida</span>
            ` : `
              <a class="btn btn-primary btn-sm" href="challenge.html?id=${ch.id}" title="Para cumplir la misión debes enviar una foto o un video" style="flex: 1; text-align: center;">
                Enviar foto o video
              </a>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = cardsHtml;

  const percent = Math.round((completedCount / CHALLENGES.length) * 100);
  if (percentText) percentText.textContent = `${percent}% (${completedCount}/${CHALLENGES.length})`;
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (metricEl) metricEl.textContent = `${completedCount} / ${CHALLENGES.length}`;
}

// Renderizar Panel 2: Mis Publicaciones
function renderPostsPanel() {
  const container = document.getElementById("userPostsList");
  const metricEl = document.getElementById("metricPosts");
  if (metricEl) metricEl.textContent = String(userPosts.length);

  if (!container) return;

  if (userPosts.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: var(--space-2xl);">
        <div style="font-size: 2.5rem; margin-bottom: var(--space-sm);"></div>
        <h3>Aún no has publicado en los foros</h3>
        <p class="text-muted" style="margin-bottom: var(--space-md);">
          ¿Tienes una idea ecológica para tu comunidad o conoces un problema ambiental que amerite atención? Compártelo con la comunidad.
        </p>
        <a class="btn btn-primary" href="forums.html">+ Crear primera publicación</a>
      </div>
    `;
    return;
  }

  container.innerHTML = userPosts.map(p => {
    const cat = FORUM_CATEGORIES[p.category] || FORUM_CATEGORIES.general;
    const status = FORUM_STATUSES[p.status] || FORUM_STATUSES.proposal;

    return `
      <article class="post-card">
        <div class="post-header">
          <div class="post-meta">
            <span class="tag-category">${cat.icon} ${escapeHTML(cat.label)}</span>
            <div class="post-date" style="margin-top: 4px;">Publicado el ${formatDateShort(p.createdAt)}</div>
          </div>
          <span class="status-badge ${status.class}">${status.badge}</span>
        </div>

        <h3 class="post-title" style="font-size: 1.15rem;">${escapeHTML(p.title)}</h3>
        <p class="post-description">${escapeHTML(p.description || "")}</p>

        <div class="post-footer">
          <div class="post-stats-group">
            <span>${Number(p.commentsCount || 0)}</span>
            <span>${Number(p.participantsCount || 0)}</span>
          </div>
          <a class="btn btn-secondary btn-sm" href="forums.html?id=${p.id}">
            Ver en foros →
          </a>
        </div>
      </article>
    `;
  }).join("");
}

// Renderizar Panel 3: Mis Colaboraciones
function renderCollabsPanel() {
  const container = document.getElementById("userCollabsList");
  const metricEl = document.getElementById("metricCollabs");
  if (metricEl) metricEl.textContent = String(userCollabs.length);

  if (!container) return;

  if (userCollabs.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: var(--space-2xl);">
        <div style="font-size: 2.5rem; margin-bottom: var(--space-sm);"></div>
        <h3>No te has registrado en proyectos aún</h3>
        <p class="text-muted" style="margin-bottom: var(--space-md);">
          Revisa las iniciativas y campañas sostenibles propuestas por la comunidad ciudadana y ofrécete como voluntario.
        </p>
        <a class="btn btn-secondary" href="forums.html">Explorar Foros Comunitarios</a>
      </div>
    `;
    return;
  }

  container.innerHTML = userCollabs.map(collab => {
    const opt = CONTRIBUTION_OPTIONS.find(o => o.id === collab.contributionType) || { label: "Colaborador", icon: "" };

    return `
      <div class="card" style="padding: var(--space-lg); display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
            <span class="tag-type">${opt.icon} ${escapeHTML(opt.label)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDateShort(collab.createdAt)}</span>
          </div>

          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">${escapeHTML(collab.postTitle || "Iniciativa Comunitaria")}</h3>
          
          ${collab.note ? `
            <div style="background-color: var(--bg-surface-secondary); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
              <strong>Tu nota de apoyo:</strong> ${escapeHTML(collab.note)}
            </div>
          ` : ""}
        </div>

        <div style="margin-top: var(--space-md); border-top: 1px solid var(--border-subtle); padding-top: var(--space-sm); display: flex; justify-content: flex-end;">
          <a class="btn btn-secondary btn-sm" href="forums.html?id=${collab.postId}">
            Ver proyecto y avances →
          </a>
        </div>
      </div>
    `;
  }).join("");
}

// Renderizar Panel 4: Evidencias Fotográficas
function renderEvidencesPanel() {
  const container = document.getElementById("userEvidencesList");
  const metricEl = document.getElementById("metricEvidences");
  if (metricEl) metricEl.textContent = String(userEvidences.length);

  if (!container) return;

  if (userEvidences.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: var(--space-2xl);">
        <div style="font-size: 2.5rem; margin-bottom: var(--space-sm);"></div>
        <h3>No has enviado evidencias (fotos o videos)</h3>
        <p class="text-muted" style="margin-bottom: var(--space-md);">
          Documenta tus acciones ecológicas (reciclaje, limpieza, compostaje, etc.) para que un moderador certifique tu impacto positivo.
        </p>
        <a class="btn btn-primary" href="challenge.html">+ Subir mi primera evidencia</a>
      </div>
    `;
    return;
  }

  container.innerHTML = userEvidences.map(ev => {
    const ch = CHALLENGES.find(c => c.id === ev.challengeId || c.number === Number(ev.challengeNumber)) || {
      title: `Misión #${ev.challengeNumber || 1}`,
      icon: "🌱"
    };

    return `
      <div class="card" style="overflow: hidden; padding: 0; display: flex; flex-direction: column;">
        <div style="height: 190px; background-color: var(--bg-surface-secondary); position: relative; overflow: hidden;">
          ${(ev.mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(ev.imageURL || ""))
            ? `<video src="${escapeHTML(ev.imageURL || "")}" controls playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; background: #000;"></video>`
            : `<img src="${escapeHTML(ev.imageURL || "")}" alt="Evidencia de ${escapeHTML(ch.title)}" style="width: 100%; height: 100%; object-fit: cover;">`}
          <div style="position: absolute; top: 10px; right: 10px;">
            ${evidenceStatusBadge(ev.status)}
          </div>
        </div>

        <div style="padding: var(--space-md); flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 2px;">
              Enviada el ${formatDate(ev.submittedAt)}
            </div>
            <h3 style="font-size: 1.05rem; margin-bottom: 6px;">${ch.icon} ${escapeHTML(ch.title)}</h3>
            
            ${ev.comment ? `
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                "${escapeHTML(ev.comment)}"
              </p>
            ` : ""}

            ${ev.moderatorComment ? `
              <div style="background-color: var(--forest-50); border: 1px solid var(--forest-200); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 0.8rem; color: var(--tint-text); margin-top: 6px;">
                <strong>Nota del moderador:</strong> ${escapeHTML(ev.moderatorComment)}
              </div>
            ` : ""}
          </div>

          <div style="margin-top: var(--space-md); border-top: 1px solid var(--border-subtle); padding-top: var(--space-xs); display: flex; justify-content: flex-end;">
            ${ev.status === "rejected" ? `
              <a class="btn btn-secondary btn-sm" href="challenge.html?id=${ev.challengeId || 'challenge-' + ev.challengeNumber}">
                Reintentar envío
              </a>
            ` : `
              <a class="btn btn-ghost btn-sm" href="challenge.html?id=${ev.challengeId || 'challenge-' + ev.challengeNumber}">
                Ver misión asociada
              </a>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Inicialización de la página
async function initProfilePage() {
  const user = await requireParticipant();
  if (!user) return;
  currentUser = user;

  updateHeroCard();
  initTabs();

  document.getElementById("editProfileBtn")?.addEventListener("click", openEditProfileModal);

  // Cargar datos en paralelo para máxima agilidad
  await Promise.all([
    loadUserChallenges(),
    loadUserPosts(),
    loadUserCollabs(),
    loadUserEvidences()
  ]);

  renderChallengesPanel();
  renderPostsPanel();
  renderCollabsPanel();
  renderEvidencesPanel();
}

document.addEventListener("DOMContentLoaded", () => {
  initProfilePage().catch(err => {
    console.error("Error al inicializar perfil:", err);
    showToast("No se pudo cargar la información de tu perfil.");
  });
});
