/**
 * Servicio de notificaciones por email vía Amazon SES (SMTP global del negocio).
 * Reutiliza las credenciales SES configuradas para Espacios Plus (.env raíz):
 * SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM.
 * El destinatario se controla con NOTIFY_EMAIL (pruebas: camilosal@gmail.com).
 *
 * Envío best-effort: nunca lanza excepción hacia el caller para no bloquear
 * el flujo del usuario (lead/pedido) si SES falla.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'info@espaciosplus.com';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'camilosal@gmail.com';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // SES usa STARTTLS en el puerto 587
      requireTLS: SMTP_PORT === 587,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export interface NotificacionEmail {
  asunto: string;
  html: string;
  texto?: string;
  replyTo?: string;
}

/**
 * Envía una notificación al correo de administración (NOTIFY_EMAIL).
 * Devuelve true si el envío fue exitoso, false en cualquier otro caso.
 */
export async function enviarNotificacion({ asunto, html, texto, replyTo }: NotificacionEmail): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[mailer] SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS); notificación omitida:', asunto);
    return false;
  }
  try {
    const info = await transport.sendMail({
      from: `"Iwagé Notificaciones" <${SMTP_FROM}>`,
      to: NOTIFY_EMAIL,
      subject: asunto,
      html,
      text: texto,
      ...(replyTo ? { replyTo } : {}),
    });
    console.log(`[mailer] Notificación enviada a ${NOTIFY_EMAIL}: "${asunto}" (${info.messageId})`);
    return true;
  } catch (err: any) {
    console.error('[mailer] Error enviando notificación:', err.message);
    return false;
  }
}

/** Escapa HTML básico para incrustar datos de usuario en el correo. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tabla HTML simple con pares etiqueta/valor para los correos de notificación. */
export function tablaDatos(rows: Array<[string, string | null | undefined]>): string {
  const filas = rows
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;background:#f4f4f0;font-weight:bold;white-space:nowrap;">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 12px;">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;border:1px solid #e0e0d8;">${filas}</table>`;
}
