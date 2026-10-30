import { useMemo } from 'react';
import { FAILURE_LABEL, pickQuote, type FailureCode } from './quotes';

export function QuoteBanner({ codes }: { codes?: FailureCode[] }) {
  // New quote each time the banner mounts.
  const q = useMemo(() => pickQuote(codes), [codes]);
  return (
    <figure className="quote">
      <blockquote>“{q.text}”</blockquote>
      <figcaption>— a sevadar, {FAILURE_LABEL[q.code]}</figcaption>
    </figure>
  );
}
