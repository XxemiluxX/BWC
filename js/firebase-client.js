import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics, isSupported as analyticsIsSupported, setAnalyticsCollectionEnabled } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { firebaseConfig } from "./firebase-config.js";
import { whenAnalyticsAllowed, onConsentChange, clearAnalyticsCookies } from "./cookie-consent.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Analytics solo se inicia cuando la persona acepta las cookies de analítica
// (js/cookie-consent.js). Tampoco debe impedir que Auth/Firestore/Storage funcionen
// en navegadores donde Google Analytics no está disponible.
export const analytics = whenAnalyticsAllowed()
  .then(() => analyticsIsSupported())
  .then(supported => (supported ? getAnalytics(app) : null))
  .catch(() => null);

// Si la persona retira el permiso, se detiene la medición y se borran las cookies _ga.
onConsentChange(async allowed => {
  if (!allowed) clearAnalyticsCookies();
  const instance = await Promise.race([analytics, Promise.resolve(null)]);
  if (instance) setAnalyticsCollectionEnabled(instance, allowed);
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
