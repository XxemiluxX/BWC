import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import "./app.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const { loadDB, saveDB, setSession, getSession } = window.BWC;

function setMessage(id, text, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`;
}

function firebaseError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/invalid-email": "Usa un correo electrónico válido.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña no es correcta.",
    "auth/email-already-in-use": "Ese correo ya está registrado.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio.",
    "auth/account-exists-with-different-credential": "Ese correo ya está asociado a otro método de inicio de sesión.",
    "auth/operation-not-allowed": "Este método de inicio de sesión no está habilitado en Firebase.",
    "auth/network-request-failed": "No se pudo conectar con Firebase. Revisa tu conexión."
  };
  return messages[code] || `No se pudo completar la operación (${code || "error desconocido"}).`;
}

function ensureLocalProfile(user, name = "") {
  const db = loadDB();
  let profile = db.users.find(u => u.firebaseUid === user.uid);

  if (!profile) {
    profile = {
      id: user.uid,
      firebaseUid: user.uid,
      name: name || user.displayName || user.email?.split("@")[0] || "Usuario",
      email: user.email || "",
      role: "participant",
      currentChallenge: 1,
      completed: 0,
      createdAt: new Date().toISOString()
    };
    db.users.push(profile);
    saveDB(db);
  } else {
    profile.name = name || user.displayName || profile.name;
    profile.email = user.email || profile.email;
    saveDB(db);
  }

  return profile;
}

function goByFirebaseUser(user) {
  if (!user) return;
  const profile = ensureLocalProfile(user);
  setSession(profile.id, profile.role);
  window.location.href = profile.role === "admin" ? "admin.html" : "profile.html";
}

function goBySession() {
  // Solo redirige si ya existe una sesión local asociada a Firebase.
  const session = getSession();
  if (!session) return;
  window.location.href = session.role === "admin" ? "admin.html" : "profile.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // Firebase es la fuente real de autenticación.
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // En login/register, una sesión existente lleva al perfil.
      if (location.pathname.endsWith("/login.html") || location.pathname.endsWith("/register.html") ||
          location.pathname.endsWith("login.html") || location.pathname.endsWith("register.html")) {
        goByFirebaseUser(user);
      }
    }
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (!email) return setMessage("loginMessage", "Escribe tu correo.");
      if (!password) return setMessage("loginMessage", "Escribe tu contraseña.");

      const button = loginForm.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "Entrando…";

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = ensureLocalProfile(credential.user);
        setSession(profile.id, profile.role);
        setMessage("loginMessage", "Inicio de sesión correcto. Redirigiendo…", "success");
        setTimeout(() => {
          window.location.href = profile.role === "admin" ? "admin.html" : "profile.html";
        }, 350);
      } catch (error) {
        setMessage("loginMessage", firebaseError(error));
        button.disabled = false;
        button.textContent = "Entrar";
      }
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document.getElementById("registerName").value.trim();
      const email = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;
      const password2 = document.getElementById("registerPassword2").value;

      if (name.length < 2) return setMessage("registerMessage", "Escribe tu nombre.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage("registerMessage", "Usa un correo válido.");
      if (password.length < 6) return setMessage("registerMessage", "La contraseña debe tener al menos 6 caracteres.");
      if (password !== password2) return setMessage("registerMessage", "Las contraseñas no coinciden.");

      const button = registerForm.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = "Creando cuenta…";

      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);

        await updateProfile(credential.user, { displayName: name });

        const profile = ensureLocalProfile(credential.user, name);
        setSession(profile.id, profile.role);

        setMessage("registerMessage", "Cuenta creada. Redirigiendo…", "success");
        setTimeout(() => {
          window.location.href = "profile.html";
        }, 350);
      } catch (error) {
        setMessage("registerMessage", firebaseError(error));
        button.disabled = false;
        button.textContent = "Crear cuenta y comenzar →";
      }
    });
  }

  async function signInWithGoogle(messageId) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = ensureLocalProfile(result.user);
      setSession(profile.id, profile.role);
      setMessage(messageId, "Google conectado. Redirigiendo…", "success");
      setTimeout(() => {
        window.location.href = profile.role === "admin" ? "admin.html" : "profile.html";
      }, 350);
    } catch (error) {
      setMessage(messageId, firebaseError(error));
    }
  }

  document.getElementById("googleDemoBtn")?.addEventListener("click", () => {
    signInWithGoogle("loginMessage");
  });

  document.getElementById("googleRegisterBtn")?.addEventListener("click", () => {
    signInWithGoogle("registerMessage");
  });

  // Se conserva únicamente como acceso de demostración del panel local.
  document.getElementById("adminDemoBtn")?.addEventListener("click", () => {
    setSession("demo_admin", "admin");
    window.location.href = "admin.html";
  });

  // Evita volver a usar contraseñas o usuarios almacenados en localStorage.
  // La autenticación real queda completamente a cargo de Firebase Authentication.
});
