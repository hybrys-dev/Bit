import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CompanionPlaceholder } from "./CompanionPlaceholder.tsx";
import { detectLocale } from "./i18n.ts";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element is missing");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

createRoot(root).render(
  <StrictMode>
    <CompanionPlaceholder locale={detectLocale(navigator.language)} reducedMotion={reducedMotion} />
  </StrictMode>,
);
