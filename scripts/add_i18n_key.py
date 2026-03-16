import json
import os
import argparse

def sort_dict(d):
    if isinstance(d, dict):
        return {k: sort_dict(d[k]) for k in sorted(d.keys())}
    return d

def add_i18n_key(key_path, values, locales_dir="src/locales"):
    languages = ["en", "pt", "es"]
    
    for lang in languages:
        file_path = os.path.join(locales_dir, f"{lang}.json")
        if not os.path.exists(file_path):
            print(f"Warning: {file_path} not found.")
            continue
            
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
    parser = argparse.ArgumentParser(description="Add i18n key to locale files.")
    parser.add_argument("--key", required=True, help="Dot-notation key (e.g. app.name)")
    parser.add_argument("--en", required=True, help="English translation")
    parser.add_argument("--pt", required=True, help="Portuguese translation")
    parser.add_argument("--es", required=True, help="Spanish translation")
    parser.add_argument("--dir", default="src/locales", help="Locales directory")
    
    args = parser.parse_args()
    
    vals = {
        "en": args.en,
        "pt": args.pt,
        "es": args.es
    }
    
    add_i18n_key(args.key, vals, args.dir)
    print(f"Key '{args.key}' added to all locale files and sorted.")
