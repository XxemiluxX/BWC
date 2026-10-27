import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Analytics no debe impedir que Auth/Firestore/Storage funcionen en navegadores
// donde Google Analytics no está disponible.
export const analytics = analyticsIsSupported()
  .then(supported => (supported ? getAnalytics(app) : null))
  .catch(() => null);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
