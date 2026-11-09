import { AppFrame } from './AppFrame';
import { Notice } from './common';
import type { FrameData } from './types';

/** Not found, or could not load. */
export function MessagePage({ frame, title, back, error, text, link }: { frame: FrameData; title: string; back: { href: string; label: string }; error: string | null; text: string; link: { href: string; label: string } }) {
  return (
    <AppFrame frame={frame} title={title} back={back}>
      {error ? <Notice tone="error">{error}</Notice> : <p>{text} <a className="text-link underline" href={link.href}>{link.label}</a>.</p>}
    </AppFrame>
  );
}
