import { supabase } from '@/shared/lib/supabase';

export type RoleKey = string;
export type ModuleKey =
  | 'dashboard'
  | 'pedidos'
  | 'proveedores'
  | 'inventario'
  | 'produccion'
  | 'usuarios'
  | 'ajustes';

export interface ModulePermission {
  lectura: boolean;
  escritura: boolean;
  full: boolean;
}

export type RolePermisos = Record<ModuleKey, ModulePermission>;
export type AllPermisos = Record<RoleKey, RolePermisos>;

const TABLE = 'roles_permisos';

interface Row {
  role: RoleKey;
  permisos: RolePermisos;
  updated_at?: string;
  updated_by?: string | null;
}

export async function loadPermisos(): Promise<AllPermisos | null> {
  const { data, error } = await supabase.from(TABLE).select('role, permisos');
  if (error) throw error;
  if (!data || !data.length) return null;
  return (data as Row[]).reduce<AllPermisos>((acc, row) => {
    acc[row.role] = row.permisos;
    return acc;
  }, {} as AllPermisos);
}

export async function savePermisos(all: AllPermisos, actorEmail: string): Promise<void> {
  const rows = Object.keys(all).map((role) => ({
    role,
    permisos: all[role],
    updated_at: new Date().toISOString(),
    updated_by: actorEmail,
  }));
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'role' });
  if (error) throw error;
}

export async function eliminarPermisosRol(role: RoleKey): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('role', role);
  if (error) throw error;
}
