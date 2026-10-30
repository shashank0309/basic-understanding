import PptxGenJS from "pptxgenjs";
import type { Slides } from "../ai/schemas";

export async function buildPptx(opts: { title: string; slides: Slides; clientName: string; color: string }): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const brand = opts.color.replace("#", "");
  pptx.defineSlideMaster({
    title: "FACTORY",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.35, fill: { color: brand } } },
      { text: { text: `${opts.clientName} · AI Council · Demo – synthetic data`, options: { x: 0.4, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: "888888" } } },
    ],
    slideNumber: { x: 12.5, y: 7.0, fontSize: 10, color: "888888" },
  });
  for (const s of opts.slides) {
    const slide = pptx.addSlide({ masterName: "FACTORY" });
    slide.addText(s.title, { x: 0.4, y: 0.55, w: 12.5, h: 0.8, fontSize: 26, bold: true, color: "1F2937" });
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      { x: 0.5, y: 1.5, w: s.keyNumbers.length ? 8 : 12.3, h: 5.2, fontSize: 18, color: "374151", valign: "top", paraSpaceAfter: 8 },
    );
    s.keyNumbers.slice(0, 4).forEach((k, i) => {
      const y = 1.5 + i * 1.3;
      slide.addShape(pptx.ShapeType.roundRect, { x: 8.9, y, w: 4, h: 1.1, fill: { color: "F3F4F6" }, line: { color: brand, width: 1 }, rectRadius: 0.1 });
      slide.addText(k.label, { x: 9.0, y: y + 0.05, w: 3.8, h: 0.4, fontSize: 12, color: "6B7280" });
      slide.addText(k.value, { x: 9.0, y: y + 0.45, w: 3.8, h: 0.55, fontSize: 20, bold: true, color: brand });
    });
  }
  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
