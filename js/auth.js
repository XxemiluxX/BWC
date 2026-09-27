import "./app.js";
import { auth } from "./firebase-client.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const { ensureUserProfile } = window.BWC;

// Si la persona ya inició sesión y visita login/register, la mandamos directo a su panel.
let redirectChecked = false;
onAuthStateChanged(auth, async user => {
  if (redirectChecked || !user) return;
  redirectChecked = true;
  try {
    const profile = await ensureUserProfile(user);
    go(profile);
  } catch { /* deja que la persona use el formulario con normalidad */ }
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function setMessage(id, text, type = "error") {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = text; el.className = `form-message ${type}`;
}

function firebaseError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/invalid-email": "Usa un correo electrónico válido.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña no es correcta.",
    "auth/email-already-in-use": "Ese correo ya está registrado. Inicia sesión en vez de crear otra cuenta.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio.",
    "auth/account-exists-with-different-credential": "Ese correo ya está asociado a otro método de inicio de sesión.",
    "auth/operation-not-allowed": "Este método de inicio de sesión no está habilitado en Firebase.",
    "auth/network-request-failed": "No se pudo conectar con Firebase. Revisa tu conexión.",
    "auth/too-many-requests": "Se hicieron demasiados intentos. Espera un momento y prueba de nuevo."
  };
  return messages[code] || `No se pudo completar la operación (${code || "error desconocido"}).`;
}

function go(profile) {
  window.location.href = profile?.role === "admin" ? "admin.html" : "profile.html";
}

async function completeLogin(user, messageId) {
  const profile = await ensureUserProfile(user);
  setMessage(messageId, "Inicio de sesión correcto. Abriendo tu panel…", "success");
  setTimeout(() => go(profile), 220);
}

async function signInWithGoogle(messageId) {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await completeLogin(result.user, messageId);
  } catch (error) { setMessage(messageId, firebaseError(error)); }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  if (params.get("registered") === "1") setMessage("loginMessage", "Tu cuenta fue creada. Ahora inicia sesión con tu correo y contraseña.", "success");

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;
    if (!email) return setMessage("loginMessage", "Escribe tu correo.");
    if (!password) return setMessage("loginMessage", "Escribe tu contraseña.");
    const button = loginForm.querySelector("button[type='submit']");
    button.disabled = true; button.textContent = "Entrando…";
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await completeLogin(credential.user, "loginMessage");
    } catch (error) {
      setMessage("loginMessage", firebaseError(error)); button.disabled = false; button.textContent = "Entrar";
    }
  });

  const registerForm = document.getElementById("registerForm");
  registerForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("registerName")?.value.trim();
    const email = document.getElementById("registerEmail")?.value.trim();
    const password = document.getElementById("registerPassword")?.value;
    const password2 = document.getElementById("registerPassword2")?.value;
    if ((name || "").length < 2) return setMessage("registerMessage", "Escribe tu nombre.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return setMessage("registerMessage", "Usa un correo válido.");
    if ((password || "").length < 6) return setMessage("registerMessage", "La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setMessage("registerMessage", "Las contraseñas no coinciden.");
    const button = registerForm.querySelector("button[type='submit']");
    button.disabled = true; button.textContent = "Creando cuenta…";
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await ensureUserProfile(credential.user, name);
      // No dejar la sesión abierta automáticamente: el usuario debe iniciar sesión de forma explícita.
      await signOut(auth);
      window.location.href = "login.html?registered=1";
    } catch (error) {
      setMessage("registerMessage", firebaseError(error)); button.disabled = false; button.textContent = "Crear cuenta y comenzar →";
    }
  });

  document.getElementById("forgotPasswordBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail")?.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) {
      return setMessage("loginMessage", "Escribe primero tu correo arriba para poder enviarte el enlace.");
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("loginMessage", `Te enviamos un enlace para restablecer tu contraseña a ${email}.`, "success");
    } catch (error) {
      setMessage("loginMessage", firebaseError(error));
    }
  });

  document.getElementById("googleDemoBtn")?.addEventListener("click", () => signInWithGoogle("loginMessage"));
  document.getElementById("googleRegisterBtn")?.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
      await signOut(auth);
      window.location.href = "login.html?registered=1";
    } catch (error) { setMessage("registerMessage", firebaseError(error)); }
  });
});
