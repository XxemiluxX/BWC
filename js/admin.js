import "./app.js";
const {loadDB, saveDB, CHALLENGES, requireAdmin, formatDate, escapeHTML, initials, showToast, resetDB} = window.BWC;

let currentView = "dashboard";
let filters = {search:"", challenge:"all", status:"all", completed:"all"};

function stats(db) {
  const participants = db.users.filter(u => u.role === "participant");
  return {
    users: participants.length,
    c1: participants.filter(u => u.currentChallenge === 1).length,
    c2: participants.filter(u => u.currentChallenge === 2).length,
    c3: participants.filter(u => u.currentChallenge === 3).length,
    completed: participants.filter(u => u.completed >= 3).length,
    pending: db.evidences.filter(e => e.status === "pending").length
  };
}

function filteredEvidence(db) {
  return db.evidences.filter(e => {
    const matchesSearch = !filters.search || `${e.userName} ${e.challengeNumber}`.toLowerCase().includes(filters.search.toLowerCase());
    const matchesChallenge = filters.challenge === "all" || Number(filters.challenge) === e.challengeNumber;
    const matchesStatus = filters.status === "all" || filters.status === e.status;
    const user = db.users.find(u => u.id === e.userId);
    const matchesCompleted = filters.completed === "all" || (filters.completed === "yes" ? user?.completed >= 3 : user?.completed < 3);
    return matchesSearch && matchesChallenge && matchesStatus && matchesCompleted;
  }).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
}

function statusBadge(status) {
  return `<span class="status-badge status-${status === "pending" ? "pending" : status === "approved" ? "approved" : "rejected"}">${status === "pending" ? "🟡 Pendiente" : status === "approved" ? "🟢 Aprobada" : "🔴 Rechazada"}</span>`;
}

function renderShell() {
  const db = loadDB(), s = stats(db);
  document.getElementById("pendingNavCount").textContent = s.pending;
  document.querySelectorAll(".admin-nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === currentView));
}

function dashboardView(db) {
  const s = stats(db);
  const recent = [...db.evidences].sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)).slice(0,5);
  return `
    <section class="stat-grid">
      <div class="stat-card"><small>Total usuarios</small><strong>${s.users}</strong><span>Participantes registrados</span></div>
      <div class="stat-card"><small>Desafío 1</small><strong>${s.c1}</strong><span>Usuarios en etapa 1</span></div>
      <div class="stat-card"><small>Desafío 2</small><strong>${s.c2}</strong><span>Usuarios en etapa 2</span></div>
      <div class="stat-card"><small>Desafío 3</small><strong>${s.c3}</strong><span>Usuarios en etapa 3</span></div>
      <div class="stat-card"><small>Completados</small><strong>${s.completed}</strong><span>Challenge 3/3</span></div>
    </section>
    <section class="admin-grid">
      <article class="panel-card">
        <div class="panel-heading"><div><span class="eyebrow">ACTIVIDAD RECIENTE</span><h2>Últimas evidencias</h2></div><button class="btn btn-ghost btn-small" data-action="view-evidence">Ver todas</button></div>
        ${recent.length ? `<div class="evidence-history">${recent.map(e => `
          <article class="history-item">
            <img src="${e.image}" alt="Evidencia">
            <div><h3>${escapeHTML(e.userName)} · Desafío ${e.challengeNumber}</h3><p>${formatDate(e.submittedAt)}</p></div>
            <div class="history-side">${statusBadge(e.status)}</div>
          </article>`).join("")}</div>` : `<div class="empty-state">No hay evidencias aún.</div>`}
      </article>
      <article class="panel-card">
        <div><span class="eyebrow">FLUJO</span><h2>Cómo funciona la moderación</h2></div>
        <p class="muted">Cada fotografía llega como <b>pending</b>. El moderador decide si la evidencia se aprueba o se rechaza.</p>
        <div class="challenge-callout"><b>🟡 Pendiente</b><p>Revisa la fotografía y decide.</p></div>
        <div class="challenge-callout"><b>🟢 Aprobada</b><p>El usuario avanza al siguiente reto.</p></div>
        <div class="challenge-callout"><b>🔴 Rechazada</b><p>El usuario puede enviar otra evidencia.</p></div>
      </article>
    </section>`;
}

function usersView(db) {
  const users = db.users.filter(u=>u.role==="participant").filter(u => !filters.search || `${u.name} ${u.email}`.toLowerCase().includes(filters.search.toLowerCase()));
  return `
    <section class="panel-card">
      <div class="panel-heading"><div><span class="eyebrow">PARTICIPANTES</span><h2>Usuarios registrados</h2></div><span class="muted">${users.length} resultados</span></div>
      <div class="filter-row"><input id="userSearch" placeholder="Buscar por nombre o correo…" value="${escapeHTML(filters.search)}"><select id="userChallenge"><option value="all">Todos los desafíos</option><option value="1">Desafío 1</option><option value="2">Desafío 2</option><option value="3">Desafío 3</option></select></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Desafío actual</th><th>Progreso</th><th>Estado</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr><td><div class="user-cell"><span class="avatar">${initials(u.name)}</span><div><b>${escapeHTML(u.name)}</b><small class="muted">Registrado ${formatDate(u.createdAt)}</small></div></div></td><td>${escapeHTML(u.email)}</td><td>${u.completed>=3?"Completado":`Desafío ${u.currentChallenge}`}</td><td>${u.completed}/3</td><td>${u.completed>=3?statusBadge("approved"):'<span class="status-badge status-neutral">En progreso</span>'}</td><td><button class="btn btn-soft btn-small" data-user="${u.id}">Ver</button></td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
}

function evidenceView(db) {
  const list = filteredEvidence(db);
  return `
    <section class="panel-card">
      <div class="panel-heading"><div><span class="eyebrow">MODERACIÓN</span><h2>Evidencias</h2></div><span class="muted">${list.length} evidencias</span></div>
      <div class="filter-row">
        <input id="evidenceSearch" placeholder="Buscar participante…" value="${escapeHTML(filters.search)}">
        <select id="evidenceChallenge"><option value="all">Todos los desafíos</option>${CHALLENGES.map(c=>`<option value="${c.number}" ${filters.challenge==c.number?"selected":""}>Desafío ${c.number}</option>`).join("")}</select>
        <select id="evidenceStatus"><option value="all">Todos los estados</option><option value="pending" ${filters.status==="pending"?"selected":""}>Pendientes</option><option value="approved" ${filters.status==="approved"?"selected":""}>Aprobadas</option><option value="rejected" ${filters.status==="rejected"?"selected":""}>Rechazadas</option></select>
        <select id="evidenceCompleted"><option value="all">Todos los usuarios</option><option value="yes" ${filters.completed==="yes"?"selected":""}>Completados</option><option value="no" ${filters.completed==="no"?"selected":""}>En progreso</option></select>
      </div>
      ${list.length ? `<div class="evidence-grid">${list.map(e => `
        <article class="evidence-admin-card">
          <img src="${e.image}" alt="Evidencia de ${escapeHTML(e.userName)} — desafío ${e.challengeNumber}">
          <div class="evidence-admin-body">
            <div class="evidence-admin-meta"><div><h3>${escapeHTML(e.userName)}</h3><small>Desafío ${e.challengeNumber} · ${formatDate(e.submittedAt)}</small></div>${statusBadge(e.status)}</div>
            <p>${escapeHTML(CHALLENGES[e.challengeNumber-1].title)}</p>
            <div class="evidence-actions"><button class="btn btn-ghost btn-small" data-view-evidence="${e.id}">VER</button>${e.status==="pending" ? `<button class="btn btn-success btn-small" data-approve="${e.id}">APROBAR</button><button class="btn btn-danger btn-small" data-reject="${e.id}">RECHAZAR</button>` : ""}</div>
          </div>
        </article>`).join("")}</div>` : `<div class="empty-state">No hay evidencias que coincidan con los filtros.</div>`}
    </section>`;
}

function completedView(db) {
  const users = db.users.filter(u=>u.role==="participant" && u.completed>=3);
  return `<section class="panel-card"><div class="panel-heading"><div><span class="eyebrow">RECONOCIMIENTOS</span><h2>Participantes completados</h2></div><strong>${users.length}</strong></div>${users.length ? `<div class="evidence-history">${users.map(u => `<article class="history-item"><div class="avatar">${initials(u.name)}</div><div><h3>${escapeHTML(u.name)}</h3><p>${escapeHTML(u.email)} · 3/3 desafíos completados</p></div><div class="history-side"><span class="completion-badge">🏆 Completado</span></div></article>`).join("")}</div>` : `<div class="empty-state">Todavía no hay participantes con 3/3 desafíos.</div>`}</section>`;
}

function settingsView() {
  return `<section class="settings-grid">
    <article class="settings-card"><span class="eyebrow">ARQUITECTURA</span><h2>Demostración frontend</h2><p>La demo guarda temporalmente usuarios, evidencias y estados en localStorage para que puedas recorrer el flujo sin servidor.</p><div class="code-note">// PARA PRODUCCIÓN: CONECTAR CON FIREBASE AUTHENTICATION / FIRESTORE / STORAGE</div></article>
    <article class="settings-card"><span class="eyebrow">GOOGLE</span><h2>Autenticación preparada</h2><p>El botón de Google está presente en registro e inicio de sesión. El OAuth real debe implementarse con Firebase Authentication o un proveedor backend seguro.</p><button class="btn btn-ghost btn-small" disabled>Google OAuth pendiente de conexión</button></article>
    <article class="settings-card"><span class="eyebrow">DATOS DE DEMO</span><h2>Restaurar escenario</h2><p>Restablece usuarios y evidencias de ejemplo. Tus cuentas creadas durante la prueba también serán eliminadas.</p><button id="resetDemoBtn" class="btn btn-danger">Restaurar datos de demo</button></article>
    <article class="settings-card"><span class="eyebrow">PRIVACIDAD</span><h2>Credenciales</h2><p>Esta demo no almacena contraseñas en texto plano para cuentas creadas. Aun así, localStorage no es un mecanismo de seguridad para producción.</p></article>
  </section>`;
}

function render() {
  const db = loadDB(); renderShell();
  const root = document.getElementById("adminViewRoot");
  if (currentView === "dashboard") root.innerHTML = dashboardView(db);
  if (currentView === "users") root.innerHTML = usersView(db);
  if (currentView === "evidence") root.innerHTML = evidenceView(db);
  if (currentView === "completed") root.innerHTML = completedView(db);
  if (currentView === "settings") root.innerHTML = settingsView();
  bindViewEvents();
}

function bindViewEvents() {
  document.querySelectorAll(".admin-nav-btn").forEach(btn => btn.onclick = () => {currentView=btn.dataset.view; render();});
  document.querySelectorAll("[data-action='view-evidence']").forEach(btn => btn.onclick = () => {currentView="evidence"; render();});
  document.querySelectorAll("[data-view-evidence]").forEach(btn => btn.onclick = () => openEvidence(btn.dataset.viewEvidence));
  document.querySelectorAll("[data-approve]").forEach(btn => btn.onclick = () => openApprove(btn.dataset.approve));
  document.querySelectorAll("[data-reject]").forEach(btn => btn.onclick = () => openReject(btn.dataset.reject));
  document.querySelectorAll("[data-user]").forEach(btn => btn.onclick = () => openUser(btn.dataset.user));
  document.getElementById("resetDemoBtn")?.addEventListener("click", () => {
    if (!confirm("¿Restaurar todos los datos de la demostración?")) return;
    resetDB(); showToast("Datos de demo restaurados."); render();
  });

  const bindFilter = (id, key) => document.getElementById(id)?.addEventListener("input", e => {filters[key] = e.target.value; render();});
  const bindSelect = (id, key) => document.getElementById(id)?.addEventListener("change", e => {filters[key] = e.target.value; render();});
  bindFilter("evidenceSearch","search"); bindSelect("evidenceChallenge","challenge"); bindSelect("evidenceStatus","status"); bindSelect("evidenceCompleted","completed");
  bindFilter("userSearch","search");
}

function closeModal() { document.getElementById("adminModalRoot").innerHTML = ""; }

function openEvidence(id) {
  const db=loadDB(), e=db.evidences.find(x=>x.id===id); if(!e)return;
  document.getElementById("adminModalRoot").innerHTML = `<div class="detail-modal" data-close-modal><div class="modal-card">
    <div class="modal-header"><div><span class="eyebrow">EVIDENCIA #${e.challengeNumber}</span><h2>${escapeHTML(e.userName)}</h2><p class="muted">${formatDate(e.submittedAt)}</p></div><button class="modal-close" data-close>✕</button></div>
    <img src="${e.image}" alt="Evidencia enviada por ${escapeHTML(e.userName)}"><div class="challenge-callout"><b>${statusBadge(e.status)}</b><p>${e.moderatorComment ? escapeHTML(e.moderatorComment) : "Sin comentario del moderador."}</p></div>
    ${e.status==="pending" ? `<div class="evidence-actions"><button class="btn btn-success btn-full" data-modal-approve="${e.id}">Aprobar evidencia</button><button class="btn btn-danger btn-full" data-modal-reject="${e.id}">Rechazar</button></div>`:""}</div></div>`;
  document.querySelector("[data-close]")?.addEventListener("click", closeModal);
  document.querySelector("[data-close-modal]")?.addEventListener("click", e=>{if(e.target.hasAttribute("data-close-modal"))closeModal()});
  document.querySelector("[data-modal-approve]")?.addEventListener("click",()=>openApprove(e.id));
  document.querySelector("[data-modal-reject]")?.addEventListener("click",()=>openReject(e.id));
}

function openApprove(id) {
  const db=loadDB(), e=db.evidences.find(x=>x.id===id); if(!e || e.status!=="pending")return;
  document.getElementById("adminModalRoot").innerHTML = `<div class="detail-modal"><div class="modal-card"><div class="modal-header"><div><span class="eyebrow">CONFIRMAR</span><h2>¿Quieres aprobar esta evidencia?</h2><p class="muted">${escapeHTML(e.userName)} · Desafío ${e.challengeNumber}</p></div><button class="modal-close" data-close>✕</button></div><p>Al aprobarla, el progreso del participante se actualizará y se desbloqueará el siguiente desafío.</p><div class="evidence-actions"><button class="btn btn-ghost btn-full" data-close>Cancelar</button><button class="btn btn-success btn-full" data-confirm-approve>Aprobar evidencia</button></div></div></div>`;
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
  document.querySelector("[data-confirm-approve]").onclick=()=>approveEvidence(id);
}

function approveEvidence(id) {
  const db=loadDB(), e=db.evidences.find(x=>x.id===id); if(!e)return;
  const user=db.users.find(u=>u.id===e.userId); if(!user)return;
  e.status="approved"; e.reviewedAt=new Date().toISOString(); e.moderatorComment="Evidencia aprobada.";
  if (e.challengeNumber === user.currentChallenge && user.completed < 3) {
    user.completed = Math.max(user.completed, e.challengeNumber);
    user.currentChallenge = user.completed >= 3 ? 4 : user.completed + 1;
  }
  saveDB(db); closeModal(); showToast("Evidencia aprobada. Progreso actualizado."); currentView="evidence"; render();
}

function openReject(id) {
  const db=loadDB(), e=db.evidences.find(x=>x.id===id); if(!e || e.status!=="pending")return;
  document.getElementById("adminModalRoot").innerHTML = `<div class="detail-modal"><div class="modal-card"><div class="modal-header"><div><span class="eyebrow">RECHAZAR EVIDENCIA</span><h2>Motivo del rechazo</h2><p class="muted">${escapeHTML(e.userName)} · Desafío ${e.challengeNumber}</p></div><button class="modal-close" data-close>✕</button></div><textarea id="rejectReason" placeholder="Escribe un comentario opcional para el participante…"></textarea><div class="evidence-actions"><button class="btn btn-ghost btn-full" data-close>Cancelar</button><button class="btn btn-danger btn-full" data-confirm-reject>Confirmar rechazo</button></div></div></div>`;
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
  document.querySelector("[data-confirm-reject]").onclick=()=>rejectEvidence(id);
}

function rejectEvidence(id) {
  const db=loadDB(), e=db.evidences.find(x=>x.id===id); if(!e)return;
  e.status="rejected"; e.reviewedAt=new Date().toISOString(); e.moderatorComment=document.getElementById("rejectReason")?.value.trim() || "La evidencia necesita ser revisada nuevamente.";
  saveDB(db); closeModal(); showToast("Evidencia rechazada. El participante puede reenviar otra."); render();
}

function openUser(id) {
  const db=loadDB(), u=db.users.find(x=>x.id===id); if(!u)return;
  const ev=db.evidences.filter(e=>e.userId===id).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  document.getElementById("adminModalRoot").innerHTML = `<div class="detail-modal"><div class="modal-card"><div class="modal-header"><div><span class="eyebrow">PERFIL</span><h2>${escapeHTML(u.name)}</h2><p class="muted">${escapeHTML(u.email)}</p></div><button class="modal-close" data-close>✕</button></div><p><b>Desafío actual:</b> ${u.completed>=3?"Completado":`Desafío ${u.currentChallenge}`} · <b>Progreso:</b> ${u.completed}/3</p><h3>Historial de evidencias</h3>${ev.length?`<div class="evidence-history">${ev.map(e=>`<article class="history-item"><img src="${e.image}" alt="Evidencia"><div><h3>Desafío ${e.challengeNumber}</h3><p>${formatDate(e.submittedAt)}</p></div><div class="history-side">${statusBadge(e.status)}</div></article>`).join("")}</div>`:`<div class="empty-state">No hay evidencias.</div>`}</div></div>`;
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!requireAdmin()) return;
  render();
});
