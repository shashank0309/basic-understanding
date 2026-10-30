// Tiny Markdown renderer for business cases (headings, lists, tables, bold, quotes).
import type { ReactNode } from "react";

function inline(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[-|\s]+\|$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      i--;
      out.push(
        <table key={i}><thead><tr>{rows[0].map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table>,
      );
    } else if (l.startsWith("# ")) out.push(<h1 key={i}>{l.slice(2)}</h1>);
    else if (l.startsWith("## ")) out.push(<h2 key={i}>{l.slice(3)}</h2>);
    else if (l.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2));
      i--;
      out.push(<ul key={i}>{items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>);
    } else if (l.startsWith("> ")) out.push(<blockquote key={i}>{inline(l.slice(2))}</blockquote>);
    else if (l.trim()) out.push(<p key={i}>{inline(l)}</p>);
  }
  return <div className="prose-md">{out}</div>;
}
