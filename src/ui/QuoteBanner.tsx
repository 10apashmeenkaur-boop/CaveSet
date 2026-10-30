import { useMemo } from 'react';
import { pickQuote, QUOTES } from './quotes';

export function QuoteBanner({ screen }: { screen: keyof typeof QUOTES }) {
  // New quote each time the screen mounts.
  const q = useMemo(() => pickQuote(screen), [screen]);
  return (
    <figure className="quote">
      <blockquote>“{q.text}”</blockquote>
      <figcaption>— {q.who}</figcaption>
    </figure>
  );
}
