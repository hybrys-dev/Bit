import { describe, expect, it } from "vitest";
import { catalogs, detectLocale, t } from "./i18n.ts";

describe("i18n", () => {
  it("has the same keys in English and Italian", () => {
    expect(Object.keys(catalogs.it).sort()).toEqual(Object.keys(catalogs.en).sort());
  });

  it("detects Italian and falls back to English", () => {
    expect(detectLocale("it-IT")).toBe("it");
    expect(detectLocale("en-US")).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
    expect(t("it", "statusIdle")).toBe("Inattivo");
    expect(t("en", "statusIdle")).toBe("Idle");
  });
});
