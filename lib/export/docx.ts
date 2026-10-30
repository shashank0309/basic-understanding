import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

function runs(text: string): TextRun[] {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (t.startsWith("**") ? new TextRun({ text: t.slice(2, -2), bold: true }) : new TextRun(t)));
}

/** Minimal Markdown → DOCX (headings, bullets, tables, paragraphs). */
export async function markdownToDocx(md: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[-|\s]+\|$/.test(lines[i])) rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      i--;
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map((r, ri) => new TableRow({ children: r.map((c) => new TableCell({ children: [new Paragraph({ children: ri === 0 ? [new TextRun({ text: c, bold: true })] : runs(c) })] })) })) }));
    } else if (l.startsWith("# ")) children.push(new Paragraph({ text: l.slice(2), heading: HeadingLevel.TITLE }));
    else if (l.startsWith("## ")) children.push(new Paragraph({ text: l.slice(3), heading: HeadingLevel.HEADING_1 }));
    else if (l.startsWith("- ")) children.push(new Paragraph({ children: runs(l.slice(2)), bullet: { level: 0 } }));
    else if (l.startsWith("> ")) children.push(new Paragraph({ children: [new TextRun({ text: l.slice(2), italics: true })] }));
    else if (l.trim()) children.push(new Paragraph({ children: runs(l) }));
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
