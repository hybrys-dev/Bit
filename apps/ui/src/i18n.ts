export const locales = ["en", "it"] as const;

export type Locale = (typeof locales)[number];

export const catalogs = {
  en: {
    companionLabel: "Bit",
    statusIdle: "Idle",
  },
  it: {
    companionLabel: "Bit",
    statusIdle: "Inattivo",
  },
} as const;

export type MessageKey = keyof (typeof catalogs)["en"];

export function t(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function detectLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith("it") ? "it" : "en";
}
