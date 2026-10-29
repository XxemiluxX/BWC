import "./app.js";
import { auth, db } from "./firebase-client.js";
import { supabase, SUPABASE_BUCKET, assertSupabaseConfigured } from "./supabase-client.js";
import { cosmeticsFromUser, avatarHTML, titleChipHTML } from "./missions-data.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const {
  formatDate,
  formatDateShort,
  escapeHTML,
  showToast,
  openModal,
  waitForAuth,
  getCurrentProfile,
  initials,
  timeValue,
  FORUM_CATEGORIES,
  FORUM_STATUSES,
  FORUM_TYPES,
  CONTRIBUTION_OPTIONS,
  isConfiguredAdmin,
  nowISO
} = window.ECRA;

// Recompensas de las misiones (marco y título) por autor, para mostrarlas junto al nombre
let cosmeticsByUid = {};
async function loadCosmetics() {
  try {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.role === "admin") return;
      const cos = cosmeticsFromUser(data);
      if (cos.frame || cos.title) map[d.id] = cos;
    });
    cosmeticsByUid = map;
  } catch (error) {
    console.warn("No se pudieron cargar los marcos y títulos:", error);
  }
}

let currentUser = null;
let allPosts = [];
let filters = {
  search: "",
  category: "all",
  type: "all",
  status: "all",
  sort: "newest"
};

// Resuelve (o reintenta resolver) el usuario actual. Si el perfil de Firestore no carga,
// se usa la sesión de Firebase Auth para que "crear publicación" no mande a login por error.
async function ensureCurrentUser() {
  if (currentUser) return currentUser;
  try {
    currentUser = await getCurrentProfile();
  } catch (e) {
    console.warn("No se pudo cargar el perfil en Firestore:", e);
  }
  if (!currentUser) {
    try {
      const authUser = await waitForAuth();
      if (authUser) {
        currentUser = {
          id: authUser.uid,
          name: authUser.displayName || authUser.email?.split("@")[0] || "Miembro de ECRA",
          email: authUser.email || ""
        };
      }
    } catch (e) { /* sin sesión */ }
  }
  return currentUser;
}


// UID real de Firebase Auth: es el que comparan las reglas de Firestore (authorId == request.auth.uid).
function authUid() {
  return auth.currentUser?.uid || currentUser?.id || null;
}

// Evita que el botón se quede en "Guardando..." para siempre si Firestore no responde
// (base de datos no creada, reglas sin publicar o sin conexión).
function withTimeout(promise, ms = 15000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "timeout" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Las imágenes de portada se comprimen en el navegador y se guardan en Supabase Storage.
// Así Firestore conserva solamente la URL, no el contenido pesado de la fotografía.
const MAX_FORUM_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_FORUM_IMAGE_UPLOAD_BYTES = 2.5 * 1024 * 1024;

function loadForumImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo abrir la imagen. Prueba con un archivo JPG, PNG o WebP."));
    };
    image.src = objectUrl;
  });
}

async function compressForumImage(file) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!file || !supportedTypes.includes(file.type)) {
    throw new Error("Elige una fotografía JPG, PNG o WebP.");
  }
  if (file.size > MAX_FORUM_IMAGE_BYTES) {
    throw new Error("La fotografía original no puede superar los 15 MB.");
  }

  const image = await loadForumImage(file);
  const originalScale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  let lastBlob = null;

  for (const resizeFactor of [1, 0.85, 0.7]) {
    const scale = originalScale * resizeFactor;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("No se pudo preparar la fotografía en este navegador.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.84, 0.76, 0.68]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("No se pudo optimizar la fotografía.");
      lastBlob = blob;
      if (blob.size <= MAX_FORUM_IMAGE_UPLOAD_BYTES) return blob;
    }
  }

  if (lastBlob && lastBlob.size <= 4 * 1024 * 1024) return lastBlob;
  throw new Error("La fotografía es demasiado pesada incluso después de optimizarla. Prueba con otra imagen.");
}

function safeForumImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value);
    const isSupabasePublicImage = url.hostname.endsWith(".supabase.co")
      && url.pathname.includes(`/storage/v1/object/public/${SUPABASE_BUCKET}/`);
    return url.protocol === "https:" && isSupabasePublicImage ? url.href : "";
  } catch {
    return "";
  }
}

function firestoreErrorMessage(err, action = "guardar") {
  switch (err?.code) {
    case "permission-denied":
      return `Firestore rechazó la acción por permisos. Publica las reglas de firestore.rules en Firebase (Firestore → Reglas → Publicar) o ejecuta: firebase deploy --only firestore:rules`;
    case "unauthenticated":
      return "Tu sesión expiró. Inicia sesión de nuevo e inténtalo otra vez.";
    case "timeout":
    case "unavailable":
      return `No hubo respuesta de Firestore al ${action}. Revisa tu conexión y que la base de datos Cloud Firestore esté creada en el proyecto de Firebase.`;
    case "failed-precondition":
      return "Firestore necesita un índice o la base de datos aún no está lista. Revisa la consola de Firebase.";
    default:
      return `Ocurrió un error al ${action} (${err?.code || "desconocido"}). Inténtalo de nuevo.`;
  }
}

// Generar insignia de estado
function statusBadge(statusKey) {
  const s = FORUM_STATUSES[statusKey] || FORUM_STATUSES.proposal;
  return `<span class="status-badge ${s.class}">${s.badge}</span>`;
}

// Generar tarjeta de publicación
function renderPostCard(post) {
  const cat = FORUM_CATEGORIES[post.category] || FORUM_CATEGORIES.general;
  const pType = FORUM_TYPES[post.type] || FORUM_TYPES.idea;
  const commentsCount = Number(post.commentsCount || 0);
  const participantsCount = Number(post.participantsCount || 0);
  const postImage = safeForumImageUrl(post.imageUrl);

  return `
    <article class="post-card reveal" data-post-id="${post.id}" data-category="${post.category}">
      ${postImage ? `
        <div class="post-cover">
          <img src="${escapeHTML(postImage)}" alt="Portada de ${escapeHTML(post.title || "la iniciativa")}" loading="lazy" decoding="async">
        </div>
      ` : ""}
      <div class="post-header">
        ${avatarHTML(post.authorName || "C", cosmeticsByUid[post.authorId], { size: "post", coreClass: "post-avatar" })}
        <div class="post-meta">
          <div class="post-author">${escapeHTML(post.authorName || "Miembro de la comunidad")}</div>
          ${cosmeticsByUid[post.authorId]?.title ? titleChipHTML(cosmeticsByUid[post.authorId].title) : ""}
          <div class="post-date">Publicado el ${formatDateShort(post.createdAt)}</div>
        </div>
        <div>
          ${statusBadge(post.status)}
        </div>
      </div>

      <div class="post-tags-row">
        <span class="tag-category">${cat.icon} ${escapeHTML(cat.label)}</span>
        <span class="tag-type">${pType.icon} ${escapeHTML(pType.label)}</span>
        ${post.location ? `<span class="tag-location">${escapeHTML(post.location)}</span>` : ""}
      </div>

      <h3 class="post-title">${escapeHTML(post.title)}</h3>
      <p class="post-description">${escapeHTML(post.description || "")}</p>

      <div class="post-footer">
        <div class="post-stats-group">
          <span title="Comentarios ciudadanos">${commentsCount} ${commentsCount === 1 ? "comentario" : "comentarios"}</span>
          <span title="Voluntarios registrados">${participantsCount} ${participantsCount === 1 ? "colaborador" : "colaboradores"}</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" data-action="view-post" data-id="${post.id}" type="button">
            Ver detalle
          </button>
          <button class="btn btn-primary btn-sm" data-action="collaborate-quick" data-id="${post.id}" type="button">
            Colaborar
          </button>
        </div>
      </div>
    </article>
  `;
}

// Filtrar y ordenar publicaciones
function filterAndRenderPosts() {
  const grid = document.getElementById("postsGrid");
  const noPosts = document.getElementById("noPosts");
  const loading = document.getElementById("postsLoading");

  if (loading) loading.style.display = "none";
  if (!grid) return;

  const search = filters.search.trim().toLowerCase();

  let filtered = allPosts.filter(p => {
    const matchesSearch = !search ||
      (p.title && p.title.toLowerCase().includes(search)) ||
      (p.description && p.description.toLowerCase().includes(search)) ||
      (p.location && p.location.toLowerCase().includes(search)) ||
      (p.authorName && p.authorName.toLowerCase().includes(search));

    const matchesCategory = filters.category === "all" || p.category === filters.category;
    const matchesType = filters.type === "all" || p.type === filters.type;
    const matchesStatus = filters.status === "all" || p.status === filters.status;

    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  // Ordenar
  if (filters.sort === "newest") {
    filtered.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
  } else if (filters.sort === "participants") {
    filtered.sort((a, b) => (Number(b.participantsCount) || 0) - (Number(a.participantsCount) || 0));
  } else if (filters.sort === "comments") {
    filtered.sort((a, b) => (Number(b.commentsCount) || 0) - (Number(a.commentsCount) || 0));
  }

  if (filtered.length === 0) {
    grid.innerHTML = "";
    if (noPosts) noPosts.classList.remove("hidden");
  } else {
    if (noPosts) noPosts.classList.add("hidden");
    grid.innerHTML = filtered.map(renderPostCard).join("");
  }

  bindPostGridEvents();
}

function bindPostGridEvents() {
  document.querySelectorAll("[data-action='view-post']").forEach(btn => {
    btn.addEventListener("click", () => openPostDetail(btn.dataset.id));
  });

  document.querySelectorAll("[data-action='collaborate-quick']").forEach(btn => {
    btn.addEventListener("click", () => {
      const postId = btn.dataset.id;
      if (!currentUser) {
        showToast("Inicia sesión para registrarte como colaborador.");
        window.location.href = "login.html";
        return;
      }
      openVolunteerModal(postId);
    });
  });
}

// Cargar publicaciones de Firestore
async function loadPosts() {
  const loading = document.getElementById("postsLoading");
  if (loading) loading.style.display = "block";

  try {
    const q = query(collection(db, "forumPosts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    filterAndRenderPosts();
  } catch (error) {
    console.error("Error al cargar publicaciones de foros:", error);
    showToast("No se pudieron cargar las publicaciones comunitarias.");
    if (loading) loading.style.display = "none";
  }
}

// Modal para crear nueva publicación
async function openCreatePostModal() {
  await ensureCurrentUser();
  if (!currentUser) {
    showToast("Debes iniciar sesión para publicar en los foros.");
    setTimeout(() => { window.location.href = "login.html"; }, 900);
    return;
  }

  const categoryOptions = Object.entries(FORUM_CATEGORIES).map(([key, cat]) => `
    <option value="${key}">${cat.icon} ${cat.label}</option>
  `).join("");

  const typeOptions = Object.entries(FORUM_TYPES).map(([key, item]) => `
    <option value="${key}">${item.icon} ${item.label}</option>
  `).join("");

  const statusOptions = Object.entries(FORUM_STATUSES).map(([key, item]) => `
    <option value="${key}">${item.badge}</option>
  `).join("");

  const modal = openModal(`
    <div class="modal-header">
      <div>
        <span class="eyebrow">PROPUESTA CIUDADANA</span>
        <h2>Crear nueva publicación o iniciativa</h2>
      </div>
      <button class="modal-close-btn" data-close type="button" aria-label="Cerrar ventana">✕</button>
    </div>

    <form id="createPostForm" novalidate>
      <div class="form-group">
        <label class="form-label" for="newPostTitle">Título de la publicación *</label>
        <input class="form-input" id="newPostTitle" type="text" placeholder="Ej: Jornada de reforestación en la microcuenca del Río..." required minlength="6" maxlength="120">
        <span class="form-helper">Sé claro y específico para que tu comunidad comprenda de inmediato.</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
        <div class="form-group">
          <label class="form-label" for="newPostCategory">Categoría ambiental *</label>
          <select class="form-select" id="newPostCategory" required>
            ${categoryOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="newPostType">Tipo de publicación *</label>
          <select class="form-select" id="newPostType" required>
            ${typeOptions}
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-md);">
        <div class="form-group">
          <label class="form-label" for="newPostLocation">Comunidad / Ubicación general</label>
          <input class="form-input" id="newPostLocation" type="text" placeholder="Ej: Palmichal de Acosta, Barrio Escalante, o Nacional">
          <span class="form-helper">Indica tu comunidad, cantón o cantones beneficiados.</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="newPostStatus">Estado inicial *</label>
          <select class="form-select" id="newPostStatus" required>
            ${statusOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="newPostDescription">Descripción del problema o propuesta *</label>
        <textarea class="form-textarea" id="newPostDescription" placeholder="Explica en qué consiste la situación, qué se quiere lograr, antecedentes o por qué es importante para la comunidad..." required minlength="25" rows="4"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label" for="newPostParticipation">¿Cómo puede participar la comunidad? (Opcional)</label>
        <input class="form-input" id="newPostParticipation" type="text" placeholder="Ej: Necesitamos 10 personas para limpieza, herramientas de jardinería o difusión.">
        <span class="form-helper">Incentiva la acción colectiva aclarando qué tipo de apoyo se requiere.</span>
      </div>

      <div class="form-group">
        <label class="form-label" for="newPostImage">Foto de portada (opcional)</label>
        <div class="forum-image-upload">
          <input class="form-input forum-image-input" id="newPostImage" type="file" accept="image/jpeg,image/png,image/webp">
          <span class="form-helper">La foto aparecerá en la portada del foro. Se optimiza automáticamente; máximo 15 MB antes de comprimir.</span>
          <div class="forum-image-preview-wrap" id="newPostImagePreviewWrap" hidden>
            <img class="forum-image-preview" id="newPostImagePreview" alt="Vista previa de la portada" loading="lazy">
            <button class="btn btn-ghost btn-sm forum-image-remove" id="removePostImageBtn" type="button">Quitar foto</button>
          </div>
        </div>
      </div>

      <div id="createPostMsg" class="form-message" role="status"></div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg);">
        <button class="btn btn-ghost" data-close type="button">Cancelar</button>
        <button class="btn btn-primary" id="submitCreatePostBtn" type="submit">Publicar iniciativa</button>
      </div>
    </form>
  `);

  const form = modal.root.querySelector("#createPostForm");
  const msg = modal.root.querySelector("#createPostMsg");
  const submitBtn = modal.root.querySelector("#submitCreatePostBtn");
  const imageInput = modal.root.querySelector("#newPostImage");
  const imagePreviewWrap = modal.root.querySelector("#newPostImagePreviewWrap");
  const imagePreview = modal.root.querySelector("#newPostImagePreview");
  const removeImageBtn = modal.root.querySelector("#removePostImageBtn");
  let selectedImageFile = null;
  let imagePreviewUrl = null;

  const clearSelectedImage = () => {
    selectedImageFile = null;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    imagePreviewUrl = null;
    if (imagePreview) imagePreview.removeAttribute("src");
    if (imagePreviewWrap) imagePreviewWrap.hidden = true;
    if (imageInput) imageInput.value = "";
  };

  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    msg.className = "form-message";
    msg.textContent = "";
    if (!file) {
      clearSelectedImage();
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      clearSelectedImage();
      msg.className = "form-message error";
      msg.textContent = "Elige una fotografía JPG, PNG o WebP.";
      return;
    }
    if (file.size > MAX_FORUM_IMAGE_BYTES) {
      clearSelectedImage();
      msg.className = "form-message error";
      msg.textContent = "La fotografía original no puede superar los 15 MB.";
      return;
    }

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    selectedImageFile = file;
    imagePreviewUrl = URL.createObjectURL(file);
    imagePreview.src = imagePreviewUrl;
    imagePreviewWrap.hidden = false;
  });

  removeImageBtn?.addEventListener("click", clearSelectedImage);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "form-message";
    msg.textContent = "";

    const title = form.querySelector("#newPostTitle").value.trim();
    const category = form.querySelector("#newPostCategory").value;
    const type = form.querySelector("#newPostType").value;
    const location = form.querySelector("#newPostLocation").value.trim();
    const status = form.querySelector("#newPostStatus").value;
    const description = form.querySelector("#newPostDescription").value.trim();
    const participation = form.querySelector("#newPostParticipation").value.trim();

    if (title.length < 6) {
      msg.className = "form-message error";
      msg.textContent = "El título debe tener al menos 6 caracteres descriptivos.";
      return;
    }

    if (description.length < 25) {
      msg.className = "form-message error";
      msg.textContent = "Por favor explica la propuesta con al menos 25 caracteres para que sea comprensible.";
      return;
    }

    const authorId = authUid();
    if (!authorId) {
      msg.className = "form-message error";
      msg.textContent = "No se detectó tu sesión. Inicia sesión de nuevo para publicar.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = selectedImageFile ? "Preparando fotografía…" : "Publicando iniciativa…";
    const imageToUpload = selectedImageFile;
    let imageUrl = "";
    let imageStoragePath = "";
    let submitStage = "procesar la fotografía";

    try {
      if (imageToUpload) {
        const optimizedImage = await compressForumImage(imageToUpload);
        assertSupabaseConfigured();
        imageStoragePath = `${authorId}/forums/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
        submitBtn.textContent = "Subiendo fotografía…";

        const { error: uploadError } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(imageStoragePath, optimizedImage, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
            upsert: false
          });

        if (uploadError) {
          throw new Error(`No se pudo subir la fotografía: ${uploadError.message || "revisa la configuración de Supabase Storage"}.`);
        }

        const { data: publicData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(imageStoragePath);
        imageUrl = publicData?.publicUrl || "";
        if (!imageUrl) throw new Error("La fotografía se subió, pero no se pudo obtener su enlace público.");
      }

      submitStage = "guardar la publicación";
      submitBtn.textContent = "Publicando iniciativa…";
      const docRef = await withTimeout(addDoc(collection(db, "forumPosts"), {
        title,
        category,
        type,
        location,
        status,
        description,
        participation,
        imageUrl,
        imageStoragePath,
        authorId,
        authorName: currentUser.name || "Miembro de ECRA",
        authorEmail: currentUser.email || "",
        commentsCount: 0,
        participantsCount: 0,
        createdAt: nowISO(),
        createdAtServer: serverTimestamp()
      }));

      clearSelectedImage();
      modal.close();
      showToast("¡Iniciativa publicada exitosamente en los foros!");
      await loadPosts();
      openPostDetail(docRef.id);
    } catch (err) {
      console.error("Error al crear publicación:", err);
      msg.className = "form-message error";
      msg.textContent = submitStage === "guardar la publicación"
        ? firestoreErrorMessage(err, "guardar la publicación")
        : (err?.message || "No se pudo procesar la fotografía. Inténtalo de nuevo.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Publicar iniciativa";
    }
  });
}

// Modal de Detalle Completo de Publicación
async function openPostDetail(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) {
    showToast("Publicación no encontrada.");
    return;
  }

  const cat = FORUM_CATEGORIES[post.category] || FORUM_CATEGORIES.general;
  const pType = FORUM_TYPES[post.type] || FORUM_TYPES.idea;
  const postImage = safeForumImageUrl(post.imageUrl);
  const isAuthor = currentUser && currentUser.id === post.authorId;
  const isAdmin = currentUser && (currentUser.isAdmin || isConfiguredAdmin(currentUser.email));

  // Abrir modal con esqueleto y luego inyectar datos de comentarios y voluntarios
  const modal = openModal(`
    <div class="modal-header">
      <div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
          <span class="tag-category">${cat.icon} ${escapeHTML(cat.label)}</span>
          <span class="tag-type">${pType.icon} ${escapeHTML(pType.label)}</span>
          ${statusBadge(post.status)}
        </div>
        <h2 style="font-size: 1.5rem; line-height: 1.25; margin-bottom: 4px;">${escapeHTML(post.title)}</h2>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Iniciativa de <strong>${escapeHTML(post.authorName || "Anónimo")}</strong> · ${formatDate(post.createdAt)}
          ${post.location ? `· ${escapeHTML(post.location)}` : ""}
        </div>
      </div>
      <button class="modal-close-btn" data-close type="button" aria-label="Cerrar">✕</button>
    </div>

    ${postImage ? `<img class="post-detail-image" src="${escapeHTML(postImage)}" alt="Fotografía de la iniciativa: ${escapeHTML(post.title || "publicación comunitaria")}" loading="lazy" decoding="async">` : ""}

    <!-- Descripción Principal -->
    <div style="margin-bottom: var(--space-lg); line-height: 1.6; color: var(--text-primary); font-size: 1rem; white-space: pre-line;">
      ${escapeHTML(post.description)}
    </div>

    <!-- Callout de Participación si existe -->
    ${post.participation ? `
      <div style="background-color: var(--forest-50); border: 1px solid var(--forest-200); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-lg);">
        <strong style="color: var(--tint-text); display: block; margin-bottom: 4px;">¿Cómo puedes colaborar en esta iniciativa?</strong>
        <p style="margin: 0; font-size: 0.925rem; color: var(--tint-text);">${escapeHTML(post.participation)}</p>
      </div>
    ` : ""}

    <!-- Barra de Acciones del Proyecto -->
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-sm); padding-bottom: var(--space-md); border-bottom: 1px solid var(--border-subtle); margin-bottom: var(--space-lg);">
      <button class="btn btn-primary" id="btnParticipateInDetail" type="button">
        Quiero colaborar en este proyecto
      </button>

      <div style="display: flex; gap: 6px;">
        ${(isAuthor || isAdmin) ? `
          <button class="btn btn-secondary btn-sm" id="btnChangeStatus" type="button">
            Cambiar estado
          </button>
          <button class="btn btn-danger btn-sm" id="btnDeletePost" type="button">
            Eliminar
          </button>
        ` : `
          <button class="btn btn-ghost btn-sm" id="btnReportPost" type="button" style="color: var(--text-muted);">
            Reportar
          </button>
        `}
      </div>
    </div>

    <!-- Sección de Personas Interesadas / Voluntarios -->
    <div style="margin-bottom: var(--space-xl);">
      <h3 style="font-size: 1.1rem; margin-bottom: var(--space-xs);">
        Personas colaboradoras (<span id="volunteersCount">${Number(post.participantsCount || 0)}</span>)
      </h3>
      <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: var(--space-sm);">
        Por protección a la privacidad ciudadana, únicamente se muestra el nombre público y el tipo de aporte de cada persona registrada.
      </p>
      <div id="volunteersContainer" class="volunteers-pill-list">
        <span class="text-muted" style="font-size: 0.85rem;">Cargando colaboradores...</span>
      </div>
    </div>

    <!-- Sección de Comentarios y Soluciones -->
    <div class="comments-container">
      <h3 style="font-size: 1.15rem; margin-bottom: var(--space-xs);">
        Conversación y propuestas (<span id="commentsCount">${Number(post.commentsCount || 0)}</span>)
      </h3>
      <p style="font-size: 0.825rem; color: var(--text-muted);">
        Aporta soluciones, comparte recursos o coordina con los organizadores de forma constructiva.
      </p>

      <div id="commentsList" class="comment-list">
        <span class="text-muted" style="font-size: 0.85rem;">Cargando comentarios...</span>
      </div>

      <!-- Formulario para agregar comentario -->
      <div id="commentFormContainer" style="margin-top: var(--space-md);">
        ${currentUser ? `
          <form id="newCommentForm" style="display: flex; flex-direction: column; gap: 8px;">
            <textarea class="form-textarea" id="commentTextInput" placeholder="Escribe tu opinión, propuesta o pregunta para la comunidad..." required minlength="3" rows="3"></textarea>
            <div style="display: flex; justify-content: flex-end;">
              <button class="btn btn-primary btn-sm" type="submit">Enviar comentario</button>
            </div>
          </form>
        ` : `
          <div style="background-color: var(--bg-surface-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: var(--space-md); text-align: center;">
            <p style="margin-bottom: var(--space-xs); font-size: 0.9rem;">Para participar en la conversación debes iniciar sesión.</p>
            <a class="btn btn-secondary btn-sm" href="login.html" data-auth-guest>Iniciar sesión</a>
          </div>
        `}
      </div>
    </div>
  `);

  // Listener para colaborar
  modal.root.querySelector("#btnParticipateInDetail")?.addEventListener("click", () => {
    if (!currentUser) {
      showToast("Debes iniciar sesión para sumarte al proyecto.");
      window.location.href = "login.html";
      return;
    }
    openVolunteerModal(post.id, () => {
      // Recargar voluntarios en este modal
      loadVolunteersForDetail(post.id, modal.root);
    });
  });

  // Listener para reportar
  modal.root.querySelector("#btnReportPost")?.addEventListener("click", () => {
    if (!currentUser) {
      showToast("Inicia sesión para enviar un reporte a moderación.");
      return;
    }
    openReportModal(post.id, post.title);
  });

  // Listener para cambiar estado
  modal.root.querySelector("#btnChangeStatus")?.addEventListener("click", () => {
    openChangeStatusModal(post, modal);
  });

  // Listener para eliminar publicación
  modal.root.querySelector("#btnDeletePost")?.addEventListener("click", async () => {
    const confirmDelete = window.confirm("¿Confirmas que deseas eliminar esta publicación y todas sus participaciones?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "forumPosts", post.id));
      modal.close();
      showToast("Publicación eliminada correctamente.");
      await loadPosts();
    } catch (err) {
      console.error("Error al eliminar publicación:", err);
      showToast("No se pudo eliminar la publicación. Verifica permisos.");
    }
  });

  // Cargar lista de voluntarios
  loadVolunteersForDetail(post.id, modal.root);

  // Cargar lista de comentarios
  loadCommentsForDetail(post.id, modal.root);

  // Manejar envío de comentario
  const commentForm = modal.root.querySelector("#newCommentForm");
  commentForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textInput = commentForm.querySelector("#commentTextInput");
    const text = textInput.value.trim();
    if (!text || text.length < 3) return;

    const submitBtn = commentForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;

    try {
      await addDoc(collection(db, "forumComments"), {
        postId: post.id,
        authorId: authUid(),
        authorName: currentUser.name || "Miembro de la comunidad",
        text,
        createdAt: nowISO(),
        createdAtServer: serverTimestamp()
      });

      // Incrementar contador
      const newCount = (Number(post.commentsCount) || 0) + 1;
      post.commentsCount = newCount;
      await updateDoc(doc(db, "forumPosts", post.id), {
        commentsCount: newCount
      });

      textInput.value = "";
      submitBtn.disabled = false;
      showToast("Comentario agregado.");

      // Recargar comentarios y actualizar badges
      const countEl = modal.root.querySelector("#commentsCount");
      if (countEl) countEl.textContent = String(newCount);
      loadCommentsForDetail(post.id, modal.root);
    } catch (err) {
      console.error("Error al publicar comentario:", err);
      showToast(firestoreErrorMessage(err, "guardar el comentario"));
      submitBtn.disabled = false;
    }
  });
}

// Cargar y mostrar voluntarios de un proyecto
async function loadVolunteersForDetail(postId, rootEl) {
  const container = rootEl.querySelector("#volunteersContainer");
  const countEl = rootEl.querySelector("#volunteersCount");
  if (!container) return;

  try {
    const q = query(collection(db, "forumParticipations"), where("postId", "==", postId));
    const snap = await getDocs(q);
    const volunteers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (countEl) countEl.textContent = String(volunteers.length);

    if (volunteers.length === 0) {
      container.innerHTML = `
        <span class="text-muted" style="font-size: 0.85rem;">
          Aún no hay colaboradores inscritos. ¡Sé la primera persona en sumarte!
        </span>
      `;
      return;
    }

    container.innerHTML = volunteers.map(v => {
      const opt = CONTRIBUTION_OPTIONS.find(o => o.id === v.contributionType) || { label: "Colaborador", icon: "" };
      return `
        <span class="volunteer-pill" title="${v.note ? escapeHTML(v.note) : 'Colaborador registrado'}">
          <span>${opt.icon}</span>
          <span><strong>${escapeHTML(v.userName || "Voluntario")}</strong>: ${escapeHTML(opt.label)}</span>
        </span>
      `;
    }).join("");
  } catch (err) {
    console.error("Error al cargar colaboradores:", err);
    container.innerHTML = `<span class="text-muted" style="font-size: 0.85rem;">No se pudieron cargar los voluntarios.</span>`;
  }
}

// Cargar y mostrar comentarios
async function loadCommentsForDetail(postId, rootEl) {
  const listEl = rootEl.querySelector("#commentsList");
  if (!listEl) return;

  try {
    // Sin orderBy en Firestore: where + orderBy en campos distintos exige un índice compuesto.
    const q = query(collection(db, "forumComments"), where("postId", "==", postId));
    const snap = await getDocs(q);
    const comments = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt));

    if (comments.length === 0) {
      listEl.innerHTML = `
        <div style="background-color: var(--bg-surface-secondary); padding: var(--space-md); border-radius: var(--radius-sm); text-align: center; color: var(--text-muted); font-size: 0.875rem;">
          Aún no hay comentarios en esta iniciativa. Sé el primero en aportar ideas.
        </div>
      `;
      return;
    }

    listEl.innerHTML = comments.map(c => {
      const initial = initials(c.authorName || "C");
      const canDelete = currentUser && (currentUser.id === c.authorId || currentUser.isAdmin || isConfiguredAdmin(currentUser.email));

      return `
        <div class="comment-card" data-comment-id="${c.id}">
          ${avatarHTML(c.authorName || "C", cosmeticsByUid[c.authorId], { size: "xs", coreClass: "post-avatar" })}
          <div class="comment-content">
            <div class="comment-header">
              <span class="name-stack"><span class="comment-author">${escapeHTML(c.authorName || "Anónimo")}</span>${cosmeticsByUid[c.authorId]?.title ? titleChipHTML(cosmeticsByUid[c.authorId].title) : ""}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="comment-date">${formatDate(c.createdAt)}</span>
                ${canDelete ? `
                  <button class="btn btn-ghost" data-delete-comment="${c.id}" type="button" style="padding: 2px 6px; font-size: 0.75rem; color: var(--text-muted);" title="Eliminar comentario">
                    ✕
                  </button>
                ` : ""}
              </div>
            </div>
            <p class="comment-text">${escapeHTML(c.text)}</p>
          </div>
        </div>
      `;
    }).join("");

    // Listener para eliminar comentarios
    listEl.querySelectorAll("[data-delete-comment]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const commentId = btn.dataset.deleteComment;
        try {
          await deleteDoc(doc(db, "forumComments", commentId));
          showToast("Comentario eliminado.");
          loadCommentsForDetail(postId, rootEl);
        } catch (err) {
          console.error("Error al borrar comentario:", err);
          showToast("No se pudo eliminar el comentario.");
        }
      });
    });
  } catch (err) {
    console.error("Error al cargar comentarios:", err);
    listEl.innerHTML = `<span class="text-muted" style="font-size: 0.85rem;">No se pudieron cargar los comentarios.</span>`;
  }
}

// Modal para sumarse como voluntario / colaborar
function openVolunteerModal(postId, onSuccess) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  const optionsHtml = CONTRIBUTION_OPTIONS.map(opt => `
    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: pointer; margin-bottom: 6px; background-color: var(--bg-surface-secondary);">
      <input type="radio" name="volunteerType" value="${opt.id}" ${opt.id === "hands" ? "checked" : ""} style="margin-top: 3px;">
      <div>
        <strong style="display: block; font-size: 0.9rem;">${opt.icon} ${escapeHTML(opt.label)}</strong>
      </div>
    </label>
  `).join("");

  const modal = openModal(`
    <div class="modal-header">
      <div>
        <span class="eyebrow">COLABORACIÓN CIUDADANA</span>
        <h2>Quiero colaborar en este proyecto</h2>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(post.title)}</p>
      </div>
      <button class="modal-close-btn" data-close type="button">✕</button>
    </div>

    <form id="volunteerForm">
      <div class="form-group">
        <label class="form-label">¿De qué forma te gustaría participar? *</label>
        <div>${optionsHtml}</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="volunteerNote">Nota o mensaje para el equipo organizador (Opcional)</label>
        <textarea class="form-textarea" id="volunteerNote" placeholder="Ej: Dispongo de sábados por la mañana, puedo llevar bolsas reutilizables y pala..." rows="3"></textarea>
      </div>

      <div style="background-color: var(--bg-surface-secondary); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--text-muted); margin-bottom: var(--space-md);">
        <strong>Privacidad protegida:</strong> Tu correo electrónico y teléfono no serán visibles públicamente. Se mostrará tu nombre público y el tipo de aporte para que el equipo pueda organizar la actividad.
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-sm);">
        <button class="btn btn-ghost" data-close type="button">Cancelar</button>
        <button class="btn btn-primary" type="submit">Confirmar mi participación</button>
      </div>
    </form>
  `);

  modal.root.querySelector("#volunteerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = modal.root.querySelector("input[name='volunteerType']:checked")?.value || "hands";
    const note = modal.root.querySelector("#volunteerNote")?.value.trim() || "";

    const submitBtn = e.target.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando...";

    try {
      await addDoc(collection(db, "forumParticipations"), {
        postId: post.id,
        postTitle: post.title,
        userId: authUid(),
        userName: currentUser.name || "Colaborador",
        contributionType: type,
        note,
        createdAt: nowISO(),
        createdAtServer: serverTimestamp()
      });

      // Incrementar contador de participantes
      const newCount = (Number(post.participantsCount) || 0) + 1;
      post.participantsCount = newCount;
      await updateDoc(doc(db, "forumPosts", post.id), {
        participantsCount: newCount
      });

      modal.close();
      showToast("¡Te has registrado como colaborador con éxito!");
      if (onSuccess) onSuccess();
      await loadPosts();
    } catch (err) {
      console.error("Error al registrar participación:", err);
      showToast(firestoreErrorMessage(err, "registrar tu colaboración"));
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirmar mi participación";
    }
  });
}

// Modal para cambiar estado de iniciativa
function openChangeStatusModal(post, parentModal) {
  const optionsHtml = Object.entries(FORUM_STATUSES).map(([key, item]) => `
    <option value="${key}" ${post.status === key ? "selected" : ""}>${item.badge}</option>
  `).join("");

  const modal = openModal(`
    <div class="modal-header">
      <div>
        <span class="eyebrow">GESTIÓN DE INICIATIVA</span>
        <h2>Actualizar estado del proyecto</h2>
      </div>
      <button class="modal-close-btn" data-close type="button">✕</button>
    </div>

    <form id="changeStatusForm">
      <div class="form-group">
        <label class="form-label" for="selectNewStatus">Nuevo estado *</label>
        <select class="form-select" id="selectNewStatus">
          ${optionsHtml}
        </select>
        <span class="form-helper">Informa a la comunidad si la iniciativa pasó de propuesta a planificación, ejecución o si ya concluyó con éxito.</span>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg);">
        <button class="btn btn-ghost" data-close type="button">Cancelar</button>
        <button class="btn btn-primary" type="submit">Actualizar estado</button>
      </div>
    </form>
  `);

  modal.root.querySelector("#changeStatusForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newStatus = modal.root.querySelector("#selectNewStatus").value;

    try {
      await updateDoc(doc(db, "forumPosts", post.id), {
        status: newStatus,
        updatedAt: nowISO()
      });
      post.status = newStatus;
      modal.close();
      if (parentModal) parentModal.close();
      showToast("Estado actualizado correctamente.");
      await loadPosts();
      openPostDetail(post.id);
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      showToast("No se pudo actualizar el estado.");
    }
  });
}

// Modal de Reportar Contenido
function openReportModal(postId, postTitle) {
  const modal = openModal(`
    <div class="modal-header">
      <div>
        <span class="eyebrow">MODERACIÓN COMUNITARIA</span>
        <h2>Reportar publicación</h2>
        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${escapeHTML(postTitle)}</p>
      </div>
      <button class="modal-close-btn" data-close type="button">✕</button>
    </div>

    <form id="reportPostForm">
      <div class="form-group">
        <label class="form-label" for="reportReason">Motivo del reporte *</label>
        <select class="form-select" id="reportReason" required>
          <option value="spam">Spam o publicidad no relacionada</option>
          <option value="offensive">Lenguaje ofensivo o inapropiado</option>
          <option value="misinformation">Información ambiental falsa o dañina</option>
          <option value="safety">Riesgo a la seguridad o fauna</option>
          <option value="other">Otro motivo</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="reportDetail">Detalles adicionales para los moderadores (Opcional)</label>
        <textarea class="form-textarea" id="reportDetail" placeholder="Describe brevemente por qué consideras que incumple las normas de la comunidad..." rows="3"></textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-sm);">
        <button class="btn btn-ghost" data-close type="button">Cancelar</button>
        <button class="btn btn-danger" type="submit">Enviar reporte</button>
      </div>
    </form>
  `);

  modal.root.querySelector("#reportPostForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = modal.root.querySelector("#reportReason").value;
    const detail = modal.root.querySelector("#reportDetail").value.trim();

    try {
      await addDoc(collection(db, "reports"), {
        postId,
        postTitle,
        reporterId: currentUser.id,
        reporterEmail: currentUser.email,
        reason,
        detail,
        status: "pending",
        createdAt: nowISO(),
        createdAtServer: serverTimestamp()
      });
      modal.close();
      showToast("Reporte recibido. Nuestro equipo lo revisará a la brevedad.");
    } catch (err) {
      console.error("Error al registrar reporte:", err);
      showToast("No se pudo enviar el reporte.");
    }
  });
}

// Inicialización de Eventos y Filtros
function initFilters() {
  const searchInput = document.getElementById("forumSearch");
  const categorySelect = document.getElementById("categoryFilter");
  const typeSelect = document.getElementById("typeFilter");
  const statusSelect = document.getElementById("statusFilter");
  const sortSelect = document.getElementById("sortFilter");
  const createBtn = document.getElementById("createPostBtn");
  const emptyActionBtn = document.querySelector("[data-action='open-create']");

  searchInput?.addEventListener("input", (e) => {
    filters.search = e.target.value;
    filterAndRenderPosts();
  });

  categorySelect?.addEventListener("change", (e) => {
    filters.category = e.target.value;
    syncCategoryChips(filters.category);
    filterAndRenderPosts();
  });

  typeSelect?.addEventListener("change", (e) => {
    filters.type = e.target.value;
    filterAndRenderPosts();
  });

  statusSelect?.addEventListener("change", (e) => {
    filters.status = e.target.value;
    filterAndRenderPosts();
  });

  sortSelect?.addEventListener("change", (e) => {
    filters.sort = e.target.value;
    filterAndRenderPosts();
  });

  createBtn?.addEventListener("click", openCreatePostModal);
  emptyActionBtn?.addEventListener("click", openCreatePostModal);

  // Chips Rápidos de Categoría
  document.querySelectorAll("[data-chip-category]").forEach(chip => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.chipCategory;
      filters.category = cat;
      if (categorySelect) categorySelect.value = cat;
      syncCategoryChips(cat);
      filterAndRenderPosts();
    });
  });

  // Leer parámetros de URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramCat = urlParams.get("cat");
  const paramType = urlParams.get("type");
  const paramStatus = urlParams.get("status");
  const paramId = urlParams.get("id");

  if (paramCat && (FORUM_CATEGORIES[paramCat] || paramCat === "all")) {
    filters.category = paramCat;
    if (categorySelect) categorySelect.value = paramCat;
    syncCategoryChips(paramCat);
  }
  if (paramType && FORUM_TYPES[paramType]) {
    filters.type = paramType;
    if (typeSelect) typeSelect.value = paramType;
  }
  if (paramStatus && FORUM_STATUSES[paramStatus]) {
    filters.status = paramStatus;
    if (statusSelect) statusSelect.value = paramStatus;
  }

  return paramId;
}

function syncCategoryChips(activeCat) {
  document.querySelectorAll("[data-chip-category]").forEach(chip => {
    if (chip.dataset.chipCategory === activeCat) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
}

// Arranque de la página
async function initForumsPage() {
  const deepLinkId = initFilters();

  await ensureCurrentUser();

  await loadCosmetics();
  await loadPosts();

  // forums.html?new=1 abre directamente el formulario de nueva publicación
  if (new URLSearchParams(window.location.search).get("new") === "1") {
    openCreatePostModal();
  }

  // Si había un id en la URL, abrirlo directamente
  if (deepLinkId) {
    const targetPost = allPosts.find(p => p.id === deepLinkId);
    if (targetPost) {
      openPostDetail(deepLinkId);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initForumsPage().catch(err => {
    console.error("Error al inicializar foros de ECRA:", err);
  });
});
