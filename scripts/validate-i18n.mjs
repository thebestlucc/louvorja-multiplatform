import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "../src/locales");
const LANGUAGES = ["en", "pt", "es"];

function getDeepKeys(obj, prefix = "") {
  return Object.keys(obj).reduce((res, el) => {
    if (typeof obj[el] === "object" && obj[el] !== null && !Array.isArray(obj[el])) {
      return [...res, ...getDeepKeys(obj[el], prefix + el + ".")];
    }
    return [...res, prefix + el];
  }, []);
}

function validate() {
  console.log("Checking i18n keys for consistency...");
  
  const results = LANGUAGES.map(lang => {
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return { lang, keys: getDeepKeys(content) };
    } catch (e) {
      console.error(`Error reading ${lang}.json:`, e.message);
      process.exit(1);
    }
  });

  const allKeys = new Set(results.flatMap(r => r.keys));
  let hasErrors = false;

  results.forEach(r => {
    const missing = [...allKeys].filter(k => !r.keys.includes(k));
    const extra = r.keys.filter(k => ![...allKeys].every(rk => r.lang === r.lang || results.find(res => res.lang === "en").keys.includes(k)));
    
    // We mainly care if a key exists in one but not the others
    const otherLangs = results.filter(other => other.lang !== r.lang);
    const trulyMissing = missing.filter(k => otherLangs.some(other => other.keys.includes(k)));

    if (trulyMissing.length > 0) {
      console.error(`\n❌ [${r.lang}] Missing keys:`);
      trulyMissing.forEach(k => console.error(`   - ${k}`));
      hasErrors = true;
    }
  });

  if (!hasErrors) {
    console.log("\n✅ All locale files are in sync!");
  } else {
    process.exit(1);
  }
}

validate();
