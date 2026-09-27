# Better World Challenge

Plataforma web de 3 retos de sostenibilidad con Firebase Authentication, Firestore y Firebase Storage.

## Qué quedó funcionando

- Registro con correo y contraseña mediante Firebase Authentication.
- Inicio de sesión manual; después de registrarse la sesión se cierra y la persona debe entrar desde `login.html`.
- Inicio de sesión con Google.
- Cuenta administradora asociada exactamente a `mongemoraemiliano60@gmail.com`.
- Panel administrador sin datos/bots de demostración.
- Estadísticas calculadas desde la colección `users` de Firestore.
- Estadísticas de personas en desafío 1, 2, 3 y completadas 3/3.
- Actualización en tiempo real del panel mediante `onSnapshot`.
- Evidencias guardadas permanentemente en Supabase Storage; Firebase conserva la autenticación, metadatos y moderación.
- Registro de cada evidencia en Firestore con estado `pending`, `approved` o `rejected`.
- Vista de la fotografía completa desde el panel administrador.
- Aprobar/rechazar evidencias con comentario.
- Al aprobar, el progreso del participante avanza mediante una transacción de Firestore.
- Subida desde computadora con selección de archivo o arrastrar y soltar.
- Compresión de fotografías antes de subirlas para evitar problemas por archivos pesados.
- Barra de progreso de subida.
- Modo oscuro/claro con preferencia guardada en el navegador.
- Diseño responsive y mejoras de accesibilidad.

## Estructura de datos

### Firestore
- `users/{uid}`: nombre, correo, rol, desafío actual, progreso y fechas.
- `evidences/{id}`: usuario, desafío, estado, comentario, `storagePath` y `imageURL`.

### Storage
- Supabase Storage bucket `evidence`: `{firebaseUid}/{archivo}.jpg`

## Configuración de Supabase Storage

1. Crea un proyecto en Supabase.
2. En **Project Settings → API**, copia el **Project URL** y la **Publishable key** (o anon key).
3. Pégalos en `js/supabase-config.js`. No uses una `service_role`/secret key en el navegador. Supabase documenta `createClient()` para el navegador y el método `storage.from(...).upload(...)` para subir archivos.
4. Ejecuta `supabase.sql` en **SQL Editor**.
5. El bucket se llama `evidence`. Esta versión usa lectura pública para que el panel de Firebase pueda mostrar las fotos, mientras que la autorización del flujo de retos permanece en Firestore. Para fotos privadas de producción, usa una Edge Function/backend que emita URLs firmadas.

## Configuración de Firebase

El proyecto usa:

- Project ID: `bwc2026-f956e`
- Authentication: Email/Password y Google.
- Firestore.
- Storage.
- Google Analytics for Firebase (Measurement ID `G-Y5EVYF6YL0`), initialized only when the browser supports Analytics.

La configuración web completa está en `js/firebase-config.js` y usa el Web App ID proporcionado para este proyecto.

## Reglas

Las reglas incluidas en `firestore.rules` y `storage.rules` protegen:

- Cada participante puede crear sus propias evidencias.
- Cada participante puede leer sus propios datos/evidencias.
- El administrador puede leer y moderar todo.
- Las imágenes tienen que ser de tipo imagen y no superar el límite de Storage.

## Firebase Hosting

`firebase.json` ya incluye Hosting, Firestore y Storage.

Con Firebase CLI instalado:

```bash
firebase login
firebase use bwc2026-f956e
firebase deploy
```

## Nota sobre el administrador

La cuenta `mongemoraemiliano60@gmail.com` recibe rol `admin` al sincronizarse con Firestore. Para una publicación pública de mayor seguridad, conviene sustituir este mecanismo por custom claims administrados desde un entorno backend.
## Supabase Storage

Supabase ya está vinculado al proyecto `ubefhwtkbpveoxodraba`. La app usa la Publishable key en `js/supabase-config.js` y sube las evidencias JPEG al bucket `evidence`.

1. Abre Supabase → SQL Editor.
2. Ejecuta `supabase.sql` una sola vez para crear/configurar el bucket y la política de subida.
3. Ejecuta la app por HTTPS o mediante un servidor local; no abras los archivos HTML directamente con `file://`.

La Publishable key es apta para código de navegador según la documentación actual de Supabase; nunca sustituyas esta clave por una secret/service-role key.
