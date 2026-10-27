import "./app.js";
import { auth, db } from "./firebase-client.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  where,
  updateDoc,
  setDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const {
  CHALLENGES,
  FORUM_CATEGORIES,
  FORUM_STATUSES,
  FORUM_TYPES,
  requireAdmin,
  formatDate,
  formatDateShort,
  escapeHTML,
  initials,
  showToast,
  ADMIN_EMAIL,
  nowISO
} = window.ECRA;

let currentView = "dashboard";
let filters = { search: "", challenge: "all", status: "all", reportStatus: "all" };
let state = {
  users: [],
  evidences: [],
  activity: [],
  forumPosts: [],
  reports: []
};

let unsubscribers = [];
const adminDataLabels = {
  users: "usuarios",
  evidences: "evidencias",
  forumPosts: "publicaciones de los foros",
  reports: "reportes",
  activity: "bitácora de actividad"
};
const loadedAdminSources = new Set();
const adminSourceErrors = {};

function adminSourceErrorText(source, error) {
  const code = String(error?.code || "").toLowerCase();
  const label = adminDataLabels[source] || source;
  if (code.includes("permission-denied")) {
    return `Firebase denegó la lectura de ${label}. Verifica que ingresaste con la cuenta administradora configurada y que las reglas de Firestore publicadas correspondan a este proyecto.`;
  }
  if (code.includes("unauthenticated")) {
    return `La sesión de Firebase expiró al cargar ${label}. Vuelve a iniciar sesión como administradora.`;
  }
  if (code.includes("failed-precondition")) {
    return `Firebase no pudo completar la consulta de ${label}. Revisa el índice indicado en la consola de Firebase.`;
  }
  if (code.includes("unavailable") || code.includes("deadline-exceeded")) {
    return `No se pudo conectar con Firebase para cargar ${label}. Comprueba la conexión e inténtalo de nuevo.`;
  }
  return `No se pudieron cargar ${label}${code ? ` (${code})` : ""}. Revisa la consola del navegador para ver el detalle.`;
}

function adminDataStatusHTML() {
  const failures = Object.entries(adminSourceErrors).filter(([, error]) => error);
  if (failures.length) {
    return `<div role="alert" class="card" style="margin-bottom: var(--space-lg); padding: var(--space-lg); border: 1px solid var(--status-rejected-border, #d55); background: var(--status-rejected-bg, #fff5f5);">
      <strong style="display:block; margin-bottom:8px;">No se pudieron cargar algunos datos administrativos</strong>
      <ul style="margin:0 0 12px 18px; padding:0;">${failures.map(([source, error]) => `<li style="margin:6px 0;">${escapeHTML(adminSourceErrorText(source, error))}</li>`).join("")}</ul>
      <button class="btn btn-secondary btn-sm" id="adminRetryData" type="button">Reintentar carga</button>
    </div>`;
  }
  if (loadedAdminSources.size < Object.keys(adminDataLabels).length) {
    return `<div class="card" role="status" style="margin-bottom: var(--space-lg); padding: var(--space-md); color: var(--text-muted);">Conectando con Firebase y cargando los datos administrativos…</div>`;
  }
  return "";
}

function listenAdminData(source, reference, applySnapshot) {
  const unsubscribe = onSnapshot(reference, snapshot => {
    try {
      applySnapshot(snapshot);
      loadedAdminSources.add(source);
      delete adminSourceErrors[source];
      render();
    } catch (error) {
      adminSourceErrors[source] = error;
      console.error(`Error al procesar los datos de ${source}:`, error);
      render();
    }
  }, error => {
    loadedAdminSources.add(source);
    adminSourceErrors[source] = error;
    console.error(`No se pudieron cargar los datos de ${source}:`, error);
    render();
  });
  unsubscribers.push(unsubscribe);
}

function timeValue(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

// ¿La evidencia es un video? (nuevas evidencias traen mediaType; las antiguas son fotos)
function isVideoEvidence(e) {
  return e?.mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(e?.imageURL || "");
}

function evidenceMediaHTML(e, style, { controls = false } = {}) {
  const url = escapeHTML(e.imageURL || "");
  if (isVideoEvidence(e)) {
    return `<video src="${url}${controls ? "" : "#t=0.1"}" ${controls ? "controls" : "muted"} playsinline preload="metadata" style="${style} background: #000;"></video>`;
  }
  return `<img src="${url}" alt="Evidencia" style="${style}">`;
}

function evidenceStatusBadge(status) {
  if (status === "approved") {
    return `<span class="status-badge status-approved">🟢 Aprobada</span>`;
  }
  if (status === "rejected") {
    return `<span class="status-badge status-rejected">🔴 Rechazada</span>`;
  }
  return `<span class="status-badge status-pending">🟡 Pendiente</span>`;
}

function calculateStats() {
  const participants = state.users.filter(u => u.role !== "admin");
  const pendingEvidences = state.evidences.filter(e => e.status === "pending").length;
  const approvedEvidences = state.evidences.filter(e => e.status === "approved").length;
  const rejectedEvidences = state.evidences.filter(e => e.status === "rejected").length;
  const pendingReports = state.reports.filter(r => r.status === "pending" || !r.status).length;

  return {
    usersCount: participants.length,
    pendingEvidences,
    approvedEvidences,
    rejectedEvidences,
    postsCount: state.forumPosts.length,
    pendingReports,
    totalEvidences: state.evidences.length
  };
}

function renderShell() {
  const s = calculateStats();

  const pendingBadge = document.getElementById("pendingNavCount");
  if (pendingBadge) pendingBadge.textContent = String(s.pendingEvidences);

  const postsBadge = document.getElementById("postsNavCount");
  if (postsBadge) postsBadge.textContent = String(s.postsCount);

  const reportsBadge = document.getElementById("reportsNavCount");
  if (reportsBadge) reportsBadge.textContent = String(s.pendingReports);

  document.querySelectorAll(".admin-nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === currentView);
  });

  const nameEl = document.getElementById("adminUserName");
  const emailEl = document.getElementById("adminUserEmail");
  const avatarEl = document.getElementById("adminAvatar");

  if (nameEl) nameEl.textContent = window.ECRA_PROFILE?.name || "Moderador ECRA";
  if (emailEl) emailEl.textContent = window.ECRA_PROFILE?.email || ADMIN_EMAIL;
  if (avatarEl) avatarEl.textContent = initials(window.ECRA_PROFILE?.name || "M");
}

// --------------------------------------------------------------------------
// VISTA: DASHBOARD
// --------------------------------------------------------------------------
function dashboardView() {
  const s = calculateStats();
  const recentEvidences = [...state.evidences]
    .sort((a, b) => timeValue(b.submittedAt) - timeValue(a.submittedAt))
    .slice(0, 5);
  const recentActivity = state.activity.slice(0, 6);

  return `
    <!-- Tarjetas de Métricas -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
      <div class="card" style="padding: var(--space-lg); text-align: center;">
        <span class="eyebrow" style="margin-bottom: 4px;">Comunidad</span>
        <strong style="font-size: 2rem; color: var(--accent-text); display: block;">${s.usersCount}</strong>
        <span class="text-muted" style="font-size: 0.8rem;">Participantes registrados</span>
      </div>

      <div class="card" style="padding: var(--space-lg); text-align: center; border-color: ${s.pendingEvidences > 0 ? 'var(--status-pending-border)' : 'var(--border-subtle)'}; background: ${s.pendingEvidences > 0 ? 'var(--status-pending-bg)' : 'var(--bg-surface)'};">
        <span class="eyebrow" style="margin-bottom: 4px;">Evidencias</span>
        <strong style="font-size: 2rem; color: ${s.pendingEvidences > 0 ? 'var(--status-pending-text)' : 'var(--text-primary)'}; display: block;">${s.pendingEvidences}</strong>
        <span class="text-muted" style="font-size: 0.8rem;">Esperando revisión</span>
      </div>

      <div class="card" style="padding: var(--space-lg); text-align: center;">
        <span class="eyebrow" style="margin-bottom: 4px;">Aprobadas</span>
        <strong style="font-size: 2rem; color: var(--status-approved-text); display: block;">${s.approvedEvidences}</strong>
        <span class="text-muted" style="font-size: 0.8rem;">Acciones validadas</span>
      </div>

      <div class="card" style="padding: var(--space-lg); text-align: center;">
        <span class="eyebrow" style="margin-bottom: 4px;">Foros Ciudadanos</span>
        <strong style="font-size: 2rem; color: var(--accent-text); display: block;">${s.postsCount}</strong>
        <span class="text-muted" style="font-size: 0.8rem;">Iniciativas activas</span>
      </div>

      <div class="card" style="padding: var(--space-lg); text-align: center; ${s.pendingReports > 0 ? 'border-color: var(--status-rejected-border); background: var(--status-rejected-bg);' : ''}">
        <span class="eyebrow" style="margin-bottom: 4px;">Reportes</span>
        <strong style="font-size: 2rem; color: ${s.pendingReports > 0 ? 'var(--status-rejected-text)' : 'var(--text-muted)'}; display: block;">${s.pendingReports}</strong>
        <span class="text-muted" style="font-size: 0.8rem;">Pendientes de resolver</span>
      </div>
    </div>

    <!-- Rejilla de Actividad y Últimas Evidencias -->
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-lg);">
      <!-- Evidencias Recientes -->
      <div class="card" style="padding: var(--space-lg);">
        <div class="flex items-center justify-between mb-md">
          <div>
            <span class="eyebrow">REVISIÓN RÁPIDA</span>
            <h2 style="font-size: 1.25rem;">Últimas evidencias enviadas</h2>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="goto-view" data-target="evidence">Ver todas</button>
        </div>

        ${recentEvidences.length ? `
          <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${recentEvidences.map(e => `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border-radius: var(--radius-sm); background-color: var(--bg-surface-secondary); border: 1px solid var(--border-subtle);">
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                  ${evidenceMediaHTML(e, "width: 44px; height: 44px; object-fit: cover; border-radius: var(--radius-xs); flex-shrink: 0;")}
                  <div style="min-width: 0;">
                    <strong style="display: block; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(e.userName || "Participante")}</strong>
                    <small class="text-muted" style="font-size: 0.75rem;">Misión #${e.challengeNumber || 1} · ${formatDateShort(e.submittedAt)}</small>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  ${evidenceStatusBadge(e.status)}
                  <button class="btn btn-secondary btn-sm" data-action="open-evidence" data-id="${e.id}" style="padding: 4px 8px; font-size: 0.75rem;">Revisar</button>
                </div>
              </div>
            `).join("")}
          </div>
        ` : `
          <p class="text-muted" style="text-align: center; padding: var(--space-xl);">No hay evidencias registradas en el sistema.</p>
        `}
      </div>

      <!-- Bitácora Rápida -->
      <div class="card" style="padding: var(--space-lg);">
        <div class="flex items-center justify-between mb-md">
          <div>
            <span class="eyebrow">TRAZABILIDAD</span>
            <h2 style="font-size: 1.25rem;">Actividad en tiempo real</h2>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="goto-view" data-target="activity">Ver bitácora</button>
        </div>

        ${recentActivity.length ? `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${recentActivity.map(a => `
              <div style="font-size: 0.85rem; border-left: 3px solid var(--forest-500); padding-left: 10px;">
                <div>${formatActivitySummary(a)}</div>
                <small class="text-muted">${formatDate(a.createdAt)}</small>
              </div>
            `).join("")}
          </div>
        ` : `
          <p class="text-muted" style="text-align: center; padding: var(--space-xl);">Aún no hay actividad registrada.</p>
        `}
      </div>
    </div>
  `;
}

function formatActivitySummary(a) {
  const name = escapeHTML(a.actorName || a.userName || "Usuario");
  if (a.type === "approved") {
    return `<strong>${name}</strong>: Evidencia aprobada para la misión #${a.challengeNumber || 1}.`;
  }
  if (a.type === "rejected") {
    return `<strong>${name}</strong>: Evidencia rechazada para la misión #${a.challengeNumber || 1}.`;
  }
  if (a.type === "submission") {
    return `<strong>${name}</strong>: Envió nueva evidencia para la misión #${a.challengeNumber || 1}.`;
  }
  return `<strong>${name}</strong>: Actividad comunitaria registrada.`;
}

// --------------------------------------------------------------------------
// VISTA: EVIDENCIAS FOTOGRÁFICAS
// --------------------------------------------------------------------------
function evidenceView() {
  const list = state.evidences.filter(e => {
    const search = filters.search.toLowerCase();
    const matchesSearch = !search ||
      (e.userName && e.userName.toLowerCase().includes(search)) ||
      (e.userEmail && e.userEmail.toLowerCase().includes(search));
    const matchesChallenge = filters.challenge === "all" || String(e.challengeNumber) === String(filters.challenge);
    const matchesStatus = filters.status === "all" || e.status === filters.status;
    return matchesSearch && matchesChallenge && matchesStatus;
  }).sort((a, b) => timeValue(b.submittedAt) - timeValue(a.submittedAt));

  return `
    <div class="card mb-lg" style="padding: var(--space-lg);">
      <div class="flex items-center justify-between mb-md" style="flex-wrap: wrap; gap: var(--space-sm);">
        <div>
          <span class="eyebrow">MODERACIÓN DE IMPACTO</span>
          <h2>Evidencias enviadas (fotos y videos) (${list.length})</h2>
        </div>
        <button class="btn btn-secondary btn-sm" id="btnExportEvidences" type="button">⬇ Exportar a CSV</button>
      </div>

      <!-- Filtros de Evidencias -->
      <div class="filter-bar" style="margin-bottom: 0;">
        <input class="filter-input" id="evFilterSearch" placeholder="🔍 Buscar por participante o correo..." value="${escapeHTML(filters.search)}">
        
        <select class="filter-select" id="evFilterChallenge">
          <option value="all">Todas las misiones (${CHALLENGES.length})</option>
          ${CHALLENGES.map(c => `
            <option value="${c.number}" ${String(filters.challenge) === String(c.number) ? "selected" : ""}>Misión #${c.number}: ${escapeHTML(c.shortTitle || c.title)}</option>
          `).join("")}
        </select>

        <select class="filter-select" id="evFilterStatus">
          <option value="all" ${filters.status === "all" ? "selected" : ""}>Todos los estados</option>
          <option value="pending" ${filters.status === "pending" ? "selected" : ""}>🟡 Pendientes de revisión</option>
          <option value="approved" ${filters.status === "approved" ? "selected" : ""}>🟢 Aprobadas</option>
          <option value="rejected" ${filters.status === "rejected" ? "selected" : ""}>🔴 Rechazadas</option>
        </select>
      </div>
    </div>

    <!-- Rejilla de Evidencias -->
    ${list.length ? `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: var(--space-lg);">
        ${list.map(e => {
          const ch = CHALLENGES.find(c => c.number === Number(e.challengeNumber)) || { title: `Misión #${e.challengeNumber}`, icon: "🌱" };
          return `
            <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
              <div style="position: relative; height: 180px; background-color: var(--bg-surface-secondary);">
                ${evidenceMediaHTML(e, "width: 100%; height: 100%; object-fit: cover;")}
                <div style="position: absolute; top: 8px; right: 8px;">${evidenceStatusBadge(e.status)}</div>
              </div>

              <div style="padding: var(--space-md); flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 2px;">${formatDate(e.submittedAt)}</div>
                  <strong style="display: block; font-size: 0.95rem; margin-bottom: 2px;">${escapeHTML(e.userName || "Participante")}</strong>
                  <div style="font-size: 0.825rem; color: var(--accent-text); margin-bottom: 6px;">${ch.icon} Misión #${e.challengeNumber}: ${escapeHTML(ch.title)}</div>
                  ${e.comment ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">"${escapeHTML(e.comment)}"</p>` : ""}
                  ${e.moderatorComment ? `<div style="background-color: var(--forest-50); padding: 6px 8px; border-radius: var(--radius-xs); font-size: 0.775rem; color: var(--tint-text);">Nota: ${escapeHTML(e.moderatorComment)}</div>` : ""}
                </div>

                <div style="margin-top: var(--space-md); border-top: 1px solid var(--border-subtle); padding-top: var(--space-xs); display: flex; justify-content: flex-end; gap: 6px;">
                  <button class="btn btn-secondary btn-sm" data-action="open-evidence" data-id="${e.id}">Revisar / Calificar</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="card text-center p-xl">
        <p class="text-muted">No se encontraron evidencias con los filtros seleccionados.</p>
      </div>
    `}
  `;
}

// --------------------------------------------------------------------------
// VISTA: FOROS Y PROYECTOS COMUNITARIOS
// --------------------------------------------------------------------------
function forumsView() {
  const search = filters.search.toLowerCase();
  const list = state.forumPosts.filter(p => {
    return !search ||
      (p.title && p.title.toLowerCase().includes(search)) ||
      (p.authorName && p.authorName.toLowerCase().includes(search)) ||
      (p.location && p.location.toLowerCase().includes(search));
  }).sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));

  return `
    <div class="card mb-lg" style="padding: var(--space-lg);">
      <div class="flex items-center justify-between mb-md" style="flex-wrap: wrap; gap: var(--space-sm);">
        <div>
          <span class="eyebrow">MODERACIÓN CIUDADANA</span>
          <h2>Iniciativas y proyectos comunitarios (${list.length})</h2>
        </div>
        <a class="btn btn-primary btn-sm" href="forums.html" target="_blank">Abrir Foros Públicos ↗</a>
      </div>

      <div class="filter-bar" style="margin-bottom: 0;">
        <input class="filter-input" id="forumAdminSearch" placeholder="🔍 Buscar por título, autor o comunidad..." value="${escapeHTML(filters.search)}">
      </div>
    </div>

    ${list.length ? `
      <div style="display: flex; flex-direction: column; gap: var(--space-md);">
        ${list.map(p => {
          const cat = FORUM_CATEGORIES[p.category] || FORUM_CATEGORIES.general;
          const status = FORUM_STATUSES[p.status] || FORUM_STATUSES.proposal;
          const pType = FORUM_TYPES[p.type] || FORUM_TYPES.idea;

          return `
            <div class="card" style="padding: var(--space-md); display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); flex-wrap: wrap;">
              <div style="flex: 1; min-width: 260px;">
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                  <span class="tag-category">${cat.icon} ${escapeHTML(cat.label)}</span>
                  <span class="tag-type">${pType.icon} ${escapeHTML(pType.label)}</span>
                  <span class="status-badge ${status.class}">${status.badge}</span>
                  ${p.location ? `<span class="tag-location">📍 ${escapeHTML(p.location)}</span>` : ""}
                </div>

                <h3 style="font-size: 1.15rem; margin-bottom: 4px;">${escapeHTML(p.title)}</h3>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">
                  Por <strong>${escapeHTML(p.authorName || "Anónimo")}</strong> (${escapeHTML(p.authorEmail || "Sin correo")}) · ${formatDate(p.createdAt)}
                </div>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 4px; line-height: 1.4;">
                  ${escapeHTML(p.description?.substring(0, 180) || "")}${p.description?.length > 180 ? "..." : ""}
                </p>
                <div style="font-size: 0.775rem; color: var(--text-muted);">
                  💬 ${p.commentsCount || 0} comentarios · 🤝 ${p.participantsCount || 0} voluntarios
                </div>
              </div>

              <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <a class="btn btn-secondary btn-sm" href="forums.html?id=${p.id}" target="_blank">Ver en vivo ↗</a>
                <button class="btn btn-danger btn-sm" data-action="admin-delete-post" data-id="${p.id}">Eliminar</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="card text-center p-xl">
        <p class="text-muted">No hay publicaciones de foros registradas.</p>
      </div>
    `}
  `;
}

// --------------------------------------------------------------------------
// VISTA: REPORTES CIUDADANOS
// --------------------------------------------------------------------------
function reportsView() {
  const list = state.reports.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));

  return `
    <div class="card mb-lg" style="padding: var(--space-lg);">
      <span class="eyebrow">MODERACIÓN Y SEGURIDAD</span>
      <h2>Reportes de contenido inapropiado o spam (${list.length})</h2>
      <p class="text-muted" style="margin-bottom: 0; font-size: 0.85rem;">
        Revisa los avisos enviados por la comunidad para mantener un ambiente de respeto y veracidad en los foros de ECRA.
      </p>
    </div>

    ${list.length ? `
      <div style="display: flex; flex-direction: column; gap: var(--space-md);">
        ${list.map(r => {
          const isPending = !r.status || r.status === "pending";
          return `
            <div class="card" style="padding: var(--space-md); border-left: 4px solid ${isPending ? 'var(--status-rejected-border)' : 'var(--border-subtle)'};">
              <div class="flex items-center justify-between mb-xs">
                <div>
                  <span class="status-badge ${isPending ? 'status-rejected' : 'status-approved'}">
                    ${isPending ? '⚠️ Pendiente de revisión' : '✓ Resuelto / Desestimado'}
                  </span>
                  <strong style="margin-left: 8px; font-size: 0.95rem;">Motivo: ${escapeHTML(r.reason || "General")}</strong>
                </div>
                <small class="text-muted">${formatDate(r.createdAt)}</small>
              </div>

              <div style="font-size: 0.875rem; margin-bottom: 6px;">
                <strong>Publicación reportada:</strong> ${escapeHTML(r.postTitle || r.postId || "ID " + r.postId)}
              </div>

              ${r.detail ? `
                <div style="background-color: var(--bg-surface-secondary); padding: 8px 12px; border-radius: var(--radius-xs); font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 8px;">
                  "${escapeHTML(r.detail)}"
                </div>
              ` : ""}

              <div style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 8px;">
                Reportado por: ${escapeHTML(r.reporterEmail || r.reporterId || "Anónimo")}
              </div>

              <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <a class="btn btn-secondary btn-sm" href="forums.html?id=${r.postId}" target="_blank">Ver publicación ↗</a>
                ${isPending ? `
                  <button class="btn btn-danger btn-sm" data-action="report-delete-post" data-report-id="${r.id}" data-post-id="${r.postId}">Eliminar publicación</button>
                  <button class="btn btn-secondary btn-sm" data-action="report-dismiss" data-report-id="${r.id}">Desestimar reporte</button>
                ` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="card text-center p-xl">
        <p class="text-muted">No hay reportes de moderación pendientes. ¡Excelente!</p>
      </div>
    `}
  `;
}

// --------------------------------------------------------------------------
// VISTA: DIRECTORIO DE USUARIOS
// --------------------------------------------------------------------------
function usersView() {
  const search = filters.search.toLowerCase();
  const list = state.users.filter(u => {
    return !search ||
      (u.name && u.name.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search));
  });

  return `
    <div class="card mb-lg" style="padding: var(--space-lg);">
      <div class="flex items-center justify-between mb-md" style="flex-wrap: wrap; gap: var(--space-sm);">
        <div>
          <span class="eyebrow">DIRECTORIO CIUDADANO</span>
          <h2>Usuarios registrados (${list.length})</h2>
        </div>
        <button class="btn btn-secondary btn-sm" id="btnExportUsers" type="button">⬇ Exportar a CSV</button>
      </div>

      <div class="filter-bar" style="margin-bottom: 0;">
        <input class="filter-input" id="userAdminSearch" placeholder="🔍 Buscar por nombre o correo electrónico..." value="${escapeHTML(filters.search)}">
      </div>
    </div>

    <div class="card" style="padding: 0; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-subtle); background-color: var(--bg-surface-secondary); color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">
            <th style="padding: 12px 16px;">Usuario</th>
            <th style="padding: 12px 16px;">Correo</th>
            <th style="padding: 12px 16px;">Rol</th>
            <th style="padding: 12px 16px;">Registro</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(u => `
            <tr style="border-bottom: 1px solid var(--border-subtle);">
              <td style="padding: 12px 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="post-avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">${initials(u.name)}</div>
                  <strong>${escapeHTML(u.name || "Participante")}</strong>
                </div>
              </td>
              <td style="padding: 12px 16px; color: var(--text-secondary);">${escapeHTML(u.email || "—")}</td>
              <td style="padding: 12px 16px;">
                <span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-outline'}" style="font-size: 0.75rem;">
                  ${u.role === 'admin' ? '🛡️ Admin' : '🌱 Miembro'}
                </span>
              </td>
              <td style="padding: 12px 16px; font-size: 0.8rem; color: var(--text-muted);">${formatDateShort(u.createdAt)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// --------------------------------------------------------------------------
// VISTA: BITÁCORA DE ACTIVIDAD
// --------------------------------------------------------------------------
function activityView() {
  const list = state.activity;

  return `
    <div class="card mb-lg" style="padding: var(--space-lg);">
      <span class="eyebrow">AUDITORÍA Y TRAZABILIDAD</span>
      <h2>Bitácora de eventos en tiempo real (${list.length})</h2>
    </div>

    ${list.length ? `
      <div class="card" style="padding: var(--space-lg);">
        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          ${list.map(a => `
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); padding-bottom: var(--space-sm); border-bottom: 1px solid var(--border-subtle);">
              <div>
                <p style="margin-bottom: 2px; font-size: 0.925rem;">${formatActivitySummary(a)}</p>
                ${a.moderatorComment ? `<small class="text-muted">Nota: "${escapeHTML(a.moderatorComment)}"</small>` : ""}
              </div>
              <small class="text-muted" style="white-space: nowrap;">${formatDate(a.createdAt)}</small>
            </div>
          `).join("")}
        </div>
      </div>
    ` : `
      <div class="card text-center p-xl">
        <p class="text-muted">No hay eventos en la bitácora todavía.</p>
      </div>
    `}
  `;
}

// --------------------------------------------------------------------------
// VISTA: CONFIGURACIÓN Y ESTADO DEL SISTEMA
// --------------------------------------------------------------------------
function settingsView() {
  return `
    <div class="card mb-lg" style="padding: var(--space-lg);">
      <span class="eyebrow">ARQUITECTURA DE SISTEMA</span>
      <h2>Configuración del entorno ECRA</h2>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg);">
      <div class="card" style="padding: var(--space-lg);">
        <h3 style="font-size: 1.15rem; margin-bottom: 8px;">🔥 Firebase Platform</h3>
        <p class="text-muted" style="font-size: 0.875rem;">
          Autenticación con Email/Contraseña y Google Sign-In, base de datos Cloud Firestore y Reglas de Seguridad granulares.
        </p>
        <div style="background-color: var(--bg-surface-secondary); padding: 8px 12px; border-radius: var(--radius-xs); font-family: monospace; font-size: 0.8rem;">
          Project ID: bwc2026-f956e<br>
          Admin Autorizado: ${escapeHTML(ADMIN_EMAIL)}
        </div>
      </div>

      <div class="card" style="padding: var(--space-lg);">
        <h3 style="font-size: 1.15rem; margin-bottom: 8px;">📦 Supabase Storage</h3>
        <p class="text-muted" style="font-size: 0.875rem;">
          Almacenamiento en la nube para las fotos, videos y evidencias de los participantes.
        </p>
        <div style="background-color: var(--bg-surface-secondary); padding: 8px 12px; border-radius: var(--radius-xs); font-family: monospace; font-size: 0.8rem;">
          Bucket: evidence<br>
          Directorio: evidence/&lt;userId&gt;/...
        </div>
      </div>

      <div class="card" style="padding: var(--space-lg);">
        <h3 style="font-size: 1.15rem; margin-bottom: 8px;">🌿 Catálogo de Misiones</h3>
        <p class="text-muted" style="font-size: 0.875rem;">
          ${CHALLENGES.length} misiones verdes accesibles para todo público, sin barreras económicas ni riesgos.
        </p>
        <div style="background-color: var(--bg-surface-secondary); padding: 8px 12px; border-radius: var(--radius-xs); font-family: monospace; font-size: 0.8rem;">
          Total de misiones: ${CHALLENGES.length}<br>
          Categorías de Foros: 9
        </div>
      </div>
    </div>
  `;
}

// --------------------------------------------------------------------------
// MODAL: REVISAR EVIDENCIA
// --------------------------------------------------------------------------
function openEvidenceReviewModal(evidenceId) {
  const e = state.evidences.find(x => x.id === evidenceId);
  if (!e) return;

  const ch = CHALLENGES.find(c => c.number === Number(e.challengeNumber)) || { title: `Misión #${e.challengeNumber}`, icon: "🌱" };

  const modalRoot = document.getElementById("adminModalRoot");
  modalRoot.innerHTML = `
    <div class="modal-overlay" data-close-backdrop>
      <div class="modal-dialog">
        <div class="modal-header">
          <div>
            <span class="eyebrow">${ch.icon} RETO #${e.challengeNumber}</span>
            <h2>Revisar evidencia de ${escapeHTML(e.userName || "Participante")}</h2>
            <small class="text-muted">${formatDate(e.submittedAt)} · Correo: ${escapeHTML(e.userEmail || "—")}</small>
          </div>
          <button class="modal-close-btn" data-close-btn type="button">✕</button>
        </div>

        <div style="margin-bottom: var(--space-md); max-height: 380px; overflow: hidden; border-radius: var(--radius-md); background: #000; text-align: center;">
          ${evidenceMediaHTML(e, "max-height: 380px; width: auto; max-width: 100%; object-fit: contain;", { controls: true })}
        </div>

        ${e.comment ? `
          <div style="background-color: var(--bg-surface-secondary); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: var(--space-md); font-size: 0.9rem;">
            <strong>Comentario del participante:</strong> ${escapeHTML(e.comment)}
          </div>
        ` : ""}

        <div class="form-group">
          <label class="form-label" for="modCommentInput">Comentario de retroalimentación para el participante</label>
          <textarea class="form-textarea" id="modCommentInput" placeholder="Ej: ¡Excelente trabajo separando materiales! o Por favor envía una foto o video donde se aprecie mejor el trabajo..." rows="2">${escapeHTML(e.moderatorComment || "")}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg);">
          <button class="btn btn-ghost" data-close-btn type="button">Cancelar</button>
          <button class="btn btn-danger" id="btnRejectEvidence" type="button">🔴 Rechazar evidencia</button>
          <button class="btn btn-primary" id="btnApproveEvidence" type="button">🟢 Aprobar evidencia</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { modalRoot.innerHTML = ""; };
  modalRoot.querySelector("[data-close-btn]")?.addEventListener("click", close);
  modalRoot.querySelector("[data-close-backdrop]")?.addEventListener("click", (evt) => {
    if (evt.target.classList.contains("modal-overlay")) close();
  });

  modalRoot.querySelector("#btnApproveEvidence")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Aprobando…";
    const comment = modalRoot.querySelector("#modCommentInput").value.trim() || "¡Excelente evidencia! Misión aprobada satisfactoriamente.";
    const approved = await approveEvidence(e.id, comment);
    if (approved) {
      close();
    } else if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  modalRoot.querySelector("#btnRejectEvidence")?.addEventListener("click", async () => {
    const comment = modalRoot.querySelector("#modCommentInput").value.trim() || "La evidencia (foto o video) no permite verificar con claridad la acción realizada. Por favor vuelve a enviarla.";
    await rejectEvidence(e.id, comment);
    close();
  });
}

async function syncUserCompletedCount(userId) {
  if (!userId) return;
  const snap = await getDocs(query(collection(db, "user_challenges"), where("userId", "==", userId)));
  const completedIds = new Set();

  snap.docs.forEach(document => {
    const data = document.data();
    const status = String(data.status || "").trim().toLowerCase();
    if (!["completed", "approved", "completado", "completada", "finalizado", "finalizada"].includes(status)) return;

    const rawId = String(data.challengeId ?? "").trim();
    const number = Number(data.challengeNumber ?? rawId.match(/(?:challenge-)?(\d+)/i)?.[1]);
    const challengeId = CHALLENGES.find(challenge => challenge.id === rawId || challenge.number === number)?.id;
    if (challengeId) completedIds.add(challengeId);
  });

  await updateDoc(doc(db, "users", userId), {
    completed: completedIds.size,
    updatedAt: serverTimestamp()
  });
}

async function findChallengeProgressRef(userId, challenge) {
  // Primero reutiliza cualquier registro existente de la misión, incluso si su ID no sigue
  // el patrón actual. El documento canónico solo se crea si no existe ninguno.
  const canonicalRef = doc(db, "user_challenges", `${userId}_${challenge.id}`);
  try {
    const snap = await getDocs(query(collection(db, "user_challenges"), where("userId", "==", userId)));
    const matchingDoc = snap.docs.find(item => {
      const data = item.data() || {};
      const rawId = String(data.challengeId ?? data.challenge_id ?? "").trim();
      if (rawId === challenge.id) return true;
      const rawNumber = data.challengeNumber ?? data.challenge_number;
      const number = Number(rawNumber ?? rawId.match(/(?:challenge-)?(\d+)/i)?.[1]);
      return Number.isFinite(number) && number === challenge.number;
    });
    return matchingDoc?.ref || canonicalRef;
  } catch (error) {
    console.warn("No se pudo localizar el progreso existente; se usará el ID canónico:", error);
    return canonicalRef;
  }
}

async function resolveEvidenceUserId(ev) {
  const candidates = [ev?.userId, ev?.uid, ev?.firebaseUid, ev?.ownerId, ev?.user_id]
    .map(value => String(value ?? "").trim())
    .filter(Boolean);

  // Los perfiles normales usan el UID como ID del documento. Compruébalo antes de
  // confiar en IDs antiguos que pudieron haber sido guardados con otro formato.
  for (const candidate of candidates) {
    try {
      const profileSnap = await getDoc(doc(db, "users", candidate));
      if (profileSnap.exists()) return profileSnap.id;
    } catch (error) {
      console.warn("No se pudo comprobar el perfil asociado a la evidencia:", error);
      break;
    }
  }

  const email = String(ev?.userEmail ?? ev?.email ?? "").trim().toLowerCase();
  if (email) {
    try {
      const profileSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
      if (!profileSnap.empty) return profileSnap.docs[0].id;
    } catch (error) {
      console.warn("No se pudo localizar el perfil por correo; se conserva el ID de la evidencia:", error);
    }
  }
  return candidates[0] || "";
}

function getEvidenceChallenge(ev) {
  const rawId = String(ev?.challengeId ?? ev?.challenge_id ?? "").trim();
  const numberFromId = rawId.match(/(?:challenge-)?(\d+)/i)?.[1];
  const rawNumber = ev?.challengeNumber ?? ev?.challenge_number ?? numberFromId;
  const number = Number(rawNumber);
  return CHALLENGES.find(challenge => challenge.id === rawId || (Number.isFinite(number) && challenge.number === number)) || null;
}

function approvalErrorMessage(error) {
  const code = String(error?.code || "").toLowerCase();
  if (code.includes("permission-denied")) return "Firebase denegó el permiso para modificar esta evidencia o su progreso. Revisa las reglas publicadas y la cuenta administradora.";
  if (code.includes("not-found")) return "No se encontró el registro de la evidencia o de la misión. Actualiza el panel y vuelve a intentarlo.";
  if (code.includes("unavailable") || code.includes("network-request-failed")) return "No se pudo conectar con Firebase. Revisa la conexión e inténtalo de nuevo.";
  if (error?.message && !code) return error.message;
  return `Ocurrió un error al aprobar la evidencia${code ? ` (${code})` : ""}. La ventana seguirá abierta para que puedas intentarlo de nuevo.`;
}

async function approveEvidence(id, moderatorComment) {
  const admin = await requireAdmin();
  if (!admin) return false;

  try {
    const evRef = doc(db, "evidences", id);
    const evidenceSnap = await getDoc(evRef);
    if (!evidenceSnap.exists()) {
      throw new Error("La evidencia ya no existe en Firestore. Actualiza el panel y vuelve a abrirla.");
    }

    const ev = evidenceSnap.data() || {};
    const userId = await resolveEvidenceUserId(ev);
    const challenge = getEvidenceChallenge(ev);
    const reviewedAt = nowISO();

    // La moderación de la evidencia es la acción principal. Se guarda primero para que
    // un registro de progreso antiguo o faltante no provoque un falso error de aprobación.
    const evidenceUpdate = {
      status: "approved",
      reviewedAt,
      reviewedBy: admin.user.uid,
      moderatorComment
    };
    if (userId && userId !== String(ev.userId ?? "")) evidenceUpdate.userId = userId;
    if (challenge) {
      evidenceUpdate.challengeId = challenge.id;
      evidenceUpdate.challengeNumber = challenge.number;
    }
    await updateDoc(evRef, evidenceUpdate);

    let progressSynced = false;
    let progressError = null;
    if (userId && challenge) {
      try {
        const progressRef = await findChallengeProgressRef(userId, challenge);
        const progressData = {
          userId,
          challengeId: challenge.id,
          challengeNumber: challenge.number,
          status: "completed",
          completedAt: reviewedAt,
          updatedAt: reviewedAt,
          notes: "Evidencia aprobada por moderación"
        };
        // Merge admite tanto documentos existentes con campos históricos como la creación
        // del documento canónico cuando esta persona no tenía un progreso registrado.
        await setDoc(progressRef, progressData, { merge: true });
        try {
          await syncUserCompletedCount(userId);
        } catch (error) {
          console.warn("La misión se marcó como cumplida, pero no se pudo recalcular el contador:", error);
        }
        progressSynced = true;
      } catch (error) {
        progressError = error;
        console.error("La evidencia se aprobó, pero no se pudo sincronizar el progreso:", error);
      }
    }

    await logActivity({
      type: "approved",
      actorUid: admin.user.uid,
      actorName: admin.profile?.name || admin.user.email,
      userId: userId || String(ev.userId || ""),
      userName: ev.userName || "Participante",
      challengeNumber: challenge?.number || ev.challengeNumber || ev.challenge_number || 1,
      moderatorComment
    });

    if (!userId || !challenge) {
      showToast("Evidencia aprobada, pero no se pudo asociar automáticamente con el participante o la misión. Revisa los datos de ese registro.", "warning");
    } else if (!progressSynced) {
      const code = String(progressError?.code || "").toLowerCase();
      const detail = code.includes("permission-denied")
        ? "Firebase denegó actualizar el progreso; revisa que las reglas de Firestore publicadas permitan al administrador crear y actualizar user_challenges."
        : "No se pudo actualizar el progreso de la misión. La evidencia quedó aprobada; vuelve a abrirla o revisa la consola del navegador.";
      showToast(detail, "warning");
    } else {
      showToast("Evidencia aprobada y progreso de la misión actualizado.", "success");
    }
    return true;
  } catch (err) {
    console.error("Error al aprobar evidencia:", err);
    showToast(approvalErrorMessage(err), "error");
    return false;
  }
}

async function rejectEvidence(id, moderatorComment) {
  const admin = await requireAdmin();
  if (!admin) return;

  try {
    const evRef = doc(db, "evidences", id);
    const ev = state.evidences.find(x => x.id === id);

    await updateDoc(evRef, {
      status: "rejected",
      reviewedAt: nowISO(),
      reviewedBy: admin.user.uid,
      moderatorComment
    });

    await logActivity({
      type: "rejected",
      actorUid: admin.user.uid,
      actorName: admin.profile?.name || admin.user.email,
      userId: ev?.userId || "",
      userName: ev?.userName || "Participante",
      challengeNumber: ev?.challengeNumber || 1,
      moderatorComment
    });

    showToast("Evidencia rechazada con comentarios.");
  } catch (err) {
    console.error("Error al rechazar evidencia:", err);
    showToast("No se pudo rechazar la evidencia.");
  }
}

async function logActivity(data) {
  try {
    await addDoc(collection(db, "activity"), {
      ...data,
      createdAt: nowISO(),
      createdAtServer: serverTimestamp()
    });
  } catch (e) {
    console.error("No se pudo registrar actividad:", e);
  }
}

// --------------------------------------------------------------------------
// EXPORTACIÓN A CSV
// --------------------------------------------------------------------------
function toCSVValue(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(toCSVValue).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportUsersCSV() {
  const rows = [
    ["Nombre", "Correo", "Rol", "Fecha de Registro"],
    ...state.users.map(u => [u.name, u.email, u.role || "participant", formatDate(u.createdAt)])
  ];
  downloadCSV("bwc-directorio-usuarios.csv", rows);
  showToast("Descargando directorio de usuarios en CSV...");
}

function exportEvidencesCSV() {
  const rows = [
    ["Participante", "Correo", "Misión", "Estado", "Fecha Envío", "Comentario Participante", "Nota Moderador", "URL Foto"],
    ...state.evidences.map(e => [
      e.userName,
      e.userEmail,
      e.challengeNumber,
      e.status,
      formatDate(e.submittedAt),
      e.comment || "",
      e.moderatorComment || "",
      e.imageURL || ""
    ])
  ];
  downloadCSV("bwc-evidencias-ambientales.csv", rows);
  showToast("Descargando registro de evidencias en CSV...");
}

// --------------------------------------------------------------------------
// RENDERIZADO Y ENLACE DE EVENTOS
// --------------------------------------------------------------------------
function render() {
  renderShell();
  const root = document.getElementById("adminViewRoot");
  if (!root) return;

  let viewHTML = "";
  if (currentView === "dashboard") viewHTML = dashboardView();
  else if (currentView === "evidence") viewHTML = evidenceView();
  else if (currentView === "forums") viewHTML = forumsView();
  else if (currentView === "reports") viewHTML = reportsView();
  else if (currentView === "users") viewHTML = usersView();
  else if (currentView === "activity") viewHTML = activityView();
  else if (currentView === "settings") viewHTML = settingsView();

  root.innerHTML = `${adminDataStatusHTML()}${viewHTML}`;
  bindEvents();
}

function bindEvents() {
  document.getElementById("adminRetryData")?.addEventListener("click", () => window.location.reload());

  // Navegación
  document.querySelectorAll(".admin-nav-item").forEach(btn => {
    btn.onclick = () => {
      currentView = btn.dataset.view;
      filters.search = "";
      render();
    };
  });

  document.querySelectorAll("[data-action='goto-view']").forEach(btn => {
    btn.onclick = () => {
      currentView = btn.dataset.target;
      render();
    };
  });

  // Modal de evidencia
  document.querySelectorAll("[data-action='open-evidence']").forEach(btn => {
    btn.onclick = () => openEvidenceReviewModal(btn.dataset.id);
  });

  // Eliminar publicación desde foros admin
  document.querySelectorAll("[data-action='admin-delete-post']").forEach(btn => {
    btn.onclick = async () => {
      const ok = confirm("¿Deseas eliminar permanentemente esta publicación?");
      if (!ok) return;
      try {
        await deleteDoc(doc(db, "forumPosts", btn.dataset.id));
        showToast("Publicación eliminada.");
      } catch (err) {
        console.error(err);
        showToast("No se pudo eliminar la publicación.");
      }
    };
  });

  // Acciones en reportes
  document.querySelectorAll("[data-action='report-delete-post']").forEach(btn => {
    btn.onclick = async () => {
      const ok = confirm("¿Eliminar publicación reportada y cerrar el reporte?");
      if (!ok) return;
      try {
        await deleteDoc(doc(db, "forumPosts", btn.dataset.postId));
        await updateDoc(doc(db, "reports", btn.dataset.reportId), { status: "resolved", resolvedAt: nowISO() });
        showToast("Publicación eliminada y reporte resuelto.");
      } catch (err) {
        console.error(err);
        showToast("Error al procesar la acción.");
      }
    };
  });

  document.querySelectorAll("[data-action='report-dismiss']").forEach(btn => {
    btn.onclick = async () => {
      try {
        await updateDoc(doc(db, "reports", btn.dataset.reportId), { status: "dismissed", dismissedAt: nowISO() });
        showToast("Reporte desestimado.");
      } catch (err) {
        console.error(err);
        showToast("Error al desestimar reporte.");
      }
    };
  });

  // Exportar CSV
  document.getElementById("btnExportUsers")?.addEventListener("click", exportUsersCSV);
  document.getElementById("btnExportEvidences")?.addEventListener("click", exportEvidencesCSV);

  // Filtros de Evidencia
  document.getElementById("evFilterSearch")?.addEventListener("input", (e) => {
    filters.search = e.target.value;
    render();
  });
  document.getElementById("evFilterChallenge")?.addEventListener("change", (e) => {
    filters.challenge = e.target.value;
    render();
  });
  document.getElementById("evFilterStatus")?.addEventListener("change", (e) => {
    filters.status = e.target.value;
    render();
  });

  // Filtro de Usuarios
  document.getElementById("userAdminSearch")?.addEventListener("input", (e) => {
    filters.search = e.target.value;
    render();
  });

  // Filtro de Foros
  document.getElementById("forumAdminSearch")?.addEventListener("input", (e) => {
    filters.search = e.target.value;
    render();
  });
}

// --------------------------------------------------------------------------
// ARRANQUE Y LISTENERS EN TIEMPO REAL
// --------------------------------------------------------------------------
async function startAdmin() {
  const admin = await requireAdmin();
  if (!admin) return;

  window.ECRA_PROFILE = admin.profile;

  // Todas las fuentes llevan manejo de error. Antes, si Firebase denegaba una consulta,
  // el panel se quedaba mostrando ceros/estados vacíos sin explicar qué colección falló.
  listenAdminData("users", collection(db, "users"), snap => {
    state.users = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  });

  listenAdminData("evidences", collection(db, "evidences"), snap => {
    // El ID real de Firestore prevalece sobre cualquier campo id guardado en documentos antiguos.
    state.evidences = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  });

  // Ordenar en el cliente evita depender de consultas orderBy que pueden ocultar registros
  // antiguos sin createdAt o fallar si la configuración de índices cambia.
  listenAdminData("forumPosts", collection(db, "forumPosts"), snap => {
    state.forumPosts = snap.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
  });

  listenAdminData("reports", collection(db, "reports"), snap => {
    state.reports = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  });

  listenAdminData("activity", collection(db, "activity"), snap => {
    state.activity = snap.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt))
      .slice(0, 60);
  });

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  startAdmin().catch(err => {
    console.error("Error al iniciar panel de moderación:", err);
    showToast("No se pudo iniciar el panel administrativo.");
  });

  document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
    window.ECRA.signOutAndGoLogin();
  });
});

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach(unsub => unsub?.());
});
