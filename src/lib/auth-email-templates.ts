// Supabase Auth Go-template placeholders only; no tokens or personal data are stored here.
const layout = (
  title: string,
  message: string,
  action?: { label: string; url: string },
) =>
  `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#173c32;max-width:600px;margin:auto;padding:28px"><h1>Pase Central</h1><h2>${title}</h2><p>${message}</p>${action ? `<p><a href="${action.url}" style="background:#197a63;color:white;padding:12px 20px;display:inline-block;border-radius:6px;text-decoration:none">${action.label}</a></p>` : ""}<p>Si no solicitaste esta operación, no compartas este correo ni sus códigos y contacta al administrador de Pase Central.</p><p>Pase Central · Vive el momento</p></body></html>`;
const confirm = (type: string) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}`;
export const authEmailTemplates = [
  {
    id: "confirm-sign-up",
    subject: "Confirma tu cuenta de Pase Central",
    html: layout(
      "Confirma tu correo",
      "Creaste una cuenta de Pase Central. Confirma tu correo para abrir tu perfil y consultar tus entradas. Si el enlace ya fue utilizado, inicia sesión con el correo y la contraseña que elegiste.",
      {
        label: "Confirmar mi cuenta y abrir mi perfil",
        url: confirm("signup"),
      },
    ),
  },
  {
    id: "invite-user",
    subject: "Tu invitación a Pase Central",
    html: layout(
      "Tienes una invitación",
      "Confirma tu correo para entrar a tu perfil. Los permisos de trabajo solo se activan al aceptar la invitación al equipo enviada por el administrador. Si debes elegir contraseña, usa Olvidé mi contraseña en la página de acceso.",
      { label: "Confirmar correo y abrir perfil", url: confirm("invite") },
    ),
  },
  {
    id: "magic-link-or-otp",
    subject: "Tu acceso a Pase Central",
    html: layout(
      "Inicia sesión",
      "Usa el enlace de un solo uso para abrir tu perfil. Tu código de acceso es: <strong>{{ .Token }}</strong>. No compartas el enlace ni el código.",
      { label: "Entrar a mi perfil", url: confirm("magiclink") },
    ),
  },
  {
    id: "change-email-address",
    subject: "Confirma el cambio de correo de Pase Central",
    html: layout(
      "Confirma tu nuevo correo",
      "Confirma este cambio de correo. Puede ser necesario confirmar también desde el otro correo de tu cuenta. Si el enlace ya fue utilizado, inicia sesión con el correo confirmado.",
      { label: "Confirmar cambio de correo", url: confirm("email_change") },
    ),
  },
  {
    id: "reset-password",
    subject: "Recupera tu contraseña de Pase Central",
    html: layout(
      "Elige una nueva contraseña",
      "Solicitaste recuperar el acceso a tu cuenta. Abre el enlace más reciente para elegir una nueva contraseña de al menos 10 caracteres; después inicia sesión. Si no lo solicitaste, ignora este correo.",
      { label: "Cambiar mi contraseña", url: confirm("recovery") },
    ),
  },
  {
    id: "reauthentication",
    subject: "Confirma tu identidad en Pase Central",
    html: layout(
      "Verifica tu identidad",
      "Tu código de verificación para la operación solicitada es: <strong>{{ .Token }}</strong>. Introdúcelo en la pantalla que lo solicitó y no lo compartas.",
    ),
  },
  {
    id: "password-changed",
    subject: "Tu contraseña de Pase Central cambió",
    html: layout(
      "Contraseña actualizada",
      "La contraseña de tu cuenta cambió. Si no realizaste el cambio, solicita recuperación de acceso y contacta al administrador.",
      { label: "Recuperar mi cuenta", url: "{{ .SiteURL }}/forgot-password" },
    ),
  },
  {
    id: "email-address-changed",
    subject: "El correo de tu cuenta de Pase Central cambió",
    html: layout(
      "Correo actualizado",
      "El correo de acceso de tu cuenta cambió. Si no reconoces esta operación, contacta al administrador y protege tu cuenta.",
      { label: "Abrir Pase Central", url: "{{ .SiteURL }}/login" },
    ),
  },
  {
    id: "phone-number-changed",
    subject: "El teléfono de tu cuenta de Pase Central cambió",
    html: layout(
      "Teléfono actualizado",
      "El teléfono de tu cuenta cambió. Si no reconoces esta operación, contacta al administrador.",
      { label: "Revisar mi cuenta", url: "{{ .SiteURL }}/account/profile" },
    ),
  },
  {
    id: "sign-in-method-linked",
    subject: "Se agregó un método de acceso a Pase Central",
    html: layout(
      "Nuevo método de acceso",
      "Se vinculó un método de inicio de sesión a tu cuenta. Si no lo hiciste, contacta al administrador y protege tu cuenta.",
      { label: "Revisar mi cuenta", url: "{{ .SiteURL }}/account/profile" },
    ),
  },
  {
    id: "sign-in-method-removed",
    subject: "Se retiró un método de acceso de Pase Central",
    html: layout(
      "Método de acceso retirado",
      "Se desvinculó un método de inicio de sesión de tu cuenta. Si no reconoces esta operación, contacta al administrador.",
      { label: "Revisar mi cuenta", url: "{{ .SiteURL }}/account/profile" },
    ),
  },
  {
    id: "mfa-method-added",
    subject: "Se agregó verificación adicional a tu cuenta de Pase Central",
    html: layout(
      "Verificación adicional activada",
      "Se agregó un método de verificación adicional a tu cuenta. Si no lo hiciste, contacta al administrador.",
      { label: "Revisar mi cuenta", url: "{{ .SiteURL }}/account/profile" },
    ),
  },
  {
    id: "mfa-method-removed",
    subject: "Se retiró verificación adicional de tu cuenta de Pase Central",
    html: layout(
      "Verificación adicional retirada",
      "Se retiró un método de verificación adicional de tu cuenta. Si no lo hiciste, contacta al administrador y protege tu acceso.",
      { label: "Revisar mi cuenta", url: "{{ .SiteURL }}/account/profile" },
    ),
  },
];
