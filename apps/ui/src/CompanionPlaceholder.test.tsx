import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompanionPlaceholder } from "./CompanionPlaceholder.tsx";

describe("CompanionPlaceholder", () => {
  it("renders a labelled control and skips motion when asked", () => {
    const html = renderToStaticMarkup(<CompanionPlaceholder locale="it" reducedMotion />);
    expect(html).toContain("Inattivo");
    expect(html).toContain("aria-label");
    expect(html).not.toContain("companion-alive");
  });

  it("marks the idle placeholder as alive when motion is allowed", () => {
    const html = renderToStaticMarkup(<CompanionPlaceholder locale="en" reducedMotion={false} />);
    expect(html).toContain("Idle");
    expect(html).toContain("companion-alive");
  });
});
