import { t, type Locale } from "./i18n.ts";

export function CompanionPlaceholder({ locale, reducedMotion }: { locale: Locale; reducedMotion: boolean }) {
  const label = t(locale, "companionLabel");
  const status = t(locale, "statusIdle");
  return (
    <button type="button" className={reducedMotion ? "companion" : "companion companion-alive"} aria-label={`${label}. ${status}`}>
      {status}
    </button>
  );
}
