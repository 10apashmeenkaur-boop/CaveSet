import { useMemo } from 'react';
import { mistriLine } from '../sim/progress';
import type { Level } from '../sim/types';
import { useStore } from '../store';
import { FAILURE_LABEL, pickQuote, type FailureCode } from './quotes';

export function QuoteBanner({ codes }: { codes?: FailureCode[] }) {
  // New quote each time the banner mounts.
  const q = useMemo(() => pickQuote(codes), [codes]);
  return (
    <figure className="quote">
      <blockquote>“{q.text}”</blockquote>
      <figcaption>— {FAILURE_LABEL[q.code]}</figcaption>
    </figure>
  );
}

/** In a level, the quote card is the Master Builder (Mistri Ji in code): his brief, then a piece of advice after repeated failed runs. */
export function MistriCard({ level }: { level: Level }) {
  const line = useStore((s) => mistriLine(level, s.progress));
  if (!line) return <QuoteBanner />;
  return (
    <figure className={`quote mistri ${line.hint ? 'salaah' : ''}`}>
      {line.hint && <span className="salaah-tag">Master Builder’s advice</span>}
      <blockquote>“{line.text}”</blockquote>
      <figcaption>— The Master Builder</figcaption>
    </figure>
  );
}
