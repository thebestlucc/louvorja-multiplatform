export const THEMES = ["azure", "white", "gray", "orange", "black"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = ["pt", "es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const ASPECT_RATIOS = ["free", "4:3", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const DEFAULT_THEME: Theme = "azure";
export const DEFAULT_LANGUAGE: Language = "pt";
