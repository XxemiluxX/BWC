import "./app.js";
const {loadDB, saveDB, CHALLENGES, getCurrentUser, requireParticipant, latestEvidence, nowISO, uid, formatDate, escapeHTML, showToast} = window.BWC;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function render() {
  const user = requireParticipant(); if (!user) return;
  const root = document.getElementById("challengeContent");
  if (user.completed >= 3) {
    root.innerHTML = `
      <section class="celebration-screen reveal">
        <div class="celebration-inner">
          <div class="celebration-planet">🌎</div>
          <span class="eyebrow">BETTER WORLD CHALLENGE</span>
          <h1>¡Felicidades, <span>${escapeHTML(user.name.split(" ")[0])}!</span></h1>
          <p>Has completado todos los desafíos de Better World Challenge.</p>
          <p>Gracias por participar y contribuir a construir un mundo mejor.</p>
          <div class="completion-badge">🏆 BETTER WORLD CHALLENGE COMPLETADO</div>
          <div><b>DESAFÍOS COMPLETADOS: 3/3</b></div>
          <div class="celebration-actions"><a class="btn btn-primary" href="profile.html">Volver a mi perfil</a><a class="btn btn-ghost" href="profile.html#evidenceHistory">Ver mi progreso</a></div>
        </div>
      </section>`;
    return;
  }

  const challenge = CHALLENGES[user.completed];
  const ev = latestEvidence(user.id, challenge.id);
  const status = ev?.status || "none";
  let stateHTML = "";
  if (status === "pending") stateHTML = `<div class="submission-state pending"><b>🟡 PENDIENTE DE REVISIÓN</b><br><small>Tu evidencia fue enviada correctamente. No puedes avanzar hasta que el moderador la apruebe.</small></div>`;
  if (status === "rejected") stateHTML = `<div class="submission-state rejected"><b>🔴 Tu evidencia necesita ser revisada nuevamente.</b><br><small>${ev.moderatorComment ? escapeHTML(ev.moderatorComment) : "El moderador solicitó una nueva evidencia."}</small></div>`;
  if (status === "approved") stateHTML = `<div class="submission-state approved"><b>🟢 DESAFÍO APROBADO</b><br><small>Tu siguiente desafío se activará automáticamente.</small></div>`;

  const disabled = status === "pending" ? "disabled" : "";
  const submitLabel = status === "rejected" ? "Enviar nueva evidencia" : "SUBIR EVIDENCIA";
  root.innerHTML = `
    <section class="challenge-hero reveal">
      <article class="challenge-copy">
        <div class="challenge-index">${challenge.icon} DESAFÍO ${challenge.number} DE 3</div>
        <h1>${escapeHTML(challenge.title.split(" ").slice(0,-1).join(" "))} <span>${escapeHTML(challenge.title.split(" ").slice(-1)[0])}</span></h1>
        <p>${escapeHTML(challenge.instruction)}</p>
        <div class="challenge-callout"><b>📸 Tu evidencia</b><p>Realiza la actividad y captura una fotografía que permita mostrarla. La aprobación es manual.</p></div>
        ${stateHTML}
        <a href="profile.html" class="btn btn-ghost">← Volver a mi perfil</a>
      </article>
      <article class="upload-card">
        <div>
          <span class="eyebrow">EVIDENCIA FOTOGRÁFICA</span>
          <h2>${status === "pending" ? "Esperando revisión" : status === "rejected" ? "Corrige tu evidencia" : "Demuestra tu acción"}</h2>
          <label class="drop-zone" id="dropZone" for="evidenceInput">
            <input id="evidenceInput" type="file" accept="image/*" ${disabled}>
            <div class="drop-icon">📷</div>
            <b>Selecciona una fotografía</b>
            <small>JPG, PNG o WebP · Demo frontend</small>
          </label>
          <img id="previewImg" class="preview-img hidden" alt="Vista previa de la evidencia">
          <p id="fileName" class="upload-note">Aún no has seleccionado una imagen.</p>
        </div>
        <div>
          <button id="submitEvidenceBtn" class="btn btn-primary btn-full" ${disabled}>${submitLabel}</button>
          <p class="upload-note">La imagen se guarda temporalmente en este navegador para demostrar el flujo.</p>
        </div>
      </article>
    </section>`;

  const input = document.getElementById("evidenceInput");
  const drop = document.getElementById("dropZone");
  const preview = document.getElementById("previewImg");
  const fileName = document.getElementById("fileName");
  let selectedFile = null;

  input?.addEventListener("change", () => {
    selectedFile = input.files?.[0] || null;
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) { showToast("Selecciona una imagen válida."); return; }
    const url = URL.createObjectURL(selectedFile); preview.src = url; preview.classList.remove("hidden"); fileName.textContent = `${selectedFile.name} · ${(selectedFile.size/1024/1024).toFixed(2)} MB`;
  });
  ["dragenter","dragover"].forEach(evt => drop?.addEventListener(evt, e => {e.preventDefault(); drop.classList.add("drag");}));
  ["dragleave","drop"].forEach(evt => drop?.addEventListener(evt, e => {e.preventDefault(); drop.classList.remove("drag");}));
  drop?.addEventListener("drop", e => {
    const file = e.dataTransfer?.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Solo se permiten imágenes.");
    selectedFile = file; const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); fileName.textContent = `${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`;
  });

  document.getElementById("submitEvidenceBtn")?.addEventListener("click", async () => {
    if (status === "pending") return;
    if (!selectedFile) return showToast("Selecciona una fotografía antes de enviarla.");
    if (!selectedFile.type.startsWith("image/")) return showToast("El archivo debe ser una imagen.");
    if (selectedFile.size > 5 * 1024 * 1024) return showToast("Para esta demo, la imagen debe pesar menos de 5 MB.");
    const image = await readFileAsDataURL(selectedFile);
    const db = loadDB();
    db.evidences.push({
      id: uid("evidence"), userId:user.id, userName:user.name, challengeId:challenge.id, challengeNumber:challenge.number,
      image, submittedAt:nowISO(), status:"pending", moderatorComment:""
    });
    saveDB(db); showToast("Evidencia enviada. Quedó pendiente de revisión."); render();
  });
}

document.addEventListener("DOMContentLoaded", render);
