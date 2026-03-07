import json
import os

def sort_dict(d):
    if isinstance(d, dict):
        return {k: sort_dict(d[k]) for k in sorted(d.keys())}
    return d

def add_i18n_key(key_path, values):
    locales_dir = "src/locales"
    languages = ["en", "pt", "es"]
    
    for lang in languages:
        file_path = os.path.join(locales_dir, f"{lang}.json")
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Add the key
        parts = key_path.split(".")
        current = data
        for i, part in enumerate(parts[:-1]):
            if part not in current:
                current[part] = {}
            current = current[part]
        
        current[parts[-1]] = values[lang]
        
        # Sort
        sorted_data = sort_dict(data)
        
        # Write back
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sorted_data, f, ensure_ascii=False, indent=2)
            f.write("\n")

if __name__ == "__main__":
    key = "commandPalette.songs"
    vals = {
        "en": "Songs",
        "pt": "Músicas",
        "es": "Canciones"
    }
    add_i18n_key(key, vals)
    print(f"Key '{key}' added to all locale files and sorted.")
