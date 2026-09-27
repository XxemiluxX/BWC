import "./app.js";
import {
  collection, getDocs, addDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { supabase, SUPABASE_BUCKET, assertSupabaseConfigured } from "./supabase-client.js";

const { db, CHALLENGES, requireParticipant, formatDate, escapeHTML, showToast, uid } = window.BWC;

function timeValue(value) { const d = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }

function latestEvidenceFrom(list, challengeId) {
  return list.filter(e => e.challengeId === challengeId).sort((a,b) => timeValue(b.submittedAt) - timeValue(a.submittedAt))[0] || null;
}

async function getMyEvidences(userId) {
  const snap = await getDocs(query(collection(db, "evidences"), where("userId", "==", userId)));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Solo se permiten imágenes.");
  if (file.size > 15 * 1024 * 1024) throw new Error("La foto original supera 15 MB.");
  const img = await fileToImage(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { alpha:false });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("No se pudo preparar la fotografía.");
  return blob;
}

async function render() {
  const user = await requireParticipant(); if (!user) return;
  const root = document.getElementById("challengeContent");
  if (!root) return;
  const evidences = await getMyEvidences(user.id);

  if (user.completed >= 3) {
    root.innerHTML = `<section class="celebration-screen reveal"><div class="celebration-inner"><div class="celebration-planet">🌎</div><span class="eyebrow">BETTER WORLD CHALLENGE</span><h1>¡Felicidades, <span>${escapeHTML(user.name?.split(" ")[0] || "participante")}!</span></h1><p>Has completado todos los desafíos de Better World Challenge.</p><p>Gracias por participar y contribuir a construir un mundo mejor.</p><div class="completion-badge">🏆 BETTER WORLD CHALLENGE COMPLETADO</div><div><b>DESAFÍOS COMPLETADOS: 3/3</b></div><div class="celebration-actions"><a class="btn btn-primary" href="profile.html">Volver a mi perfil</a><a class="btn btn-ghost" href="profile.html#evidenceHistory">Ver mi progreso</a></div></div></section>`;
    return;
  }

  const challenge = CHALLENGES[user.completed] || CHALLENGES[0];
  const ev = latestEvidenceFrom(evidences, challenge.id);
  const status = ev?.status || "none";
  let stateHTML = "";
  if (status === "pending") stateHTML = `<div class="submission-state pending"><b>🟡 PENDIENTE DE REVISIÓN</b><br><small>Tu evidencia fue enviada correctamente. El moderador debe revisarla antes de que puedas avanzar.</small></div>`;
  if (status === "rejected") stateHTML = `<div class="submission-state rejected"><b>🔴 Tu evidencia necesita otra revisión</b><br><small>${ev.moderatorComment ? escapeHTML(ev.moderatorComment) : "El moderador solicitó una nueva evidencia."}</small></div>`;

  const disabled = status === "pending" ? "disabled" : "";
  const submitLabel = status === "rejected" ? "Enviar nueva evidencia" : "SUBIR EVIDENCIA";
  root.innerHTML = `<section class="challenge-hero reveal"><article class="challenge-copy"><div class="challenge-index">${challenge.icon} DESAFÍO ${challenge.number} DE 3</div><h1>${escapeHTML(challenge.title.split(" ").slice(0,-1).join(" "))} <span>${escapeHTML(challenge.title.split(" ").slice(-1)[0])}</span></h1><p>${escapeHTML(challenge.instruction)}</p><div class="challenge-callout"><b>📸 Tu evidencia</b><p>Realiza la actividad y captura una fotografía clara. La aprobación es manual y la foto queda almacenada en Supabase Storage para la moderación.</p></div>${stateHTML}<a href="profile.html" class="btn btn-ghost">← Volver a mi perfil</a></article><article class="upload-card"><div><span class="eyebrow">EVIDENCIA FOTOGRÁFICA</span><h2>${status === "pending" ? "Esperando revisión" : status === "rejected" ? "Corrige tu evidencia" : "Demuestra tu acción"}</h2><label class="drop-zone" id="dropZone" for="evidenceInput"><input id="evidenceInput" type="file" accept="image/jpeg,image/png,image/webp" ${disabled}><div class="drop-icon">📷</div><b>Selecciona una fotografía</b><small>JPG, PNG o WebP · máximo 15 MB original</small></label><img id="previewImg" class="preview-img hidden" alt="Vista previa de la evidencia"><p id="fileName" class="upload-note">Aún no has seleccionado una imagen.</p><div id="uploadProgress" class="upload-progress hidden"><div class="upload-progress-bar"><span id="uploadProgressFill"></span></div><small id="uploadProgressText">Preparando…</small></div></div><div><button id="submitEvidenceBtn" class="btn btn-primary btn-full" ${disabled}>${submitLabel}</button><p class="upload-note">La imagen se comprime en el navegador y se guarda en Supabase Storage. El moderador podrá verla aunque cambies de dispositivo.</p></div></article></section>`;

  const input = document.getElementById("evidenceInput");
  const drop = document.getElementById("dropZone");
  const preview = document.getElementById("previewImg");
  const fileName = document.getElementById("fileName");
  const submit = document.getElementById("submitEvidenceBtn");
  let selectedFile = null;
  let compressedBlob = null;

  const selectFile = async file => {
    try {
      if (!file || !file.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
      if (file.size > 15 * 1024 * 1024) throw new Error("La foto original debe pesar menos de 15 MB.");
      selectedFile = file; compressedBlob = null;
      preview.src = URL.createObjectURL(file); preview.classList.remove("hidden");
      fileName.textContent = `${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`;
    } catch (error) { selectedFile = null; showToast(error.message); }
  };
  input?.addEventListener("change", () => selectFile(input.files?.[0]));
  ["dragenter","dragover"].forEach(evt => drop?.addEventListener(evt, e => { e.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave","drop"].forEach(evt => drop?.addEventListener(evt, e => { e.preventDefault(); drop.classList.remove("drag"); }));
  drop?.addEventListener("drop", e => selectFile(e.dataTransfer?.files?.[0]));

  submit?.addEventListener("click", async () => {
    if (status === "pending") return;
    if (!selectedFile) return showToast("Selecciona una fotografía antes de enviarla.");
    submit.disabled = true; submit.textContent = "Preparando fotografía…";
    const progressWrap = document.getElementById("uploadProgress");
    const fill = document.getElementById("uploadProgressFill");
    const progressText = document.getElementById("uploadProgressText");
    progressWrap.classList.remove("hidden");
    try {
      compressedBlob = await compressImage(selectedFile);
      fileName.textContent = `${selectedFile.name} → ${(compressedBlob.size/1024/1024).toFixed(2)} MB optimizada`;
      assertSupabaseConfigured();
      const path = `${user.id}/${Date.now()}_${uid("photo").slice(-8)}.jpg`;
      fill.style.width = "15%";
      progressText.textContent = "Subiendo a Supabase Storage…";
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(path, compressedBlob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      fill.style.width = "85%";
      progressText.textContent = "Generando enlace de la fotografía…";
      const { data: publicData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
      const imageURL = publicData.publicUrl;
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
      await addDoc(collection(db, "activity"), {
        type: "submission",
        actorUid: user.id,
        actorName: user.name || "Usuario",
        userId: user.id,
        userName: user.name || "Usuario",
        challengeNumber: challenge.number,
        createdAt: new Date().toISOString()
      });
      fill.style.width = "100%";
      progressText.textContent = "Evidencia guardada.";
      showToast("Evidencia enviada y guardada. Quedó pendiente de revisión.");
      await render();
    } catch (error) {
      console.error(error);
      progressText.textContent = "No se pudo completar la subida.";
      showToast(error?.message || "No se pudo guardar la evidencia. Revisa tu conexión y las reglas de Firebase.");
      submit.disabled = false; submit.textContent = submitLabel;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => { render().catch(error => { console.error(error); showToast("No se pudo cargar el desafío."); }); });
