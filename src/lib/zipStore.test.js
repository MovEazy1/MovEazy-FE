import { describe, expect, it } from "vitest";
import { crc32, zipStore } from "./zipStore";
import { jpegsToPdf } from "./pdfImage";

const latin1 = (u8) => Array.from(u8, (b) => String.fromCharCode(b)).join("");

describe("zipStore", () => {
  it("checksums like everyone else", () => {
    expect(crc32(new TextEncoder().encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
  it("lays out local headers, the directory and its end", () => {
    const a = new TextEncoder().encode("hello");
    const zip = zipStore([{ name: "a.txt", data: a }, { name: "MovEazy - Sobha.pdf", data: new Uint8Array([1, 2, 3]) }]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const cdAt = v.getUint32(end + 16, true);
    expect(v.getUint32(cdAt, true)).toBe(0x02014b50);
    expect(latin1(zip)).toContain("MovEazy - Sobha.pdf");
  });
});

describe("jpegsToPdf", () => {
  it("puts each JPEG on its own page", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = latin1(jpegsToPdf([{ jpeg, w: 10, h: 14 }, { jpeg, w: 10, h: 14 }]));
    expect(pdf).toContain("/Kids [3 0 R 6 0 R] /Count 2");
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(8);
    offsets.forEach((o, i) => expect(pdf.startsWith(`${i + 1} 0 obj\n`, o)).toBe(true));
  });
});
