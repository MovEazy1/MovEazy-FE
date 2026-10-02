/**
 * One JPEG, one page, as a PDF — all a printable poster needs, without a PDF
 * library. The image fills the page edge to edge; the page is A4 or A1,
 * portrait or landscape, in PDF points (1/72 in).
 */

export const A4 = { portrait: [595.28, 841.89], landscape: [841.89, 595.28] };
export const A1 = { portrait: [1683.78, 2383.94], landscape: [2383.94, 1683.78] };

/** PDF bytes for `jpeg` (a Uint8Array of a baseline JPEG, `w` × `h` pixels) on one page of `paper`. */
export function jpegToPdf(jpeg, w, h, orientation = "portrait", paper = "A4") {
  const sizes = paper === "A1" ? A1 : A4;
  const [pw, ph] = sizes[orientation] || sizes.portrait;
  const enc = new TextEncoder();
  const content = enc.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
  const objects = [
    enc.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    enc.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    [enc.encode(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, enc.encode("\nendstream")],
    [enc.encode(`<< /Length ${content.length} >>\nstream\n`), content, enc.encode("\nendstream")],
  ];

  const parts = [enc.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  let offset = parts[0].length;
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const chunks = [enc.encode(`${i + 1} 0 obj\n`), ...(Array.isArray(body) ? body : [body]), enc.encode("\nendobj\n")];
    for (const c of chunks) { parts.push(c); offset += c.length; }
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`].join("");
  parts.push(enc.encode(xref));

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
