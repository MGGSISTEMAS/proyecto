/* ============================================================
   MGG · Realtime · Suscripción a cambios de Supabase
   El sistema es multiusuario: lo que registra un usuario se refleja
   en los demás sin recargar. Este hook se suscribe a los cambios
   (INSERT/UPDATE/DELETE) de una o varias tablas y llama a `onChange`
   (debounced) para que la vista vuelva a cargar sus datos.

   Requiere que las tablas estén en la publicación `supabase_realtime`
   (ver supabase/schema.sql, sección realtime).
   ============================================================ */
import { useEffect, useRef } from 'react';
import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * Suscribe `onChange` a los cambios de `tables`. Recarga con debounce (300 ms)
 * para agrupar ráfagas de eventos. Se desuscribe al desmontar o cambiar tablas.
 */
export function useRealtime(tables: string[], onChange: () => void, opts?: { enabled?: boolean }): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  const enabled = opts?.enabled ?? true;
  const key = [...tables].sort().join(',');

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !tables.length) return;
    let sb;
    try { sb = getSupabase(); } catch { return; }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => cb.current(), 300); };

    const channel = sb.channel(`rt-${key}-${Math.floor(Math.random() * 1e9)}`);
    tables.forEach((t) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, fire);
    });
    channel.subscribe();

    return () => { if (timer) clearTimeout(timer); sb.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}
