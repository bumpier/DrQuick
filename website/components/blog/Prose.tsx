// Markdown in the site's type scale (DESIGN.md, Lime & Forest). One renderer
// for the public article, the admin editor's live preview and the legal pages,
// so a preview is exactly what publishes.
//
// Safety: react-markdown never renders raw HTML unless a rehype-raw plugin is
// added, and none is — a <script> in a post is shown as text. That matters
// because script-src keeps 'unsafe-inline' for the pre-paint role script.
// Images: the CSP allows img-src 'self' only, so an image renders when its
// source is one of our own /assets/ paths, and anything else becomes a plain
// link to it rather than a broken box.
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const isInternal = (href?: string) => !!href && (href.startsWith('/') || href.startsWith('#')) && !href.startsWith('//');

const COMPONENTS: Components = {
  // A page has one h1 (the article title), so a Markdown heading 1 becomes an h2.
  h1: ({ children }) => <h2 className="prose-h2">{children}</h2>,
  h2: ({ children }) => <h2 className="prose-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="prose-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="prose-h4">{children}</h4>,
  h5: ({ children }) => <h4 className="prose-h4">{children}</h4>,
  h6: ({ children }) => <h4 className="prose-h4">{children}</h4>,
  a: ({ href, children }) =>
    isInternal(href)
      ? <a href={href}>{children}</a>
      : <a href={href} rel="noopener noreferrer" target="_blank">{children}</a>,
  img: ({ src, alt }) => {
    const source = typeof src === 'string' ? src : '';
    if (source.startsWith('/assets/')) {
      // eslint-disable-next-line @next/next/no-img-element -- authored content, sized by CSS
      return <img src={source} alt={alt ?? ''} loading="lazy" decoding="async" />;
    }
    return <a href={source} rel="noopener noreferrer" target="_blank">{alt || source}</a>;
  },
  table: ({ children }) => <div className="prose-table"><table>{children}</table></div>,
};

export function Prose({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn('prose', className)} data-slot="prose">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS} skipHtml>
        {markdown}
      </Markdown>
    </div>
  );
}
