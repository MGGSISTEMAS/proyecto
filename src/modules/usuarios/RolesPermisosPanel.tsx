import { useEffect, useState } from 'react';
import { toast } from '@/shared/ui/Toast';
import { notify } from '@/shared/lib/notify';
import { ConfirmDialog } from '@/shared/ui/Modal';
import { useSession } from '@/modules/auth/authStore';
import {
  loadPermisos,
  savePermisos,
  eliminarPermisosRol,
  type AllPermisos,
  type ModuleKey,
  type ModulePermission,
  type RoleKey,
  type RolePermisos,
} from './permisos.repository';
import {
  listRoles,
  eliminarRol,
  contarUsuariosPorRol,
  type CustomRole,
} from './roles.repository';
import { setRolesCache } from './usuarios.repository';
import { NuevoRolModal, GestionarRolesModal } from './RolesModales';

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'dashboard',   label: 'Dashboard' },
  { key: 'pedidos',     label: 'Pedidos / Compras' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'inventario',  label: 'Inventario' },
  { key: 'produccion',  label: 'Producción' },
  { key: 'usuarios',    label: 'Usuarios' },
  { key: 'ajustes',     label: 'Ajustes' },
];

const empty: ModulePermission = { lectura: false, escritura: false, full: false };

function defaultsFor(role: RoleKey): RolePermisos {
  const all: RolePermisos = MODULES.reduce<RolePermisos>((acc, m) => {
    acc[m.key] = { ...empty };
    return acc;
  }, {} as RolePermisos);

  if (role === 'admin') {
    MODULES.forEach((m) => (all[m.key] = { lectura: true, escritura: true, full: true }));
  } else if (role === 'analista') {
    (['dashboard', 'pedidos', 'proveedores', 'inventario', 'produccion', 'ajustes'] as ModuleKey[]).forEach((k) => {
      all[k] = { lectura: true, escritura: true, full: false };
    });
    all.usuarios = { lectura: true, escritura: false, full: false };
  } else if (role === 'obrero') {
    all.dashboard  = { lectura: true, escritura: false, full: false };
    all.pedidos    = { lectura: true, escritura: true, full: false };
    all.inventario = { lectura: true, escritura: true, full: false };
    all.produccion = { lectura: true, escritura: false, full: false };
    all.ajustes    = { lectura: true, escritura: false, full: false };
  } else {
    all.dashboard = { lectura: true, escritura: false, full: false };
  }
  return all;
}

function normalize(stored: Partial<AllPermisos>, roles: CustomRole[]): AllPermisos {
  return roles.reduce<AllPermisos>((acc, r) => {
    const role = (stored[r.key] ?? {}) as Partial<RolePermisos>;
    acc[r.key] = MODULES.reduce<RolePermisos>((m, mod) => {
      m[mod.key] = { ...empty, ...role[mod.key] };
      return m;
    }, {} as RolePermisos);
    return acc;
  }, {} as AllPermisos);
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'crear' }
  | { kind: 'gestionar' }
  | { kind: 'eliminar'; role: CustomRole };

export function RolesPermisosPanel() {
  const { user } = useSession();
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [permisos, setPermisos] = useState<AllPermisos>({} as AllPermisos);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  async function refresh() {
    setLoading(true);
    try {
      const [rolesList, remote, c] = await Promise.all([
        listRoles(),
        loadPermisos(),
        contarUsuariosPorRol(),
      ]);
      setRolesCache(rolesList);
      setRoles(rolesList);
      setCounts(c);
      if (remote) {
        setPermisos(normalize(remote, rolesList));
      } else {
        const defaults = rolesList.reduce<AllPermisos>((acc, r) => {
          acc[r.key] = defaultsFor(r.key);
          return acc;
        }, {} as AllPermisos);
        setPermisos(defaults);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la matriz', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void refresh().finally(() => { if (cancelled) void 0; });
    return () => { cancelled = true; };
  }, []);

  function togglePerm(role: RoleKey, mod: ModuleKey, field: keyof ModulePermission) {
    setDirty(true);
    setPermisos((prev) => {
      const current = prev[role]?.[mod] ?? { ...empty };
      const next: ModulePermission = { ...current, [field]: !current[field] };
      if (field === 'full' && next.full) {
        next.lectura = true;
        next.escritura = true;
      }
      if ((field === 'lectura' || field === 'escritura') && !next[field]) {
        next.full = false;
      }
      return {
        ...prev,
        [role]: { ...prev[role], [mod]: next },
      };
    });
  }

  function resetRol(role: RoleKey) {
    setDirty(true);
    setPermisos((prev) => ({ ...prev, [role]: defaultsFor(role) }));
    toast(`Permisos del rol "${role}" reseteados al valor por defecto`, 'info');
  }

  async function guardar() {
    setSaving(true);
    try {
      await savePermisos(permisos, user?.email ?? 'sistema');
      notify('Matriz de roles y permisos guardada', 'success', { link: '#/app/usuarios' });
      setDirty(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminarRol(role: CustomRole) {
    try {
      await eliminarRol(role.key);
      try { await eliminarPermisosRol(role.key); } catch { /* opcional */ }
      notify(`Rol eliminado: ${role.label}`, 'success', { link: '#/app/usuarios' });
      setModal({ kind: 'none' });
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar', 'error');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Roles y Permiso</h2>
          <p className="muted" style={{ margin: '.25rem 0 0', fontSize: '.88rem' }}>
            Definí qué acciones puede realizar cada rol sobre cada módulo. Podés crear roles
            nuevos y eliminar los que no tengan usuarios asignados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setModal({ kind: 'gestionar' })} title="Editar nombre, descripción o color de roles">
            ⚙ Gestionar
          </button>
          <button className="btn btn-ghost" onClick={() => setModal({ kind: 'crear' })}>+ Nuevo rol</button>
          <button className="btn btn-primary" onClick={guardar} disabled={!dirty || saving || loading}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '1.25rem' }}>
          <p className="muted" style={{ margin: 0 }}>Cargando matriz de permisos…</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1rem',
          }}
        >
          {roles.map((rc) => {
            const enUso = counts[rc.key] ?? 0;
            return (
              <div
                key={rc.key}
                className="card"
                style={{ padding: '1.25rem', borderTop: `3px solid ${rc.color}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.75rem' }}>
                  <div>
                    <div className="card-title" style={{ marginBottom: '.25rem' }}>
                      <span>{rc.label}</span>
                      {rc.sistema && <span className="badge" style={{ marginLeft: '.4rem', fontSize: '.65rem' }}>SISTEMA</span>}
                    </div>
                    <p className="muted" style={{ margin: 0, fontSize: '.78rem' }}>{rc.descripcion ?? '—'}</p>
                    <p className="muted" style={{ margin: '.25rem 0 0', fontSize: '.72rem' }}>
                      {enUso === 0 ? 'Sin usuarios asignados' : `${enUso} usuario(s) asignado(s)`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => resetRol(rc.key)}
                      title="Resetear este rol a los valores por defecto"
                    >
                      ↺ Default
                    </button>
                    {!rc.sistema && enUso === 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setModal({ kind: 'eliminar', role: rc })}
                        title="Eliminar este rol"
                      >
                        🗑 Eliminar
                      </button>
                    )}
                  </div>
                </div>

                <table className="table" style={{ fontSize: '.82rem' }}>
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      <th style={{ textAlign: 'center' }}>Lectura</th>
                      <th style={{ textAlign: 'center' }}>Escritura</th>
                      <th style={{ textAlign: 'center' }} title="Implica lectura y escritura">Full control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((m) => {
                      const p = permisos[rc.key]?.[m.key] ?? { ...empty };
                      return (
                        <tr key={m.key}>
                          <td><strong>{m.label}</strong></td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={p.lectura} onChange={() => togglePerm(rc.key, m.key, 'lectura')} aria-label={`Lectura ${m.label} para ${rc.label}`} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={p.escritura} onChange={() => togglePerm(rc.key, m.key, 'escritura')} aria-label={`Escritura ${m.label} para ${rc.label}`} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={p.full} onChange={() => togglePerm(rc.key, m.key, 'full')} aria-label={`Full control ${m.label} para ${rc.label}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {modal.kind === 'crear' && (
        <NuevoRolModal
          actorEmail={user?.email ?? undefined}
          onClose={() => setModal({ kind: 'none' })}
          onCreated={async (creado) => {
            setPermisos((prev) => ({ ...prev, [creado.key]: defaultsFor(creado.key) }));
            setDirty(true);
            setModal({ kind: 'none' });
            await refresh();
          }}
        />
      )}

      {modal.kind === 'gestionar' && (
        <GestionarRolesModal
          roles={roles}
          conteoUso={counts}
          actorEmail={user?.email ?? undefined}
          onClose={() => setModal({ kind: 'none' })}
          onCambioAplicado={refresh}
        />
      )}

      {modal.kind === 'eliminar' && (
        <ConfirmDialog
          title="Eliminar rol"
          message={`Se eliminará el rol "${modal.role.label}". Esto borra también su matriz de permisos. ¿Continuar?`}
          confirmText="Eliminar"
          danger
          onCancel={() => setModal({ kind: 'none' })}
          onConfirm={() => handleEliminarRol(modal.role)}
        />
      )}
    </div>
  );
}
