# Plantillas de correo de Auth

Se pegan a mano en Supabase → Authentication → Emails → Templates (el MCP no las administra).
Resend solo transporta (SMTP); la plantilla vive en Supabase. Variables de Supabase: `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, `{{ .RedirectTo }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`.

| Archivo | Plantilla en Supabase | Asunto sugerido |
|---|---|---|
| confirmar-cuenta.html | Confirm signup | Confirma tu cuenta en Dripo |
| recuperar-contrasena.html | Reset password | Crea una contraseña nueva en Dripo |
| cambio-de-correo.html | Change email address | Confirma tu nuevo correo en Dripo |
| invitacion.html | Invite user | Te invitaron a Dripo (la manda la Edge Function `join` vía `inviteUserByEmail`) |

Invitación y recuperación (desde 2026-11-13): el botón apunta a `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite|recovery`, es decir a `dripocoffee.com/nueva-contrasena`, y el token se valida recién al tocar "Guardar y entrar". Así los escáneres de enlaces (Outlook, antivirus) no gastan el enlace antes que la persona, y el dominio del enlace coincide con el del remitente. Requiere que el frontend con `verifyOtp` en `NewPassword` esté desplegado antes de pegar estas plantillas. `RedirectTo` lo fijan la Edge Function `join` y Login; una invitación enviada a mano desde el panel de Supabase no lo trae (usar `join`).

Vencimiento: "Email OTP Expiration" en Authentication → Sign In / Providers → Email debe ser 86400 s para que calce con "El enlace vence en 24 horas" de la invitación.

Logo: `public/email/logo.png` (se sirve en https://dripocoffee.com/email/logo.png). HTML de correo: tablas y estilos en línea; Gmail no carga fuentes web, cae a Helvetica/Arial.
