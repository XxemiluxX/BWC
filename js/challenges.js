import "./app.js";
import {
  collection, getDocs, addDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { supabase, SUPABASE_BUCKET, assertSupabaseConfigured } from "./supabase-client.js";

const { db, CHALLENGES, requireParticipant, formatDate, escapeHTML, showToast, uid, setChallengeProgress } = window.ECRA;

function timeValue(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function latestEvidenceFrom(list, challengeId) {
  return list
    .filter(e => e.challengeId === challengeId)
    .sort((a, b) => timeValue(b.submittedAt) - timeValue(a.submittedAt))[0] || null;
}

async function getMyEvidences(userId) {
  const snap = await getDocs(query(collection(db, "evidences"), where("userId", "==", userId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo procesar la imagen seleccionada.")); };
    img.src = url;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Por favor selecciona un archivo de imagen (JPG, PNG o WebP).");
  if (file.size > 15 * 1024 * 1024) throw new Error("La fotografía original supera los 15 MB permitidos.");
  const img = await fileToImage(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.84));
  if (!blob) throw new Error("No se pudo optimizar la fotografía.");
  return blob;
}

async function render() {
  const user = await requireParticipant();
  if (!user) return;

  const root = document.getElementById("challengeContent");
  if (!root) return;

  const evidences = await getMyEvidences(user.id);

  // Determinar reto seleccionado por URL o por defecto el primero
  const urlParams = new URLSearchParams(window.location.search);
  const requestedId = urlParams.get("id");
  let challenge = CHALLENGES.find(c => c.id === requestedId) || CHALLENGES[0];

  const ev = latestEvidenceFrom(evidences, challenge.id);
  const status = ev?.status || "none";

  let stateHTML = "";
  if (status === "pending") {
    stateHTML = `
      <div class="card mb-lg" style="background-color: var(--status-pending-bg); border-color: var(--status-pending-border); padding: var(--space-md);">
        <strong style="color: var(--status-pending-text); display: block; margin-bottom: 4px;">🟡 Evidencia en revisión</strong>
        <small style="color: var(--status-pending-text);">Tu fotografía fue enviada correctamente. El equipo de moderación la revisará para validar tu progreso.</small>
      </div>
    `;
  } else if (status === "approved") {
    stateHTML = `
      <div class="card mb-lg" style="background-color: var(--status-approved-bg); border-color: var(--status-approved-border); padding: var(--space-md);">
        <strong style="color: var(--status-approved-text); display: block; margin-bottom: 4px;">🟢 ¡Evidencia aprobada!</strong>
        <small style="color: var(--status-approved-text);">Tu acción fue validada por el moderador. ¡Gracias por tu compromiso ambiental!</small>
      </div>
    `;
  } else if (status === "rejected") {
    stateHTML = `
      <div class="card mb-lg" style="background-color: var(--status-rejected-bg); border-color: var(--status-rejected-border); padding: var(--space-md);">
        <strong style="color: var(--status-rejected-text); display: block; margin-bottom: 4px;">🔴 Tu evidencia necesita corrección</strong>
        <small style="color: var(--status-rejected-text);">${ev.moderatorComment ? escapeHTML(ev.moderatorComment) : "El moderador solicitó una nueva fotografía más clara."}</small>
      </div>
    `;
  }

  const isPending = status === "pending";
  const submitLabel = status === "rejected" ? "Enviar nueva fotografía" : "Subir evidencia fotográfica";

  const challengeOptionsHTML = CHALLENGES.map(c => `
    <option value="${c.id}" ${c.id === challenge.id ? "selected" : ""}>
      ${c.icon} Reto ${c.number}: ${escapeHTML(c.title)}
    </option>
  `).join("");

  root.innerHTML = `
    <div class="card mb-xl">
      <div class="form-group mb-lg">
        <label class="form-label" for="challengeSelect">Seleccionar reto para documentar:</label>
        <select id="challengeSelect" class="form-select">
          ${challengeOptionsHTML}
        </select>
      </div>

      <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: var(--space-md);">
        <div class="challenge-icon-box" style="font-size: 2rem;">${challenge.icon}</div>
        <div>
          <span class="eyebrow">${escapeHTML(challenge.categoryLabel)} · Dificultad: ${challenge.difficulty}</span>
          <h2 style="font-size: 1.5rem; margin-bottom: 4px;">${escapeHTML(challenge.title)}</h2>
          <p class="text-muted" style="margin-bottom: 0;">${escapeHTML(challenge.instruction)}</p>
        </div>
      </div>

      ${stateHTML}

      <div class="card" style="background-color: var(--bg-surface-secondary); border-style: dashed; border-width: 2px; padding: var(--space-xl); text-align: center; margin-top: var(--space-md);">
        <input id="evidenceInput" type="file" accept="image/jpeg,image/png,image/webp" style="display: none;" ${isPending ? "disabled" : ""}>
        
        <label for="evidenceInput" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="font-size: 2.5rem;">📷</div>
          <strong style="font-size: 1.05rem;">Haz clic para seleccionar o arrastra una fotografía</strong>
          <small class="text-muted">Formatos JPG, PNG o WebP (máximo 15 MB original)</small>
        </label>

        <img id="previewImg" class="hidden" style="display: none; max-height: 240px; margin: var(--space-md) auto 0 auto; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);" alt="Vista previa de evidencia">
        
        <p id="fileName" class="text-muted" style="font-size: 0.85rem; margin-top: var(--space-sm); margin-bottom: 0;">Ningún archivo seleccionado aún.</p>

        <div id="uploadProgress" class="hidden" style="display: none; margin-top: var(--space-md); width: 100%; max-width: 380px; margin-left: auto; margin-right: auto;">
          <div style="height: 8px; width: 100%; background: var(--border-subtle); border-radius: 4px; overflow: hidden;">
            <div id="uploadProgressFill" style="height: 100%; width: 0; background: var(--forest-600); transition: width 200ms ease;"></div>
          </div>
          <small id="uploadProgressText" class="text-muted" style="display: block; margin-top: 4px;">Preparando…</small>
        </div>
      </div>

      <div style="margin-top: var(--space-lg); display: flex; flex-wrap: wrap; gap: var(--space-sm); align-items: center; justify-content: space-between;">
        <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0; max-width: 420px;">
          Tu foto se procesa con compresión en el navegador y se almacena de forma segura para verificación comunitaria.
        </p>

        <button id="submitEvidenceBtn" class="btn btn-primary" ${isPending ? "disabled" : ""}>
          ${submitLabel}
        </button>
      </div>
    </div>
  `;

  // Selector de reto
  document.getElementById("challengeSelect")?.addEventListener("change", e => {
    const newId = e.target.value;
    window.history.replaceState(null, "", `challenge.html?id=${newId}`);
    render();
  });

  const input = document.getElementById("evidenceInput");
  const preview = document.getElementById("previewImg");
  const fileName = document.getElementById("fileName");
  const submit = document.getElementById("submitEvidenceBtn");
  let selectedFile = null;
  let compressedBlob = null;

  const selectFile = async file => {
    try {
      if (!file || !file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen válido.");
      if (file.size > 15 * 1024 * 1024) throw new Error("La foto original debe pesar menos de 15 MB.");
      selectedFile = file;
      compressedBlob = null;
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
      fileName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB original`;
    } catch (error) {
      selectedFile = null;
      showToast(error.message, "error");
    }
  };

  input?.addEventListener("change", () => selectFile(input.files?.[0]));

  submit?.addEventListener("click", async () => {
    if (isPending) return;
    if (!selectedFile) return showToast("Por favor selecciona una fotografía primero.", "error");

    submit.disabled = true;
    submit.textContent = "Procesando imagen…";

    const progressWrap = document.getElementById("uploadProgress");
    const fill = document.getElementById("uploadProgressFill");
    const progressText = document.getElementById("uploadProgressText");

    progressWrap.style.display = "block";

    try {
      compressedBlob = await compressImage(selectedFile);
      fileName.textContent = `${selectedFile.name} → ${(compressedBlob.size / 1024).toFixed(0)} KB optimizada`;

      assertSupabaseConfigured();
      const path = `${user.id}/${Date.now()}_${uid("photo").slice(-8)}.jpg`;

      fill.style.width = "25%";
      progressText.textContent = "Subiendo fotografía a almacenamiento seguro…";

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(path, compressedBlob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });

      if (uploadError) throw uploadError;

      fill.style.width = "75%";
      progressText.textContent = "Guardando registro en ECRA…";

      const { data: publicData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
      const imageURL = publicData.publicUrl;

      // Guardar en Firestore
      await addDoc(collection(db, "evidences"), {
        userId: user.id,
        userName: user.name,
        userEmail: user.email || "",
        challengeId: challenge.id,
        challengeNumber: challenge.number,
        storagePath: path,
        imageURL,
        storageProvider: "supabase",
        originalFileName: selectedFile.name,
        fileSize: compressedBlob.size,
        submittedAt: new Date().toISOString(),
        submittedAtServer: serverTimestamp(),
        status: "pending",
        moderatorComment: "",
        reviewedAt: null,
        reviewedBy: null
      });

      // Registrar actividad
      await addDoc(collection(db, "activity"), {
        type: "submission",
        actorUid: user.id,
        actorName: user.name || "Participante ECRA",
        userId: user.id,
        userName: user.name || "Participante ECRA",
        challengeNumber: challenge.number,
        createdAt: new Date().toISOString()
      });

      // Actualizar estado del reto a en progreso
      await setChallengeProgress(user.id, challenge.id, "in_progress", "Evidencia enviada para revisión");

      fill.style.width = "100%";
      progressText.textContent = "¡Evidencia enviada exitosamente!";
      showToast("Evidencia enviada. Quedó registrada y pendiente de moderación.", "success");

      setTimeout(() => render(), 1200);
    } catch (error) {
      console.error(error);
      progressText.textContent = "Error al subir la fotografía.";
      showToast(error?.message || "No se pudo guardar la evidencia. Revisa tu conexión.", "error");
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });
}

document.addEventListener("DOMContentLoaded", render);
