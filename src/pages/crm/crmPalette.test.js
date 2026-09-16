/**
 * Every C.<token> the CRM references has to exist.
 *
 * `background: C.card` shipped to production. There is no C.card, so the value
 * was undefined, so React omitted the property, so the share menu rendered with
 * no background at all — its text sitting directly on the table rows behind it.
 * Nothing threw, nothing logged, no test failed, and the build was clean. A
 * typo'd colour token is invisible until someone looks at the screen.
 *
 * So this reads the CRM's own source and checks every token against the real
 * palette. It is a grep with an opinion, which is the only kind of check that
 * catches a name that was never defined.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { C } from "./crmUi.jsx";

const CRM_DIR = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/**
 * Comments explain tokens as often as they use them — the note next to the fix
 * for this very bug names C.card twice — so they are stripped before matching.
 * The `//` rule skips a `//` that follows a colon so URLs survive.
 */
const codeOnly = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<![:/])\/\/.*$/gm, "");

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(name) && !name.endsWith(".test.js") ? [full] : [];
  });
}

describe("the CRM colour palette", () => {
  it("defines every token the CRM asks for", () => {
    const known = new Set(Object.keys(C));
    const missing = [];

    for (const file of sourceFiles(CRM_DIR)) {
      const src = codeOnly(readFileSync(file, "utf8"));
      // C.foo, but not this.C.foo or a longer identifier ending in C
      for (const m of src.matchAll(/(?<![A-Za-z0-9_.])C\.([A-Za-z][A-Za-z0-9_]*)/g)) {
        if (!known.has(m[1])) missing.push(`${file.split(/[\\/]/).pop()} → C.${m[1]}`);
      }
    }

    expect(missing, "undefined palette tokens render as no style at all").toEqual([]);
  });

  it("has a usable value for every token", () => {
    // An empty string is as invisible as undefined, and just as quiet.
    for (const [name, value] of Object.entries(C)) {
      expect(typeof value, name).toBe("string");
      expect(value.length, name).toBeGreaterThan(0);
    }
  });
});
