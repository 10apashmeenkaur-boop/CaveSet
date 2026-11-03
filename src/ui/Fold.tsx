import { useState, type ReactNode } from 'react';

/** A card section with a clickable header that opens and closes it. */
export function Fold({
  title,
  defaultOpen = true,
  className = '',
  extra,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Shown at the right of the header (e.g. a small badge). */
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`fold ${open ? 'open' : 'closed'} ${className}`}>
      <button className="fold-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="fold-title">{title}</span>
        {extra}
        <span className="fold-chev" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  );
}
