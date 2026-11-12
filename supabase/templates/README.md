# Plantillas de correo de Auth

Se pegan a mano en Supabase → Authentication → Email Templates (el MCP no las administra).
Resend solo transporta (SMTP); la plantilla vive en Supabase. Variables de Supabase: `{{ .ConfirmationURL }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`.

| Archivo | Plantilla en Supabase | Asunto sugerido |
|---|---|---|
| confirmar-cuenta.html | Confirm signup | Confirma tu cuenta en Dripo |
| recuperar-contrasena.html | Reset password | Crea una contraseña nueva en Dripo |
| cambio-de-correo.html | Change email address | Confirma tu nuevo correo en Dripo |

Logo: `public/email/logo.png` (se sirve en https://dripocoffee.com/email/logo.png). HTML de correo: tablas y estilos en línea; Gmail no carga fuentes web, cae a Helvetica/Arial.
