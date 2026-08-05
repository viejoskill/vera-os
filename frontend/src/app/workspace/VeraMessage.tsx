import { Fragment, type ReactNode } from 'react';

/** Renderiza el texto de VERA con formato liviano: títulos (#), viñetas (- •),
 * listas numeradas (1.), **negritas** y *palabras destacadas* (dorado). Sin
 * dependencias externas: parser propio pensado para la salida de VERA/Studio. */

const inline = (text: string): ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).filter((p) => p !== '');
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith('*') && p.endsWith('*')) {
      return <span className="vera-md__hl" key={i}>{p.slice(1, -1)}</span>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
};

export const VeraMessage = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(
      list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>,
    );
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    const star = line.match(/^\s*★\s*(.*)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);

    if (heading) {
      flush();
      blocks.push(<h4 key={blocks.length}>{inline(heading[2])}</h4>);
    } else if (star) {
      flush();
      blocks.push(
        <p className="vera-md__star" key={blocks.length}>
          <span className="vera-md__star-ic">★</span> {inline(star[1])}
        </p>,
      );
    } else if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[2]);
    } else {
      flush();
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  });
  flush();

  return <div className="vera-md">{blocks}</div>;
};

export default VeraMessage;
