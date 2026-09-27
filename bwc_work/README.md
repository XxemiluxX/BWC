# Better World Challenge

Plataforma web de 3 retos de sostenibilidad con Firebase Authentication, Firestore y Firebase Storage.

## Qué quedó funcionando

- Registro con correo y contraseña mediante Firebase Authentication.
- Inicio de sesión manual; después de registrarse la sesión se cierra y la persona debe entrar desde `login.html`.
- Inicio de sesión con Google.
- Cuenta administradora asociada al identificador `mongemoraemiliano60` (parte local del correo).
- Panel administrador sin datos/bots de demostración.
- Estadísticas calculadas desde la colección `users` de Firestore.
- Estadísticas de personas en desafío 1, 2, 3 y completadas 3/3.
- Actualización en tiempo real del panel mediante `onSnapshot`.
- Evidencias guardadas permanentemente en Firebase Storage.
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
- `evidence/{uid}/{archivo}.jpg`

## Configuración de Firebase

El proyecto usa:

- Project ID: `bwc2026-f956e`
- Authentication: Email/Password y Google.
- Firestore.
- Storage.

La configuración web está en `js/firebase-config.js`.

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

La cuenta cuyo correo local comienza exactamente por `mongemoraemiliano60` recibe rol `admin` al sincronizarse con Firestore. Para una publicación pública de mayor seguridad, conviene sustituir este mecanismo por custom claims administrados desde un entorno backend.
