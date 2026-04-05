import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tag, X, Plus } from "lucide-react";
import { Popover, PopoverContent } from "../ui/popover";
import { catcher } from "../../lib/catcher";
import { getPreference, setPreference } from "../../lib/store";
import { cn } from "../../lib/utils";

const STORE_KEY = "serviceCategories";
const RECENT_KEY = "serviceCategoriesRecent";

interface CategoryPickerProps {
  serviceId: number;
  className?: string;
}

export function useCategoryStore() {
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [data] = await catcher(getPreference<Record<number, string>>(STORE_KEY, {}));
      const [recent] = await catcher(getPreference<string[]>(RECENT_KEY, []));
      if (!cancelled) {
        if (data !== null) setCategories(data);
        if (recent !== null) setRecentNames(recent);
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
    if (category) {
      setRecentNames((prev) => {
        const filtered = prev.filter((n) => n !== category);
        const next = [...filtered, category].slice(-20);
        void catcher(setPreference(RECENT_KEY, next));
        return next;
      });
    }
  }, []);

  const removeRecentCategory = useCallback((name: string) => {
    setRecentNames((prev) => {
      const next = prev.filter((n) => n !== name);
      void catcher(setPreference(RECENT_KEY, next));
      return next;
    });
  }, []);

  const getCategory = useCallback(
    (serviceId: number): string | null => categories[serviceId] ?? null,
    [categories],
  );

  const getRecentCategories = useCallback((): string[] => {
    return [...recentNames].reverse().slice(0, 10);
  }, [recentNames]);

  return { categories, loaded, setCategory, getCategory, getRecentCategories, removeRecentCategory };
}

export function CategoryPicker({ serviceId, className }: CategoryPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { getCategory, setCategory, getRecentCategories, removeRecentCategory } = useCategoryStore();

  const currentCategory = getCategory(serviceId);
  const recentCategories = getRecentCategories();

  const filteredSuggestions = inputValue
    ? recentCategories.filter((s) => s.toLowerCase().includes(inputValue.toLowerCase()))
    : recentCategories;

  // Show "Create" option when typed value doesn't exactly match any suggestion
  const trimmedInput = inputValue.trim();
  const showCreateOption = trimmedInput.length > 0 &&
    !recentCategories.some((s) => s.toLowerCase() === trimmedInput.toLowerCase());

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
        <PopoverContent className="w-60 p-2" onClose={() => setOpen(false)}>
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
          <div className="mt-2 max-h-50 overflow-auto">
            {recentCategories.length > 0 && !inputValue && (
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {t("services.categoryRecent")}
              </div>
            )}
            {filteredSuggestions.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {filteredSuggestions.map((suggestion) => (
                  <div
                    key={suggestion}
                    className="group flex items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(suggestion)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover",
                        suggestion === currentCategory
                          ? "font-semibold text-primary"
                          : "text-foreground",
                      )}
                    >
                      {suggestion}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentCategory(suggestion);
                      }}
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : !showCreateOption ? (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground/60">
                {t("services.categorySuggestions")}
              </p>
            ) : null}
            {showCreateOption && (
              <button
                type="button"
                onClick={() => handleSelect(trimmedInput)}
                className="mt-1 flex w-full items-center gap-1.5 rounded-md border border-dashed border-primary/30 px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" />
                {t("services.createCategory", { name: trimmedInput })}
              </button>
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
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
      {category}
    </span>
  );
}
