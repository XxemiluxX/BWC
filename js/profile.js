import "./app.js";
const {loadDB, CHALLENGES, getCurrentUser, requireParticipant, latestEvidence, formatDate, escapeHTML, initials, showToast} = window.BWC;

function render() {
  const user = requireParticipant(); if (!user) return;
  const db = loadDB();
  document.getElementById("headerUserName").textContent = user.name;
  document.getElementById("welcomeName").textContent = user.name.split(" ")[0];

  const completed = user.completed;
  const percent = Math.min(100, completed / 3 * 100);
  document.getElementById("progressCount").textContent = `${completed}/3`;
  document.getElementById("progressFill").style.width = `${percent}%`;
  document.getElementById("impactMeterFill").style.width = `${percent}%`;

  const stepWrap = document.getElementById("progressSteps");
  const labels = ["Desafío 1","Desafío 2","Desafío 3","Completado"];
  stepWrap.innerHTML = labels.map((label, i) => {
    const done = i < completed;
    const active = (i === completed && completed < 3) || (i === 3 && completed === 3);
    return `<div class="progress-step ${done ? "done" : ""} ${active ? "active" : ""}"><div class="dot">${done ? "✓" : i+1}</div>${label}</div>`;
  }).join("");

  if (completed >= 3) {
    document.getElementById("completionBanner").classList.remove("hidden");
    document.getElementById("currentChallengeTitle").textContent = "Challenge completado";
    document.getElementById("currentChallengeText").textContent = "Has aprobado los tres desafíos. Puedes revisar tu historial y tu reconocimiento.";
    document.getElementById("currentStatusBadge").textContent = "3/3 completados";
    document.getElementById("currentStatusBadge").className = "status-badge status-approved";
    document.getElementById("openChallengeBtn").textContent = "Ver reconocimiento";
    document.getElementById("openChallengeBtn").href = "challenge.html";
    document.getElementById("topChallengeBtn").textContent = "Ver reconocimiento →";
    document.getElementById("impactTitle").textContent = "Tu impacto ya está completo.";
    document.getElementById("impactText").textContent = "Has demostrado tres acciones que aportan a tu entorno, al planeta y a tu comunidad.";
  } else {
    const challenge = CHALLENGES[completed];
    const evidence = latestEvidence(user.id, challenge.id);
    document.getElementById("currentChallengeTitle").textContent = `Desafío ${challenge.number}`;
    document.getElementById("currentChallengeText").textContent = challenge.instruction;

    if (!evidence) {
      document.getElementById("currentStatusBadge").textContent = "Pendiente de completar";
      document.getElementById("currentStatusBadge").className = "status-badge status-neutral";
      document.getElementById("impactTitle").textContent = `Estás en ${challenge.title}.`;
      document.getElementById("impactText").textContent = "Completa este reto y envía una fotografía para que el moderador la revise.";
    } else if (evidence.status === "pending") {
      document.getElementById("currentStatusBadge").textContent = "Pendiente de revisión";
      document.getElementById("currentStatusBadge").className = "status-badge status-pending";
      document.getElementById("impactTitle").textContent = "Tu evidencia está en revisión.";
      document.getElementById("impactText").textContent = "Cuando el moderador la apruebe, el siguiente desafío se desbloqueará automáticamente.";
    } else if (evidence.status === "rejected") {
      document.getElementById("currentStatusBadge").textContent = "Evidencia rechazada";
      document.getElementById("currentStatusBadge").className = "status-badge status-rejected";
      document.getElementById("impactTitle").textContent = "Puedes volver a intentarlo.";
      document.getElementById("impactText").textContent = "Revisa el comentario del moderador y envía una nueva evidencia.";
    }
    document.getElementById("currentEvidenceBox").innerHTML = evidence ? `
      <div class="evidence-mini">
        <img src="${evidence.image}" alt="Evidencia de ${challenge.title}">
        <div><b>${evidence.status === "pending" ? "Evidencia enviada" : evidence.status === "approved" ? "Evidencia aprobada" : "Necesita revisión"}</b><small>${formatDate(evidence.submittedAt)}</small>${evidence.moderatorComment ? `<small>${escapeHTML(evidence.moderatorComment)}</small>` : ""}</div>
      </div>` : "";
    document.getElementById("openChallengeBtn").textContent = evidence?.status === "rejected" ? "Enviar nueva evidencia" : evidence?.status === "pending" ? "Ver estado de revisión" : "Abrir desafío";
  }

  const mine = db.evidences.filter(e => e.userId === user.id).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  document.getElementById("historyCount").textContent = `${mine.length} envío${mine.length === 1 ? "" : "s"}`;
  document.getElementById("myEvidenceList").innerHTML = mine.length ? mine.map(ev => `
    <article class="history-item">
      <img src="${ev.image}" alt="Evidencia del desafío ${ev.challengeNumber}">
      <div><h3>Desafío ${ev.challengeNumber} · ${escapeHTML(CHALLENGES[ev.challengeNumber-1].title)}</h3><p>Enviada ${formatDate(ev.submittedAt)}</p>${ev.moderatorComment ? `<p>${escapeHTML(ev.moderatorComment)}</p>` : ""}</div>
      <div class="history-side"><span class="status-badge status-${ev.status === "pending" ? "pending" : ev.status === "approved" ? "approved" : "rejected"}">${ev.status === "pending" ? "🟡 Pendiente" : ev.status === "approved" ? "🟢 Aprobada" : "🔴 Rechazada"}</span></div>
    </article>`).join("") : `<div class="empty-state">Todavía no has enviado evidencias.</div>`;
}

document.addEventListener("DOMContentLoaded", () => { render(); window.addEventListener("storage", render); });
