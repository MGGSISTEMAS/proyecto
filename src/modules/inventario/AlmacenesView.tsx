import { EmptyState } from '@/shared/ui/EmptyState';
import { money, num } from '@/shared/lib/format';
import type { Almacen } from '@/shared/lib/types';
import { nombreCortoAlmacen, type AlmacenValor } from './almacenes.repository';

export type AlmacenLayout = 'kanban' | 'lista';

interface AlmacenesViewProps {
  almacenes: Almacen[];
  valores: Record<string, AlmacenValor>;
  layout: AlmacenLayout;
  canWrite?: boolean;
  onSelect: (nombre: string) => void;
  onConsumo: (nombre: string) => void;
  onEditar: (a: Almacen) => void;
  onEliminar: (a: Almacen) => void;
  onAgregarSub: (a: Almacen) => void;
}

const EMPTY_VALOR: AlmacenValor = { valor: 0, items: 0, unidades: 0 };

/** Hijos directos de un almacén (subalmacenes). */
function hijosDe(parentId: string | null, almacenes: Almacen[]): Almacen[] {
  return almacenes
    .filter((a) => (a.parent_id ?? null) === parentId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Almacenes de nivel superior (sin padre, o cuyo padre ya no existe). */
function raices(almacenes: Almacen[]): Almacen[] {
  const ids = new Set(almacenes.map((a) => a.id));
  return almacenes
    .filter((a) => !a.parent_id || !ids.has(a.parent_id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function AlmacenesView({ almacenes, valores, layout, canWrite = true, onSelect, onConsumo, onEditar, onEliminar, onAgregarSub }: AlmacenesViewProps) {
  if (!almacenes.length) {
    return (
      <div className="card">
        <EmptyState message="No hay almacenes. Creá el primero con “+ Agregar almacén”." icon="▣" />
      </div>
    );
  }

  if (layout === 'lista') {
    // Aplana el árbol en orden (padre → sus subalmacenes) guardando la profundidad.
    const filas: { a: Almacen; nivel: number }[] = [];
    const empujar = (parentId: string | null, nivel: number) => {
      for (const a of hijosDe(parentId, almacenes)) {
        filas.push({ a, nivel });
        empujar(a.id, nivel + 1);
      }
    };
    raices(almacenes).forEach((r) => { filas.push({ a: r, nivel: 0 }); empujar(r.id, 1); });

    return (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Almacén</th>
              <th>Ubicación</th>
              <th style={{ textAlign: 'right' }}>Productos</th>
              <th style={{ textAlign: 'right' }}>Unidades</th>
              <th style={{ textAlign: 'right' }}>Valor total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ a, nivel }) => {
              const v = valores[a.nombre] ?? EMPTY_VALOR;
              return (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(a.nombre)}>
                  <td style={{ paddingLeft: `${0.5 + nivel * 1.4}rem` }}>
                    {nivel > 0 && <span className="muted" style={{ marginRight: '.3rem' }}>↳</span>}
                    <strong>{nombreCortoAlmacen(a, almacenes)}</strong>
                  </td>
                  <td className="muted">{a.ubicacion || '—'}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{num(v.items)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{num(v.unidades)}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--primary-3)', fontWeight: 600 }}>{money(v.valor)}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm btn-ghost" onClick={() => onSelect(a.nombre)} title="Ver detalle">Ver</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => onConsumo(a.nombre)} title="Gráfica de consumo por producto">📊 Consumo</button>
                    {canWrite && (
                      <>
                        <button className="btn btn-sm btn-ghost" onClick={() => onAgregarSub(a)} title="Agregar subalmacén">+ Sub</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => onEditar(a)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => onEliminar(a)} title="Eliminar almacén">✕</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Kanban: tarjeta por almacén raíz; los subalmacenes se anidan dentro.
  const Tarjeta = ({ a, sub }: { a: Almacen; sub?: boolean }) => {
    const v = valores[a.nombre] ?? EMPTY_VALOR;
    const subs = hijosDe(a.id, almacenes);
    return (
      <div
        className="card"
        style={{ margin: 0, padding: sub ? '.7rem' : '1rem', cursor: 'pointer', borderTop: `3px solid ${sub ? 'var(--primary-2, var(--primary))' : 'var(--primary)'}`, background: sub ? 'var(--bg-1)' : undefined }}
        onClick={() => onSelect(a.nombre)}
        title="Ver detalle del almacén"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: sub ? '.92rem' : '1.02rem' }}>{sub ? '↳ ' : '▣ '}{nombreCortoAlmacen(a, almacenes)}</div>
            <div className="muted" style={{ fontSize: '.75rem' }}>{a.ubicacion || 'Sin ubicación'}</div>
          </div>
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-sm btn-ghost" onClick={() => onConsumo(a.nombre)} title="Gráfica de consumo por producto">📊</button>
            {canWrite && (
              <>
                <button className="btn btn-sm btn-ghost" onClick={() => onAgregarSub(a)} title="Agregar subalmacén">＋Sub</button>
                <button className="btn btn-sm btn-ghost" onClick={() => onEditar(a)} title="Editar">✎</button>
                <button className="btn btn-sm btn-danger" onClick={() => onEliminar(a)} title="Eliminar">✕</button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: sub ? '.4rem' : '.75rem' }}>
          <div className="muted" style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Valor total</div>
          <div className="mono" style={{ fontSize: sub ? '1.05rem' : '1.4rem', fontWeight: 700, color: 'var(--primary-3)' }}>{money(v.valor)}</div>
        </div>

        <div className="muted" style={{ fontSize: '.78rem', marginTop: '.4rem' }}>
          {num(v.items)} producto{v.items !== 1 ? 's' : ''} · {num(v.unidades)} und.
          {subs.length > 0 && <> · <strong>{subs.length}</strong> subalmacén{subs.length !== 1 ? 'es' : ''}</>}
        </div>

        {subs.length > 0 && (
          <div style={{ marginTop: '.6rem', display: 'grid', gap: '.5rem' }} onClick={(e) => e.stopPropagation()}>
            {subs.map((s) => <Tarjeta key={s.id} a={s} sub />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '.85rem' }}>
      {raices(almacenes).map((a) => <Tarjeta key={a.id} a={a} />)}
    </div>
  );
}
