import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fill, MAIL_LOCALES, MAIL_TEMPLATES, type MailTemplateId, placeholdersOf, renderMailTemplate } from "./mail-templates";

const DIR = path.resolve(__dirname, "../mail-templates");
const preview = (id: string) => JSON.parse(fs.readFileSync(path.join(DIR, id, "preview.json"), "utf8"));

describe("the bilingual e-mail templates (krizaka-notifications format)", () => {
  it("render in English and French, with exactly their declared variables", () => {
    for (const id of Object.keys(MAIL_TEMPLATES) as MailTemplateId[]) {
      const declared = Object.keys(MAIL_TEMPLATES[id]).sort();
      for (const locale of MAIL_LOCALES) {
        const rendered = renderMailTemplate(id, preview(id), { locale, appUrl: "https://dev.kachizaka.com", dir: DIR });
        expect(rendered.locale).toBe(locale);
        expect(rendered.subject.length).toBeGreaterThan(5);
        expect(rendered.html).toContain(`lang="${locale}"`);
        for (const file of ["subject.txt", "body.html", "body.txt"]) {
          const used = [...placeholdersOf(fs.readFileSync(path.join(DIR, id, locale, file), "utf8"))].sort();
          expect(used.every((name) => declared.includes(name)), `${id}/${locale}/${file}`).toBe(true);
        }
      }
    }
  });

  it("never speaks of money, bets or stakes — points only, in both languages", () => {
    for (const id of Object.keys(MAIL_TEMPLATES) as MailTemplateId[]) {
      for (const locale of MAIL_LOCALES) {
        const r = renderMailTemplate(id, preview(id), { locale, appUrl: "https://dev.kachizaka.com", dir: DIR });
        expect(`${r.subject} ${r.text}`).not.toMatch(/\bbet|pari(s)?\b|\$|€|gagner de l'argent|win money|jackpot|cagnotte/i);
      }
    }
  });

  it("tells the score and the points in the member's language; escapes HTML", () => {
    const fr = renderMailTemplate("match-final", preview("match-final"), { locale: "fr", appUrl: "https://x", dir: DIR });
    expect(fr.subject).toBe("Les Habitués — terminé : Montréal 2–1 Toronto");
    expect(fr.text).toContain("Vos points : 3");
    expect(fill("<p>{league}</p>", { league: "<b>" }, { html: true, allowed: ["league"], name: "t" })).toBe("<p>&lt;b&gt;</p>");
  });
});
