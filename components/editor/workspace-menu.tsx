'use client';
// Menú contextual propio del editor.
//
// El clic derecho dentro del editor abre este menú en lugar del del navegador: el navegador no sabe nada del
// proyecto ni de la línea de tiempo, así que su menú no sirve para editar. El menú se coloca donde está el
// puntero (sin salirse de la pantalla), se cierra con Escape, con la rueda, al cambiar el tamaño de la ventana
// o al hacer clic fuera, y sus entradas llevan `role="menuitem"` para poder manejarlo con el teclado.
//
// Las entradas pueden tener hijas (`items`): en VEGAS los submenús del clic derecho (Modificadores, Toma, Grupo,
// Sincronizar, Enlace sinc, Insertar/eliminar envolvente…) guardan ahí sus opciones. El submenú se abre al pasar
// el puntero o con la flecha derecha, y se coloca a la derecha de su entrada; si no cabe, se voltea a la
// izquierda, y si tampoco cabe verticalmente se sube.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type WorkspaceMenuItem = {
  label?: string;                       // sin etiqueta y con `separator` es una raya
  onSelect?: () => void;
  disabled?: boolean;
  separator?: boolean;
  hint?: string;                        // atajo o aclaración, a la derecha
  checked?: boolean;                    // para las entradas que se activan y desactivan
  items?: WorkspaceMenuItem[];          // submenú (como los «▸» de VEGAS)
};
export type WorkspaceMenuState = { x: number; y: number; title?: string; items: WorkspaceMenuItem[] } | null;

// Una raya al principio o al final del menú no se dibuja: VEGAS tampoco deja separadores sueltos en los bordes.
function trimSeparators(items: WorkspaceMenuItem[]): WorkspaceMenuItem[] {
  return items.filter((item, index) => item.separator ? index > 0 && index < items.length - 1 : true);
}

export function WorkspaceMenu({ menu, onClose }: { menu: WorkspaceMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // El menú se mide ya dibujado para poder meterlo entero en la pantalla: primero se pinta en el sitio del
  // puntero y, con el tamaño real, se corrige si se salía por la derecha o por abajo.
  useLayoutEffect(() => {
    if (!menu) return;
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const maxX = Math.max(4, window.innerWidth - box.width - 6);
    const maxY = Math.max(4, window.innerHeight - box.height - 6);
    setPosition({ x: Math.max(4, Math.min(menu.x, maxX)), y: Math.max(4, Math.min(menu.y, maxY)) });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const inside = (target: EventTarget | null) => Boolean(ref.current && target instanceof Node && ref.current.contains(target));
    const onPointerDown = (event: PointerEvent) => { if (!inside(event.target)) onClose(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      // Con el teclado se recorre la lista de entradas activas y se activa con Enter o con la barra. La flecha
      // derecha abre el submenú de la entrada enfocada y la izquierda lo cierra.
      if (event.key === 'ArrowRight') {
        const active = document.activeElement as HTMLElement | null;
        const opener = active?.closest<HTMLElement>('.workspace-menu-sub')?.querySelector<HTMLElement>('.workspace-menu-subpanel');
        if (opener) { event.preventDefault(); opener.querySelector<HTMLButtonElement>('button[role=menuitem]:not([disabled])')?.focus(); return; }
      }
      if (event.key === 'ArrowLeft') {
        const active = document.activeElement as HTMLElement | null;
        const panel = active?.closest<HTMLElement>('.workspace-menu-subpanel');
        if (panel) { event.preventDefault(); panel.parentElement?.querySelector<HTMLButtonElement>(':scope > button[role=menuitem]')?.focus(); return; }
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
      // El recorrido se queda dentro del panel que tiene el foco: los submenús cerrados no entran en la lista.
      const scope = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.workspace-menu-subpanel') ?? ref.current;
      const items = Array.from(scope?.querySelectorAll<HTMLButtonElement>(':scope > button[role=menuitem]:not([disabled])') ?? []);
      if (!items.length) return;
      event.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const index = items.findIndex(item => item === active);
      if (event.key === 'Enter' && index >= 0) { items[index].click(); return; }
      const step = event.key === 'ArrowUp' ? -1 : 1;
      items[(index + step + items.length) % items.length].focus();
    };
    const close = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.addEventListener('wheel', close, { passive: true });
    // El primer elemento activo recibe el foco para poder navegar con el teclado desde el primer momento.
    ref.current?.querySelector<HTMLButtonElement>(':scope > button[role=menuitem]:not([disabled])')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('wheel', close);
    };
  }, [menu, onClose]);
  if (!menu) return null;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={menu.title ?? 'Menú del editor'}
      className="workspace-menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={event => event.stopPropagation()}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
    >
      {menu.title && <div className="workspace-menu-title">{menu.title}</div>}
      <MenuEntries items={trimSeparators(menu.items)} onDone={onClose} />
    </div>
  );
}

function MenuEntries({ items, onDone }: { items: WorkspaceMenuItem[]; onDone: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return <>{items.map((item, index) => item.separator
    ? <div key={`sep-${index}`} className="workspace-menu-separator" role="separator" />
    : item.items?.length
      ? <SubMenu key={`item-${index}`} item={item} open={open === index} onOpen={() => setOpen(index)} onClose={close} onDone={onDone} />
      : <button
          key={`item-${index}`}
          type="button"
          role="menuitem"
          aria-label={item.label}
          className={`workspace-menu-item ${item.checked ? 'checked' : ''}`}
          disabled={item.disabled}
          onPointerEnter={() => setOpen(null)}
          onClick={() => { item.onSelect?.(); onDone(); }}
        >
          <span>{item.label}</span>
          {item.hint && <span className="workspace-menu-hint" aria-hidden="true">{item.hint}</span>}
        </button>)}</>;
}

// Una entrada con hijas: el botón abre el panel, que se mide al abrirse para decidir de qué lado cae.
function SubMenu({ item, open, onOpen, onClose, onDone }: { item: WorkspaceMenuItem; open: boolean; onOpen: () => void; onClose: () => void; onDone: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState({ x: false, y: 0 });
  useLayoutEffect(() => {
    if (!open) return;
    const box = panel.current?.getBoundingClientRect();
    const anchor = panel.current?.parentElement?.getBoundingClientRect();
    if (!box || !anchor) return;
    const overX = anchor.right + box.width > window.innerWidth - 4;
    const overY = anchor.top + box.height > window.innerHeight - 4;
    setFlip({ x: overX, y: overY ? Math.min(0, window.innerHeight - 4 - box.height - anchor.top) : 0 });
  }, [open]);
  return <div className="workspace-menu-sub" onPointerEnter={onOpen} onPointerLeave={onClose}>
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={item.label}
      className={`workspace-menu-item ${item.checked ? 'checked' : ''}`}
      disabled={item.disabled}
      onClick={event => { event.stopPropagation(); if (open) onClose(); else onOpen(); }}
    >
      <span>{item.label}</span>
      <span className="workspace-menu-hint" aria-hidden="true">{item.hint ?? '▸'}</span>
    </button>
    {open && <div
      ref={panel}
      role="menu"
      aria-label={item.label}
      className="workspace-menu-subpanel"
      style={{ left: flip.x ? undefined : '100%', right: flip.x ? '100%' : undefined, top: flip.y }}
    >
      <MenuEntries items={trimSeparators(item.items ?? [])} onDone={onDone} />
    </div>}
  </div>;
}
