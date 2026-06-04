import { supabase } from '@/shared/lib/supabase';
import { obtenerReporteBase64, type ReporteMeta } from './reportePdf';
import type { MovimientoCaja } from '@/shared/lib/types';

const FUNCTION_SLUG = 'enviar-reporte';

/**
 * Genera el reporte PDF en el navegador y lo envía por correo vía la Edge
 * Function `enviar-reporte` (Brevo). Si no se pasa `toEmail`, va a admin/jefe.
 */
export async function enviarReportePorCorreo(
  movs: MovimientoCaja[],
  meta: ReporteMeta,
  toEmail?: string,
): Promise<{ destinatarios: string[] }> {
  const { base64, nombre } = await obtenerReporteBase64(movs, meta);
  const { data, error } = await supabase.functions.invoke<
    { ok: true; destinatarios: string[] } | { error: string }
  >(FUNCTION_SLUG, {
    body: {
      pdf_base64: base64,
      nombre_archivo: nombre,
      asunto: meta.titulo + (meta.subtitulo ? ` · ${meta.subtitulo}` : ''),
      mensaje: meta.subtitulo ?? '',
      to_email: toEmail,
    },
  });
  if (error) throw new Error(error.message ?? 'No se pudo enviar el correo');
  if (!data || 'error' in data) throw new Error((data as { error?: string })?.error || 'Respuesta inválida');
  return { destinatarios: data.destinatarios };
}
