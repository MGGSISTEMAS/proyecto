/* ============================================================
   MGG · Tesorería · Personal de nómina
   "Usuarios" son los del login; "Personal" engloba a TODO el personal
   a pagar (tengan o no usuario). Se administra y se paga desde
   Tesorería → Pago a personal.
   ============================================================ */
import { supabase } from '@/shared/lib/supabase';
import type { Personal } from '@/shared/lib/types';

const TABLE = 'personal';

/** Lista el personal, ordenado por departamento y nombre. */
export async function listPersonal(soloActivos = false): Promise<Personal[]> {
  let q = supabase.from(TABLE).select('*').order('departamento', { ascending: true, nullsFirst: false }).order('nombre', { ascending: true });
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Personal[];
}

export interface PersonalInput {
  nombre: string;
  apellido?: string;
  cedula?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  sueldo_base?: number;
}

export async function crearPersonal(input: PersonalInput, actorEmail?: string): Promise<Personal> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error('Indicá el nombre.');
  const { data, error } = await supabase.from(TABLE).insert({
    nombre,
    apellido: (input.apellido ?? '').trim(),
    cedula: input.cedula?.trim() || null,
    cargo: input.cargo?.trim() || null,
    departamento: input.departamento?.trim() || null,
    sueldo_base: Math.round((Number(input.sueldo_base) || 0) * 100) / 100,
    created_by: actorEmail ?? null,
  }).select('*').single();
  if (error) throw error;
  return data as Personal;
}

export async function actualizarPersonal(id: string, patch: PersonalInput): Promise<Personal> {
  const nombre = patch.nombre.trim();
  if (!nombre) throw new Error('Indicá el nombre.');
  const { data, error } = await supabase.from(TABLE).update({
    nombre,
    apellido: (patch.apellido ?? '').trim(),
    cedula: patch.cedula?.trim() || null,
    cargo: patch.cargo?.trim() || null,
    departamento: patch.departamento?.trim() || null,
    sueldo_base: Math.round((Number(patch.sueldo_base) || 0) * 100) / 100,
  }).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Personal;
}

/** Activa o desactiva (no borra: conserva el histórico de pagos). */
export async function setPersonalActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ activo }).eq('id', id);
  if (error) throw error;
}

/** Elimina definitivamente una persona del personal. */
export async function eliminarPersonal(id: string): Promise<void> {
  const { data, error } = await supabase.from(TABLE).delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No se pudo eliminar: sin permiso o ya no existía.');
}
