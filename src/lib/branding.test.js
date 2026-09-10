/**
 * One wordmark, everywhere.
 *
 * The brand was being drawn by hand in eight places: "Mov" + a coloured "EAZY"
 * span, an MZ monogram beside the word in Georgia serif, and an SVG hub with
 * "Eazy" in coral — a red that isn't a MovEazy colour at all. Each looked fine
 * on its own page and wrong beside any other.
 *
 * The wordmark now comes from components/branding/MovEAZYLogo.jsx. This test
 * fails if a page starts drawing its own again.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(jsx?|html)$/.test(name) ? [full] : [];
  });

const files = sources("src").filter(
  (f) => !f.endsWith("branding.test.js") && !f.includes("branding/MovEAZYLogo"),
);

const scan = (pattern) =>
  files.filter((f) => pattern.test(readFileSync(f, "utf8")));

describe("the wordmark is never hand-drawn", () => {
  it("has no split Mov + EAZY text mark", () => {
    // Catches `mov<span style={{color:…}}>EAZY</span>` in any casing.
    expect(scan(/\bmov<span[^>]*>eazy/i)).toEqual([]);
  });

  it("has no wordmark split across SVG text elements", () => {
    expect(scan(/<text[^>]*>\s*Mov\s*<\/text>/i)).toEqual([]);
  });

  it("does not set the brand in a serif face", () => {
    // The Georgia "Moveazy" lockup, which appeared on four screens.
    expect(scan(/Georgia[^}]*\}\}>\s*Moveazy\s*</i)).toEqual([]);
  });

  it("loads the wordmark from the shipped asset, not a stray file", () => {
    // moveasy.svg — a differently-spelled leftover — is not the wordmark.
    expect(scan(/assets\/logo\/moveasy\.svg/)).toEqual([]);
  });
});
