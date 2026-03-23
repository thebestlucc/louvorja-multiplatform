import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tag, X } from "lucide-react";
import { Popover, PopoverContent } from "../ui/popover";
import { catcher } from "../../lib/catcher";
import { getPreference, setPreference } from "../../lib/store";
import { cn } from "../../lib/utils";

const STORE_KEY = "serviceCategories";

interface CategoryPickerProps {
  serviceId: number;
  className?: string;
}

export function useCategoryStore() {
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [data] = await catcher(getPreference<Record<number, string>>(STORE_KEY, {}));
      if (!cancelled && data !== null) {
        setCategories(data);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setCategory = useCallback(async (serviceId: number, category: string | null) => {
    setCategories((prev) => {
      const next = { ...prev };
      if (category) {
        next[serviceId] = category;
      } else {
        delete next[serviceId];
      }
      void catcher(setPreference(STORE_KEY, next));
      return next;
    });
  }, []);

  const getCategory = useCallback(
    (serviceId: number): string | null => categories[serviceId] ?? null,
    [categories],
  );

  const getRecentCategories = useCallback((): string[] => {
    const vals = Object.values(categories).filter(Boolean);
    // Deduplicate, most recently added last
    return [...new Set(vals)].slice(-10);
  }, [categories]);

  return { categories, loaded, setCategory, getCategory, getRecentCategories };
}

export function CategoryPicker({ serviceId, className }: CategoryPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { getCategory, setCategory, getRecentCategories } = useCategoryStore();

  const currentCategory = getCategory(serviceId);
  const recentCategories = getRecentCategories();

  const defaultSuggestions = [
    t("services.defaultCategories.sundayService"),
    t("services.defaultCategories.praiseReunion"),
    t("services.defaultCategories.thursdayService"),
    t("services.defaultCategories.retreat"),
    t("services.defaultCategories.conference"),
    t("services.defaultCategories.youthService"),
    t("services.defaultCategories.childrenService"),
  ];

  // All suggestions: recent first, then defaults (deduped)
  const allSuggestions = [...new Set([...recentCategories, ...defaultSuggestions])];
  const filteredSuggestions = inputValue
    ? allSuggestions.filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()))
    : allSuggestions;

  const handleSelect = useCallback(
    (category: string) => {
      void setCategory(serviceId, category);
      setInputValue("");
      setOpen(false);
    },
    [serviceId, setCategory],
  );

  const handleClear = useCallback(() => {
    void setCategory(serviceId, null);
    setInputValue("");
  }, [serviceId, setCategory]);

  const handleConfirm = useCallback(() => {
    if (inputValue.trim()) {
      handleSelect(inputValue.trim());
    }
  }, [inputValue, handleSelect]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          currentCategory
            ? "border-primary/30 bg-primary/8 text-primary hover:bg-primary/15"
            : "border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
          className,
        )}
      >
        <Tag className="h-3 w-3" />
        {currentCategory ?? t("services.categoryPlaceholder")}
        {currentCategory && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-0.5 rounded-full p-0.5 text-primary/60 transition-colors hover:bg-primary/15 hover:text-primary"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </button>

      {open && (
        <PopoverContent className="w-[240px] p-2" onClose={() => setOpen(false)}>
          <input
            ref={inputRef}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={t("services.category")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="mt-2 max-h-[200px] overflow-auto">
            {recentCategories.length > 0 && !inputValue && (
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {t("services.categoryRecent")}
              </div>
            )}
            {filteredSuggestions.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSelect(suggestion)}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover",
                      suggestion === currentCategory
                        ? "font-semibold text-primary"
                        : "text-foreground",
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground/60">
                {t("services.categorySuggestions")}
              </p>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

/** Read-only badge for service cards */
export function CategoryBadge({ serviceId }: { serviceId: number }) {
  const { getCategory, loaded } = useCategoryStore();
  const category = getCategory(serviceId);

  if (!loaded || !category) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
      {category}
    </span>
  );
}
