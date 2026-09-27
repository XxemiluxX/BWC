import "./app.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const { db, CHALLENGES, requireParticipant, formatDate, escapeHTML, showToast } = window.BWC;

async function getMyEvidences(userId) {
  const snap = await getDocs(query(collection(db, "evidences"), where("userId", "==", userId)));
  return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => timeValue(b.submittedAt) - timeValue(a.submittedAt));
}

function timeValue(value) { const d = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }

function statusBadge(status) {
  const cls = status === "pending" ? "pending" : status === "approved" ? "approved" : "rejected";
  const text = status === "pending" ? "🟡 Pendiente" : status === "approved" ? "🟢 Aprobada" : "🔴 Rechazada";
  return `<span class="status-badge status-${cls}">${text}</span>`;
}

async function render() {
  const user = await requireParticipant(); if (!user) return;
  const mine = await getMyEvidences(user.id);
  document.getElementById("headerUserName").textContent = user.name || "Participante";
  document.getElementById("welcomeName").textContent = (user.name || "Participante").split(" ")[0];

  const completed = Number(user.completed || 0);
  const percent = Math.min(100, completed / 3 * 100);
  document.getElementById("progressCount").textContent = `${completed}/3`;
  document.getElementById("progressFill").style.width = `${percent}%`;
  document.getElementById("impactMeterFill").style.width = `${percent}%`;

  const stepWrap = document.getElementById("progressSteps");
  const labels = ["Desafío 1", "Desafío 2", "Desafío 3", "Completado"];
  stepWrap.innerHTML = labels.map((label, i) => {
    const done = i < completed;
    const active = (i === completed && completed < 3) || (i === 3 && completed === 3);
    return `<div class="progress-step ${done ? "done" : ""} ${active ? "active" : ""}"><div class="dot">${done ? "✓" : i + 1}</div>${label}</div>`;
  }).join("");

  const banner = document.getElementById("completionBanner");
  if (completed >= 3) {
    banner.classList.remove("hidden");
    document.getElementById("currentChallengeTitle").textContent = "Challenge completado";
    document.getElementById("currentChallengeText").textContent = "Has aprobado los tres desafíos. Tu reconocimiento ya está disponible.";
    document.getElementById("currentStatusBadge").textContent = "3/3 completados";
    document.getElementById("currentStatusBadge").className = "status-badge status-approved";
    document.getElementById("openChallengeBtn").textContent = "Ver reconocimiento";
    document.getElementById("topChallengeBtn").textContent = "Ver reconocimiento →";
    document.getElementById("impactTitle").textContent = "Tu impacto ya está completo.";
    document.getElementById("impactText").textContent = "Has demostrado tres acciones que aportan a tu entorno, al planeta y a tu comunidad.";
  } else {
    banner.classList.add("hidden");
    const challenge = CHALLENGES[completed] || CHALLENGES[0];
    const evidence = mine.find(e => e.challengeId === challenge.id);
    document.getElementById("currentChallengeTitle").textContent = `Desafío ${challenge.number}`;
    document.getElementById("currentChallengeText").textContent = challenge.instruction;
    document.getElementById("openChallengeBtn").href = "challenge.html";

    if (!evidence) {
      document.getElementById("currentStatusBadge").textContent = "Pendiente de completar";
      document.getElementById("currentStatusBadge").className = "status-badge status-neutral";
      document.getElementById("impactTitle").textContent = `Estás en ${challenge.title}.`;
      document.getElementById("impactText").textContent = "Completa este reto y envía una fotografía para que el moderador la revise.";
    } else if (evidence.status === "pending") {
      document.getElementById("currentStatusBadge").textContent = "Pendiente de revisión";
      document.getElementById("currentStatusBadge").className = "status-badge status-pending";
      document.getElementById("impactTitle").textContent = "Tu evidencia está en revisión.";
      document.getElementById("impactText").textContent = "Cuando el moderador la apruebe, se habilitará el siguiente desafío.";
    } else if (evidence.status === "rejected") {
      document.getElementById("currentStatusBadge").textContent = "Evidencia rechazada";
      document.getElementById("currentStatusBadge").className = "status-badge status-rejected";
      document.getElementById("impactTitle").textContent = "Puedes volver a intentarlo.";
      document.getElementById("impactText").textContent = "Revisa el comentario del moderador y envía una nueva evidencia.";
    } else {
      document.getElementById("currentStatusBadge").textContent = "Aprobada";
      document.getElementById("currentStatusBadge").className = "status-badge status-approved";
      document.getElementById("impactTitle").textContent = "Tu próximo reto está listo.";
      document.getElementById("impactText").textContent = "El moderador aprobó la evidencia y tu progreso está actualizado.";
    }

    document.getElementById("currentEvidenceBox").innerHTML = evidence ? `<div class="evidence-mini"><img src="${escapeHTML(evidence.imageURL || "")}" alt="Evidencia de ${escapeHTML(challenge.title)}"><div><b>${evidence.status === "pending" ? "Evidencia enviada" : evidence.status === "approved" ? "Evidencia aprobada" : "Necesita revisión"}</b><small>${formatDate(evidence.submittedAt)}</small>${evidence.moderatorComment ? `<small>${escapeHTML(evidence.moderatorComment)}</small>` : ""}</div></div>` : "";
    document.getElementById("openChallengeBtn").textContent = evidence?.status === "rejected" ? "Enviar nueva evidencia" : evidence?.status === "pending" ? "Ver estado de revisión" : "Abrir desafío";
  }

  document.getElementById("historyCount").textContent = `${mine.length} envío${mine.length === 1 ? "" : "s"}`;
  document.getElementById("myEvidenceList").innerHTML = mine.length ? mine.map(ev => `
    <article class="history-item">
      <img src="${escapeHTML(ev.imageURL || "")}" alt="Evidencia del desafío ${ev.challengeNumber}">
      <div><h3>Desafío ${ev.challengeNumber} · ${escapeHTML(CHALLENGES[ev.challengeNumber - 1]?.title || "")}</h3><p>Enviada ${formatDate(ev.submittedAt)}</p>${ev.moderatorComment ? `<p>${escapeHTML(ev.moderatorComment)}</p>` : ""}</div>
      <div class="history-side">${statusBadge(ev.status)}</div>
    </article>`).join("") : `<div class="empty-state">Todavía no has enviado evidencias.</div>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  try { await render(); } catch (error) { console.error(error); showToast("No se pudo cargar tu perfil. Revisa tu conexión con Firebase."); }
  window.addEventListener("focus", () => render().catch(console.error));
});
