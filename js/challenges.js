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
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La fotografía original supera los 15 MB permitidos.");
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

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // debe coincidir con file_size_limit del bucket en supabase.sql
const VIDEO_EXT_BY_TYPE = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const VIDEO_TYPE_BY_EXT = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

function fileExt(file) {
  return (file?.name?.split(".").pop() || "").toLowerCase();
}

// Devuelve "image", "video" o null según el archivo elegido.
function mediaKind(file) {
  if (!file) return null;
  if (file.type?.startsWith("image/")) return "image";
  if (VIDEO_EXT_BY_TYPE[file.type] || VIDEO_TYPE_BY_EXT[fileExt(file)]) return "video";
  return null;
}

function videoContentType(file) {
  return VIDEO_EXT_BY_TYPE[file.type] ? file.type : (VIDEO_TYPE_BY_EXT[fileExt(file)] || "video/mp4");
}

function videoExtension(file) {
  return VIDEO_EXT_BY_TYPE[file.type] || (VIDEO_TYPE_BY_EXT[fileExt(file)] ? fileExt(file) : "mp4");
}

async function render() {
  const user = await requireParticipant();
  if (!user) return;

  const root = document.getElementById("challengeContent");
  if (!root) return;

  const evidences = await getMyEvidences(user.id);

  // Determinar la misión elegida por URL o por defecto el primero
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
        <small style="color: var(--status-pending-text);">Tu evidencia fue enviada correctamente. La misión se marcará como cumplida cuando el equipo de moderación la apruebe.</small>
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
        <small style="color: var(--status-rejected-text);">${ev.moderatorComment ? escapeHTML(ev.moderatorComment) : "El moderador solicitó una nueva foto o video más claro."}</small>
      </div>
    `;
  }

  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isLocked = isPending || isApproved;
  const submitLabel = isApproved
    ? "Misión cumplida ✓"
    : (status === "rejected" ? "Enviar nueva evidencia" : "Enviar evidencia (foto o video)");

  const challengeOptionsHTML = CHALLENGES.map(c => `
    <option value="${c.id}" ${c.id === challenge.id ? "selected" : ""}>
      ${c.icon} Misión ${c.number}: ${escapeHTML(c.title)}
    </option>
  `).join("");

  root.innerHTML = `
    <div class="card mb-xl">
      <div class="form-group mb-lg">
        <label class="form-label" for="challengeSelect">Seleccionar misión para documentar:</label>
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
        <input id="evidenceInput" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" style="display: none;" ${isLocked ? "disabled" : ""}>
        
        <label for="evidenceInput" style="cursor: ${isLocked ? "default" : "pointer"}; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="font-size: 2.5rem;">📷 🎥</div>
          <strong style="font-size: 1.05rem;">Haz clic para seleccionar una foto o un video</strong>
          <small class="text-muted">Fotos JPG, PNG o WebP (hasta 15 MB) · Videos MP4, WebM o MOV (hasta 50 MB)</small>
        </label>

        <img id="previewImg" class="hidden" style="display: none; max-height: 240px; margin: var(--space-md) auto 0 auto; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);" alt="Vista previa de evidencia">
        <video id="previewVideo" class="hidden" controls playsinline preload="metadata" style="display: none; max-height: 260px; max-width: 100%; margin: var(--space-md) auto 0 auto; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);"></video>
        
        <p id="fileName" class="text-muted" style="font-size: 0.85rem; margin-top: var(--space-sm); margin-bottom: 0;">Ningún archivo seleccionado aún.</p>

        <div id="uploadProgress" class="hidden" style="display: none; margin-top: var(--space-md); width: 100%; max-width: 380px; margin-left: auto; margin-right: auto;">
          <div style="height: 8px; width: 100%; background: var(--border-subtle); border-radius: 4px; overflow: hidden;">
            <div id="uploadProgressFill" style="height: 100%; width: 0; background: var(--forest-600); transition: width 200ms ease;"></div>
          </div>
          <small id="uploadProgressText" class="text-muted" style="display: block; margin-top: 4px;">Preparando…</small>
        </div>
      </div>

      <section class="privacy-consent-panel" aria-labelledby="evidencePrivacyTitle">
        <label class="privacy-consent-label" for="evidencePrivacyConsent">
          <input id="evidencePrivacyConsent" type="checkbox" required aria-describedby="evidencePrivacySummary" ${isLocked ? "disabled" : ""}>
          <span>
            <strong id="evidencePrivacyTitle">Acuerdo de privacidad para fotografías y videos (obligatorio)</strong>
            <span id="evidencePrivacySummary">Autorizo expresamente que mi evidencia se utilice exclusivamente con fines informativos, educativos y para verificar la realización de esta misión dentro de BWC.</span>
          </span>
        </label>
        <details class="privacy-consent-details">
          <summary>Leer el acuerdo completo</summary>
          <div class="privacy-consent-copy">
            <p>Al marcar esta casilla, autorizas expresamente el uso de la fotografía o el video que envíes exclusivamente con fines informativos, educativos y de verificación de misiones. El equipo de moderación podrá revisar el archivo y asociarlo con tu cuenta y la misión correspondiente para resolver su aprobación o rechazo. La evidencia no se utilizará para publicidad, venta ni para otros fines ajenos a los indicados.</p>
            <p>Comparte material propio o para el que tengas autorización. Evita incluir rostros de otras personas, especialmente menores de edad, matrículas, direcciones, documentos u otros datos personales sin permiso.</p>
            <p><strong>Importante sobre el almacenamiento:</strong> las evidencias se guardan en el almacenamiento del proyecto mediante un enlace público para que el panel de moderación pueda mostrarlas. Por ello, cualquier persona que obtenga la URL del archivo podría acceder a él. No subas contenido que necesite confidencialidad estricta ni material sensible.</p>
            <p>Contacto del proyecto para consultas sobre una evidencia: <a href="mailto:proyecto.ecracr@gmail.com">proyecto.ecracr@gmail.com</a>.</p>
          </div>
        </details>
      </section>

      <div style="margin-top: var(--space-lg); display: flex; flex-wrap: wrap; gap: var(--space-sm); align-items: center; justify-content: space-between;">
        <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0; max-width: 420px;">
          <strong>Para cumplir esta misión es obligatorio enviar una foto o un video</strong> que muestre tu acción. Un moderador la revisa y, al aprobarla, la misión queda cumplida.
        </p>

        <button id="submitEvidenceBtn" class="btn btn-primary" ${isLocked ? "disabled" : ""}>
          ${submitLabel}
        </button>
      </div>
    </div>
  `;

  // Selector de misión
  document.getElementById("challengeSelect")?.addEventListener("change", e => {
    const newId = e.target.value;
    window.history.replaceState(null, "", `challenge.html?id=${newId}`);
    render();
  });

  const input = document.getElementById("evidenceInput");
  const preview = document.getElementById("previewImg");
  const previewVideo = document.getElementById("previewVideo");
  const fileName = document.getElementById("fileName");
  const submit = document.getElementById("submitEvidenceBtn");
  const privacyConsent = document.getElementById("evidencePrivacyConsent");
  let selectedFile = null;
  let selectedKind = null;
  let previewUrl = null;

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    preview.style.display = "none";
    preview.removeAttribute("src");
    previewVideo.style.display = "none";
    previewVideo.removeAttribute("src");
  };

  const selectFile = file => {
    try {
      const kind = mediaKind(file);
      if (!kind) throw new Error("Selecciona una foto (JPG, PNG o WebP) o un video (MP4, WebM o MOV).");
      if (kind === "image" && file.size > MAX_IMAGE_BYTES) throw new Error("La foto original debe pesar menos de 15 MB.");
      if (kind === "video" && file.size > MAX_VIDEO_BYTES) throw new Error("El video debe pesar menos de 50 MB. Grábalo más corto o en menor calidad.");

      clearPreview();
      selectedFile = file;
      selectedKind = kind;
      previewUrl = URL.createObjectURL(file);
      if (kind === "image") {
        preview.src = previewUrl;
        preview.style.display = "block";
      } else {
        previewVideo.src = previewUrl;
        previewVideo.style.display = "block";
      }
      fileName.textContent = `${kind === "video" ? "🎥" : "📷"} ${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    } catch (error) {
      selectedFile = null;
      selectedKind = null;
      clearPreview();
      showToast(error.message, "error");
    }
  };

  input?.addEventListener("change", () => {
    if (input.files?.[0]) selectFile(input.files[0]);
  });

  submit?.addEventListener("click", async () => {
    if (isLocked) return;
    // La aceptación explícita debe ocurrir antes de iniciar cualquier procesamiento o carga.
    if (!privacyConsent?.checked) {
      return showToast("Debes leer y aceptar expresamente el acuerdo de privacidad antes de enviar la evidencia.", "error");
    }
    // Regla de la misión: sin foto o video no se puede enviar ni completar.
    if (!selectedFile || !selectedKind) return showToast("Para cumplir la misión debes enviar una foto o un video.", "error");

    submit.disabled = true;
    submit.textContent = selectedKind === "video" ? "Preparando video…" : "Procesando imagen…";

    const progressWrap = document.getElementById("uploadProgress");
    const fill = document.getElementById("uploadProgressFill");
    const progressText = document.getElementById("uploadProgressText");

    progressWrap.style.display = "block";
    fill.style.width = "5%";

    try {
      let uploadBody;
      let contentType;
      let extension;

      if (selectedKind === "image") {
        uploadBody = await compressImage(selectedFile);
        contentType = "image/jpeg";
        extension = "jpg";
        fileName.textContent = `${selectedFile.name} → ${(uploadBody.size / 1024).toFixed(0)} KB optimizada`;
      } else {
        uploadBody = selectedFile;
        contentType = videoContentType(selectedFile);
        extension = videoExtension(selectedFile);
      }

      assertSupabaseConfigured();
      const path = `${user.id}/${Date.now()}_${uid(selectedKind).slice(-8)}.${extension}`;

      fill.style.width = "25%";
      progressText.textContent = selectedKind === "video"
        ? "Subiendo video (puede tardar según tu conexión)…"
        : "Subiendo fotografía a almacenamiento seguro…";
      submit.textContent = "Subiendo…";

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(path, uploadBody, { contentType, cacheControl: "31536000", upsert: false });

      if (uploadError) throw uploadError;

      fill.style.width = "75%";
      progressText.textContent = "Guardando registro en ECRA…";

      const { data: publicData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
      const mediaURL = publicData.publicUrl;

      // Guardar en Firestore (imageURL se conserva como nombre de campo por compatibilidad)
      await addDoc(collection(db, "evidences"), {
        userId: user.id,
        userName: user.name,
        userEmail: user.email || "",
        challengeId: challenge.id,
        challengeNumber: challenge.number,
        storagePath: path,
        imageURL: mediaURL,
        mediaType: selectedKind,
        contentType,
        storageProvider: "supabase",
        originalFileName: selectedFile.name,
        fileSize: uploadBody.size,
        privacyAgreementVersion: "2026-10-27",
        privacyConsentAccepted: true,
        privacyConsentAcceptedAt: new Date().toISOString(),
        privacyConsentPurpose: "informativo, educativo y verificación de misiones",
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

      // Actualizar estado de la misión a en progreso (se completa cuando el moderador aprueba)
      await setChallengeProgress(user.id, challenge.id, "in_progress", "Evidencia enviada para revisión");

      fill.style.width = "100%";
      progressText.textContent = "¡Evidencia enviada exitosamente!";
      showToast("Evidencia enviada. Quedó registrada y pendiente de moderación.", "success");

      setTimeout(() => render(), 1200);
    } catch (error) {
      console.error(error);
      progressText.textContent = selectedKind === "video" ? "Error al subir el video." : "Error al subir la fotografía.";
      showToast(error?.message || "No se pudo guardar la evidencia. Revisa tu conexión.", "error");
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });
}

document.addEventListener("DOMContentLoaded", render);
