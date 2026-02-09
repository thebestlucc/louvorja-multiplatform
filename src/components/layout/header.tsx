import { useTranslation } from "react-i18next";
import { Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export function Header() {
  const { t } = useTranslation();
  const [clock, setClock] = useState("");

  useEffect(() => {
    function tick() {
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function openCommandPalette() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <button
        onClick={openCommandPalette}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground",
          "hover:bg-surface-hover transition-colors w-64",
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>{t("actions.search")}...</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {clock}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
