import { describe, expect, it } from "vitest";
import { A4, jpegToPdf } from "./pdfImage";

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

describe("jpegToPdf", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

  it("writes a one-page A4 PDF whose cross-reference table points at every object", () => {
    const pdf = latin1(jpegToPdf(jpeg, 1680, 2376, "portrait"));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain(`/MediaBox [0 0 ${A4.portrait[0]} ${A4.portrait[1]}]`);
    expect(pdf).toContain("/Width 1680 /Height 2376");
    expect(pdf).toContain(`/Filter /DCTDecode /Length ${jpeg.length}`);

    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((o, i) => expect(pdf.startsWith(`${i + 1} 0 obj\n`, o)).toBe(true));
    const startxref = Number(pdf.match(/startxref\n(\d+)/)[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("keeps the JPEG bytes intact and turns the page for landscape", () => {
    const bytes = jpegToPdf(jpeg, 2376, 1680, "landscape");
    const pdf = latin1(bytes);
    const at = pdf.indexOf("stream\n") + 7;
    expect(Array.from(bytes.slice(at, at + jpeg.length))).toEqual(Array.from(jpeg));
    expect(pdf).toContain(`/MediaBox [0 0 ${A4.landscape[0]} ${A4.landscape[1]}]`);
  });
});
