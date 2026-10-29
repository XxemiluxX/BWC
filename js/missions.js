// ECRA — Página pública de Misiones y Logros
import { CHALLENGES, profileReady, recordShare, syncNavigationHeader, escapeHTML, showToast, openModal } from "./app.js";
import { auth, db } from "./firebase-client.js";
import {
  collection, getDocs, query, where, doc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  MISSIONS, MISSION_BY_ID, MISSION_CATEGORIES, FRAMES, TITLES, BACKDROPS, LEVELS, TIER_LABELS,
  claimedSet, xpFromClaimed, xpFromUserData, unlockedRewards, rewardSource, levelForXp, cosmeticsFromUser,
  metricsFromUser, missionState, avatarHTML, titleChipHTML, todayKey, yesterdayKey, dateKey
} from "./missions-data.js";

const $ = id => document.getElementById(id);

const state = {
  user: null,        // sesión de Firebase (null = visitante)
  profile: null,     // documento users/{uid}
  extra: {},         // métricas que salen de otras colecciones
  filter: "all"
};

// ----------------------------- Datos -----------------------------

async function countWhere(col, field, uid, extraFilter) {
  try {
    const snap = await getDocs(query(collection(db, col), where(field, "==", uid)));
    return snap.docs.filter(d => (extraFilter ? extraFilter(d.data()) : true)).length;
  } catch (error) {
    console.warn(`No se pudo contar ${col}:`, error);
    return null;
  }
}

// Retos del usuario: completados (total y por categoría) y empezados
async function loadChallengeMetrics(uid) {
  try {
    const snap = await getDocs(query(collection(db, "user_challenges"), where("userId", "==", uid)));
    const categoryOf = Object.fromEntries(CHALLENGES.map(c => [c.id, c.category]));
    const cats = {};
    const done = new Set();
    const started = new Set();
    snap.docs.forEach(d => {
      const data = d.data();
      if (!categoryOf[data.challengeId]) return;
      if (["in_progress", "completed"].includes(data.status)) started.add(data.challengeId);
      if (data.status === "completed" && !done.has(data.challengeId)) {
        done.add(data.challengeId);
        const cat = categoryOf[data.challengeId];
        cats[cat] = (cats[cat] || 0) + 1;
      }
    });
    return { challengesCompleted: done.size, challengesStarted: started.size, cats };
  } catch (error) {
    console.warn("No se pudo leer el progreso de retos:", error);
    return {};
  }
}

async function loadExtraMetrics(uid) {
  const [challenges, evidences, posts, comments, collabs] = await Promise.all([
    loadChallengeMetrics(uid),
    countWhere("evidences", "userId", uid),
    countWhere("forumPosts", "authorId", uid, d => !d.deleted),
    countWhere("forumComments", "authorId", uid, d => !d.deleted),
    countWhere("forumParticipations", "userId", uid)
  ]);
  const extra = { ...challenges };
  if (evidences !== null) extra.evidences = evidences;
  if (posts !== null) extra.posts = posts;
  if (comments !== null) extra.comments = comments;
  if (collabs !== null) extra.collabs = collabs;
  return extra;
}

function currentMetrics() { return metricsFromUser(state.profile || {}, state.extra); }
function currentClaimed() { return claimedSet(state.profile || {}); }

function currentStreak() {
  const p = state.profile;
  if (!p) return 0;
  return (p.lastLoginDate === todayKey() || p.lastLoginDate === yesterdayKey()) ? (Number(p.loginStreak) || 0) : 0;
}

// ----------------------------- Panel de jugador -----------------------------

function renderLadder(xp) {
  const lv = levelForXp(xp);
  return `<div class="levels-ladder" aria-label="Niveles">${LEVELS.map((l, i) =>
    `<span class="level-pip ${i < lv.index ? "is-reached" : ""} ${i === lv.index ? "is-current" : ""}"><span aria-hidden="true">${l.icon}</span>${l.label}</span>`
  ).join("")}</div>`;
}

function renderPlayer() {
  const el = $("playerCard");
  const claimed = currentClaimed();

  if (!state.user) {
    el.innerHTML = `
      <div class="player-who">
        ${avatarHTML("TÚ", { frame: "aurora" }, { size: "xl" })}
        <div>
          <span class="eyebrow">Tu aventura empieza aquí</span>
          <h2 class="player-name">¿Listo/a para subir de nivel?</h2>
          <p style="margin:0;font-size:.92rem">Cada misión y reto ecológico aprobado te da XP y recompensas para tu perfil.</p>
        </div>
      </div>
      ${renderLadder(0)}
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
        <a class="btn btn-primary" href="register.html" style="background:#fff;color:var(--forest-900)">Crear mi cuenta</a>
        <a class="btn btn-secondary" href="login.html?returnUrl=${encodeURIComponent("missions.html")}" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3)">Ya tengo cuenta</a>
      </div>`;
    return;
  }

  const name = state.profile?.name || state.user.displayName || "Participante";
  const cos = cosmeticsFromUser(state.profile);
  const xp = xpFromUserData(state.profile || {});
  const lv = levelForXp(xp);
  const m = currentMetrics();
  const ready = MISSIONS.filter(x => missionState(x, m, claimed).ready).length;

  el.innerHTML = `
    <div class="player-who">
      ${avatarHTML(name, cos, { size: "xl" })}
      <div style="min-width:0">
        <span class="eyebrow">Mi progreso</span>
        <h2 class="player-name">${escapeHTML(name)}</h2>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${cos.title ? titleChipHTML(cos.title, "title-chip--hero") : `<span class="title-chip title-chip--hero tier-common">Sin título equipado</span>`}
          <span class="title-chip title-chip--hero tier-common"><span aria-hidden="true">${lv.current.icon}</span>Nivel ${lv.index + 1} · ${lv.current.label}</span>
        </div>
      </div>
    </div>
    <div>
      <div class="xp-row">
        <span><strong>${xp} XP</strong></span>
        <span>${lv.next ? `${lv.toNext} XP para ${lv.next.icon} ${lv.next.label}` : "¡Nivel máximo alcanzado!"}</span>
      </div>
      <div class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}"><span style="width:0" data-w="${lv.pct}"></span></div>
    </div>
    <div class="player-stats">
      <div class="player-stat"><b>${claimed.size}/${MISSIONS.length}</b><span>Misiones</span></div>
      <div class="player-stat"><b>${currentStreak()}</b><span>Racha de días</span></div>
      <div class="player-stat"><b>${ready}</b><span>Por reclamar</span></div>
    </div>
    ${renderLadder(xp)}`;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll("[data-w]").forEach(bar => { bar.style.width = `${bar.dataset.w}%`; });
  }));
}

// ----------------------------- Compartir -----------------------------

function shareUrl() {
  return new URL("index.html", window.location.href).href;
}
const SHARE_TEXT = "Únete a ECRA: retos ecológicos, foros comunitarios y logros para cuidar nuestro planeta";

function renderShare() {
  const dates = new Set(state.profile?.shareDates || []);
  const days = dates.size;
  const dots = Array.from({ length: 7 }, (_, i) =>
    `<span class="share-day ${i < days ? "on" : ""}" aria-hidden="true">${i < days ? "✓" : ""}</span>`).join("");
  const canNative = typeof navigator.share === "function";
  $("shareCard").innerHTML = `
    <div>
      <span class="eyebrow">Misión relámpago</span>
      <h2 id="shareTitle" style="margin-bottom:4px">Comparte ECRA</h2>
      <p class="text-muted" style="margin:0;font-size:.92rem">Cada día que compartes cuenta para las misiones de la sección <strong>Compartir</strong>.</p>
    </div>
    <div class="share-actions">
      ${canNative ? `<button class="btn btn-primary" type="button" data-share="native">Compartir</button>` : ""}
      <button class="btn ${canNative ? "btn-secondary" : "btn-primary"}" type="button" data-share="whatsapp">WhatsApp</button>
      <button class="btn btn-secondary" type="button" data-share="copy">Copiar enlace</button>
    </div>
    <div>
      <div class="share-days" role="img" aria-label="Has compartido en ${days} de 7 días">${dots}</div>
      <p class="share-note" style="margin-top:8px">${state.user
        ? `Días compartidos: <strong>${days}</strong>. Cuenta una vez por día.`
        : `Puedes compartir sin cuenta, pero necesitas <a href="login.html?returnUrl=missions.html" style="text-decoration:underline">iniciar sesión</a> para que cuente.`}</p>
    </div>`;
}

async function countShare() {
  if (!state.user) return;
  try {
    const result = await recordShare();
    if (result.counted) showToast("¡Gracias por compartir! Sumaste un día", "success");
    else showToast("Hoy ya contaste tu compartida. ¡Vuelve mañana!", "info");
    refreshAll();
  } catch (error) {
    console.error(error);
    showToast("No se pudo registrar que compartiste. Inténtalo de nuevo.", "error");
  }
}

async function handleShare(kind) {
  const url = shareUrl();
  if (kind === "native") {
    try {
      await navigator.share({ title: "ECRA", text: SHARE_TEXT, url });
    } catch (error) {
      if (error?.name === "AbortError") return; // cerró el menú sin compartir
      console.warn(error);
      return;
    }
    await countShare();
  } else if (kind === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${url}`)}`, "_blank", "noopener");
    await countShare();
  } else if (kind === "copy") {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Enlace copiado. ¡Pégalo donde quieras!", "success");
    } catch {
      window.prompt("Copia este enlace:", url);
    }
    await countShare();
  }
}

// ----------------------------- Misiones -----------------------------

function rewardChips(reward) {
  const chips = [`<span class="reward-chip xp">${reward.xp} XP</span>`];
  if (reward.frame) chips.push(`<span class="reward-chip">Marco: ${escapeHTML(FRAMES[reward.frame].label)}</span>`);
  if (reward.title) chips.push(`<span class="reward-chip">Título: ${escapeHTML(TITLES[reward.title].label)}</span>`);
  if (reward.backdrop) chips.push(`<span class="reward-chip">Fondo: ${escapeHTML(BACKDROPS[reward.backdrop].label)}</span>`);
  return chips.join("");
}

function renderFilters() {
  const claimed = currentClaimed();
  const m = currentMetrics();
  const ready = state.user ? MISSIONS.filter(x => missionState(x, m, claimed).ready).length : 0;
  const chips = [
    { id: "all", icon: "", label: "Todas" },
    ...(state.user ? [{ id: "ready", icon: "", label: `Por reclamar${ready ? ` (${ready})` : ""}` }] : []),
    ...MISSION_CATEGORIES
  ];
  $("missionFilters").innerHTML = chips.map(c => `
    <button type="button" class="chip-filter ${c.id === state.filter ? "active" : ""}" data-filter="${c.id}" aria-pressed="${c.id === state.filter}">
      ${c.icon ? `<span aria-hidden="true">${c.icon}</span> ` : ""}${escapeHTML(c.label)}
    </button>`).join("");
}

function missionCard(mission) {
  const claimed = currentClaimed();
  const st = missionState(mission, currentMetrics(), claimed);
  const guest = !state.user;

  let action;
  if (guest) {
    action = `<a class="btn btn-secondary btn-sm" href="login.html?returnUrl=missions.html">Iniciar sesión</a>`;
  } else if (st.claimed) {
    action = `<span class="mission-claimed-tag">Reclamada</span>`;
  } else if (st.ready) {
    action = `<button class="btn btn-primary btn-sm" type="button" data-claim="${mission.id}">Reclamar</button>`;
  } else {
    action = `<span class="text-muted" style="font-size:.8rem">En progreso</span>`;
  }

  const pct = guest ? 0 : st.pct;
  const value = guest ? 0 : st.value;
  return `
    <article class="card mission-card ${st.ready && !guest ? "is-ready" : ""} ${st.claimed && !guest ? "is-claimed" : ""}">
      <div class="mission-head">
        <span class="mission-icon" aria-hidden="true">${mission.icon}</span>
        <div>
          <h3 class="mission-title">${escapeHTML(mission.title)}</h3>
          <p class="mission-desc">${escapeHTML(mission.desc)}</p>
        </div>
      </div>
      <div class="mission-rewards">${rewardChips(mission.reward)}</div>
      <div class="mission-progress">
        <div class="mission-progress-top"><span>Progreso</span><span>${value} / ${mission.goal}</span></div>
        <div class="mission-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${mission.goal}" aria-valuenow="${value}"><span style="width:${pct}%"></span></div>
      </div>
      <div class="mission-foot">${action}</div>
    </article>`;
}

function renderMissions() {
  const claimed = currentClaimed();
  const m = currentMetrics();
  let list = MISSIONS;
  if (state.filter === "ready") list = MISSIONS.filter(x => missionState(x, m, claimed).ready);
  else if (state.filter !== "all") list = MISSIONS.filter(x => x.category === state.filter);

  const done = state.user ? claimed.size : 0;
  $("missionsCount").textContent = state.user ? `${done} de ${MISSIONS.length} reclamadas` : `${MISSIONS.length} misiones disponibles`;

  if (!list.length) {
    $("missionGrid").innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center"><p style="margin:0">No tienes recompensas pendientes por ahora. ¡Sigue avanzando! 🌱</p></div>`;
    return;
  }

  // Dentro de cada filtro: primero las listas para reclamar, luego en progreso, al final las reclamadas
  const rank = x => { const s = missionState(x, m, claimed); return s.ready ? 0 : s.claimed ? 2 : 1; };
  const sorted = state.user ? [...list].sort((a, b) => rank(a) - rank(b)) : list;
  $("missionGrid").innerHTML = sorted.map(missionCard).join("");
}

// ----------------------------- Colección -----------------------------

function sampleName() {
  return state.profile?.name || state.user?.displayName || "EC";
}

function tileHint(kind, id) {
  const src = rewardSource(kind, id);
  return src ? `Misión: ${escapeHTML(src.title)}` : "";
}

function tile({ kind, id, def, visual, unlocked, equipped }) {
  const tier = def.tier;
  let action;
  if (!state.user) action = "";
  else if (!unlocked) action = "";
  else action = `<button class="btn ${equipped ? "btn-secondary" : "btn-primary"} btn-sm" type="button" data-equip="${kind}:${equipped ? "" : id}">${equipped ? "Quitar" : "Equipar"}</button>`;
  return `
    <div class="reward-tile ${equipped ? "is-equipped" : ""} ${state.user && !unlocked ? "is-locked" : ""}">
      ${state.user && !unlocked ? `<span class="reward-lock" aria-label="Bloqueado"></span>` : ""}
      ${equipped ? `<span class="reward-lock" aria-label="Equipado"></span>` : ""}
      ${visual}
      ${kind === "title" ? "" : `<span class="reward-name">${escapeHTML(def.label)}</span>`}
      <span class="reward-tier tier-${tier}">${TIER_LABELS[tier]}</span>
      <p class="reward-hint">${unlocked && state.user ? (def.blurb ? escapeHTML(def.blurb) : "") : tileHint(kind, id)}</p>
      ${action}
    </div>`;
}

function renderCollection() {
  const claimed = currentClaimed();
  const un = unlockedRewards(claimed);
  const eq = state.profile?.equipped || {};
  const cos = cosmeticsFromUser(state.profile || {});
  const name = sampleName();

  const frames = Object.entries(FRAMES).map(([id, def]) => tile({
    kind: "frame", id, def, unlocked: un.frame.has(id), equipped: cos.frame === id,
    visual: `<div class="reward-visual">${avatarHTML(name, { frame: id }, { size: "lg" })}</div>`
  })).join("");

  const titles = Object.entries(TITLES).map(([id, def]) => tile({
    kind: "title", id, def: { ...def, blurb: "" }, unlocked: un.title.has(id), equipped: cos.title === id,
    visual: `<div class="reward-title-sample">${titleChipHTML(id)}</div>`
  })).join("");

  const backs = Object.entries(BACKDROPS).map(([id, def]) => tile({
    kind: "backdrop", id, def: { ...def, blurb: "" }, unlocked: un.backdrop.has(id), equipped: cos.backdrop === id,
    visual: `<div class="reward-visual" style="width:100%"><span class="bd-preview bd-${id}" style="width:100%"></span></div>`
  })).join("");

  $("collection").innerHTML = `
    <section class="collection-block">
      <h3>Marcos de perfil</h3>
      <p class="text-muted">Bordes con diseño que rodean tu foto en tu perfil, la clasificación y los foros.</p>
      <div class="reward-grid">${frames}</div>
    </section>
    <section class="collection-block">
      <h3>Títulos</h3>
      <p class="text-muted">Aparecen debajo de tu nombre. Puedes cambiarlos cuando quieras.</p>
      <div class="reward-grid">${titles}</div>
    </section>
    <section class="collection-block">
      <h3>Fondos de perfil</h3>
      <p class="text-muted">Cambian el escenario de la tarjeta principal de tu perfil.</p>
      <div class="reward-grid">${backs}</div>
    </section>`;
}

function renderBanner() {
  $("guestBanner").innerHTML = state.user ? "" : `
    <div class="guest-banner">
      <div>
        <h3>Estás viendo el catálogo como visitante</h3>
        <p>Crea tu cuenta o inicia sesión para empezar a ganar XP, reclamar recompensas y lucirlas en tu perfil.</p>
      </div>
      <a class="btn btn-primary" href="login.html?returnUrl=missions.html">Iniciar sesión</a>
    </div>`;
}

function refreshAll() {
  renderPlayer();
  renderShare();
  renderFilters();
  renderMissions();
  renderCollection();
  syncNavigationHeader(state.user, state.profile);
}

// ----------------------------- Reclamar y equipar -----------------------------

function confetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#49ab77", "#a7dfc0", "#fcd34d", "#f97316", "#60a5fa", "#a78bfa", "#f472b6"];
  for (let i = 0; i < 46; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
    piece.style.setProperty("--rot", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--dur", `${1.9 + Math.random() * 1.4}s`);
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3800);
  }
}

async function claimMission(id) {
  const mission = MISSION_BY_ID[id];
  if (!state.user || !mission) return;
  const claimed = currentClaimed();
  const st = missionState(mission, currentMetrics(), claimed);
  if (!st.ready) return;

  const btn = document.querySelector(`[data-claim="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Reclamando…"; }

  const levelBefore = levelForXp(xpFromUserData(state.profile || {})).index;
  try {
    await updateDoc(doc(db, "users", state.user.uid), {
      claimedMissions: arrayUnion(id),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    showToast("No se pudo reclamar la recompensa. Revisa tu conexión e inténtalo otra vez.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Reclamar"; }
    return;
  }

  state.profile.claimedMissions = [...(state.profile.claimedMissions || []), id];
  const levelAfter = levelForXp(xpFromUserData(state.profile || {}));
  refreshAll();
  confetti();
  openRewardModal(mission, levelAfter.index > levelBefore ? levelAfter.current : null);
}

function openRewardModal(mission, newLevel) {
  const r = mission.reward;
  const name = sampleName();
  const parts = [];
  if (r.frame) parts.push(`
    <div style="text-align:center">${avatarHTML(name, { frame: r.frame }, { size: "xl" })}
      <p style="margin:8px 0 6px"><strong>Marco: ${escapeHTML(FRAMES[r.frame].label)}</strong></p>
      <button class="btn btn-primary btn-sm" type="button" data-equip-now="frame:${r.frame}">Equipar ahora</button></div>`);
  if (r.title) parts.push(`
    <div style="text-align:center">${titleChipHTML(r.title)}
      <p style="margin:8px 0 6px"><strong>Título: ${escapeHTML(TITLES[r.title].label)}</strong></p>
      <button class="btn btn-primary btn-sm" type="button" data-equip-now="title:${r.title}">Equipar ahora</button></div>`);
  if (r.backdrop) parts.push(`
    <div style="text-align:center;width:100%"><span class="bd-preview bd-${r.backdrop}" style="width:100%"></span>
      <p style="margin:8px 0 6px"><strong>Fondo: ${escapeHTML(BACKDROPS[r.backdrop].label)}</strong></p>
      <button class="btn btn-primary btn-sm" type="button" data-equip-now="backdrop:${r.backdrop}">Equipar ahora</button></div>`);

  const modal = openModal(`
    <div class="modal-header">
      <div>
        <span class="eyebrow">¡Misión cumplida!</span>
        <h2>${mission.icon} ${escapeHTML(mission.title)}</h2>
      </div>
      <button class="modal-close-btn" data-close type="button" aria-label="Cerrar">✕</button>
    </div>
    <p style="text-align:center;margin:0 0 var(--space-sm)"><span class="reward-chip xp">+${r.xp} XP</span></p>
    ${newLevel ? `<p style="text-align:center;font-weight:700;margin:0 0 var(--space-sm)">¡Subiste de nivel! ${newLevel.icon} ${newLevel.label}</p>` : ""}
    <div class="reward-modal-list">${parts.join("") || `<p class="text-muted" style="margin:0">Esta misión da solo XP. ¡Sigue sumando!</p>`}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:var(--space-lg)">
      <button class="btn btn-ghost" data-close type="button">Seguir</button>
    </div>
  `);

  modal.root.querySelectorAll("[data-equip-now]").forEach(button => {
    button.addEventListener("click", async () => {
      const [kind, id] = button.dataset.equipNow.split(":");
      button.disabled = true;
      await equip(kind, id);
      button.textContent = "Equipado ✓";
    });
  });
}

async function equip(kind, id) {
  if (!state.user || !["frame", "title", "backdrop"].includes(kind)) return;
  const un = unlockedRewards(currentClaimed());
  if (id && !un[kind].has(id)) return;
  try {
    await updateDoc(doc(db, "users", state.user.uid), {
      [`equipped.${kind}`]: id || null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(error);
    showToast("No se pudo guardar el cambio. Inténtalo de nuevo.", "error");
    return;
  }
  state.profile.equipped = { ...(state.profile.equipped || {}), [kind]: id || null };
  refreshAll();
  showToast(id ? "¡Listo! Ya lo luces en tu perfil" : "Recompensa quitada.", "success");
}

// ----------------------------- Arranque -----------------------------

function bindEvents() {
  document.addEventListener("click", event => {
    const claim = event.target.closest("[data-claim]");
    if (claim) return claimMission(claim.dataset.claim);

    const eq = event.target.closest("[data-equip]");
    if (eq) {
      const [kind, id] = eq.dataset.equip.split(":");
      return equip(kind, id);
    }

    const filter = event.target.closest("[data-filter]");
    if (filter) {
      state.filter = filter.dataset.filter;
      renderFilters();
      renderMissions();
      return;
    }

    const share = event.target.closest("[data-share]");
    if (share) return handleShare(share.dataset.share);
  });
}

async function init() {
  bindEvents();
  renderBanner();
  renderPlayer();
  renderShare();
  renderFilters();
  renderMissions();
  renderCollection();

  const profile = await profileReady;
  const user = window.ECRA_AUTH_USER || auth.currentUser;
  if (!user) return; // visitante: ya se pintó el catálogo

  state.user = user;
  state.profile = profile || { name: user.displayName || user.email?.split("@")[0] || "Participante" };
  renderBanner();
  refreshAll();

  state.extra = await loadExtraMetrics(user.uid);
  refreshAll();
}

init();
