import type { MonitorInfo } from "../types/settings";

const KNOWN_BRANDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(apple|retina|studio display|color lcd|built-?in)\b/i, label: "Apple" },
  { pattern: /\bdell\b/i, label: "Dell" },
  { pattern: /\blg\b/i, label: "LG" },
  { pattern: /\bsamsung\b/i, label: "Samsung" },
  { pattern: /\basus\b/i, label: "ASUS" },
  { pattern: /\bacer\b/i, label: "Acer" },
  { pattern: /\baoc\b/i, label: "AOC" },
  { pattern: /\bbenq\b/i, label: "BenQ" },
  { pattern: /\bmsi\b/i, label: "MSI" },
  { pattern: /\bphilips\b/i, label: "Philips" },
  { pattern: /\bhp\b/i, label: "HP" },
  { pattern: /\blenovo\b/i, label: "Lenovo" },
  { pattern: /\bgigabyte\b/i, label: "Gigabyte" },
  { pattern: /\bviewsonic\b/i, label: "ViewSonic" },
  { pattern: /\bsony\b/i, label: "Sony" },
];

const SYNTHETIC_NAME_PATTERNS = [
  /^monitor\s*#?\s*(\d+|[a-f0-9-]{6,})$/i,
  /^monitor[-\s_#]*(\d+|[a-f0-9]{6,})$/i,
  /^display[-\s_#]*(\d+|[a-f0-9]{6,})$/i,
  /^(hdmi|dp|dvi|vga|edp|displayport)[-\s_]*\d+$/i,
  /^generic pnp monitor$/i,
  /^unknown(\s+display)?$/i,
];

export function getPreferredMonitorName(monitor: MonitorInfo, fallbackIndex: number): string {
  const modelName = monitor.model?.trim() || "";
  if (monitor.manufacturer && modelName) {
    if (modelName.toLowerCase().includes(monitor.manufacturer.toLowerCase())) {
      return modelName;
    }
    return `${monitor.manufacturer} ${modelName}`;
  }

  if (monitor.manufacturer && !modelName) {
    return monitor.manufacturer;
  }

  const monitorName = (monitor.friendly_name || monitor.name).trim();
  if (!looksLikeSyntheticName(monitorName)) {
    const brandModel = extractMonitorBrandModel(monitorName);
    if (brandModel) {
      return brandModel;
    }
    if (monitorName.length > 0) {
      return monitorName;
    }
  }

  return `Monitor ${fallbackIndex + 1}`;
}

function looksLikeSyntheticName(name: string): boolean {
  if (!name) {
    return true;
  }

  return SYNTHETIC_NAME_PATTERNS.some((pattern) => pattern.test(name.trim()));
}

function extractMonitorBrandModel(name: string): string | null {
  if (!name || looksLikeSyntheticName(name)) {
    return null;
  }

  const knownBrand = KNOWN_BRANDS.find(({ pattern }) => pattern.test(name));
  if (knownBrand) {
    if (knownBrand.label === "Apple") {
      if (/studio\s*display/i.test(name)) {
        return "Apple Studio Display";
      }
      if (/(retina|color lcd|built-?in)/i.test(name)) {
        return "Apple Built-in Display";
      }
      return "Apple";
    }

    const model = name
      .replace(knownBrand.pattern, " ")
      .replace(/\bmonitor\b/i, " ")
      .replace(/\s+/g, " ")
      .trim();
    return model.length > 0 ? `${knownBrand.label} ${model}` : knownBrand.label;
  }

  const firstToken = name.split(/\s+/)[0];
  if (!firstToken || /^monitor$/i.test(firstToken) || looksLikeSyntheticName(firstToken)) {
    return null;
  }
  if (/^[A-Za-z][A-Za-z0-9-]{1,24}$/.test(firstToken)) {
    return firstToken === firstToken.toUpperCase()
      ? firstToken
      : `${firstToken.charAt(0).toUpperCase()}${firstToken.slice(1)}`;
  }

  return null;
}
