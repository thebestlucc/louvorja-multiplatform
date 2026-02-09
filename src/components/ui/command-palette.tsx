import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Home,
  Music,
  BookOpen,
  Presentation,
  ListChecks,
  Wrench,
  Settings,
} from "lucide-react";
import { cn } from "../../lib/utils";

const routes = [
  { path: "/", icon: Home, key: "nav.home" },
  { path: "/hymnal", icon: Music, key: "nav.hymnal" },
  { path: "/bible", icon: BookOpen, key: "nav.bible" },
  { path: "/presentations", icon: Presentation, key: "nav.presentations" },
  { path: "/services", icon: ListChecks, key: "nav.services" },
  { path: "/utilities", icon: Wrench, key: "nav.utilities" },
  { path: "/settings", icon: Settings, key: "nav.settings" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("commandPalette.placeholder")}
      className={cn(
        "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
        "w-full max-w-lg rounded-lg border border-border bg-surface shadow-2xl",
      )}
    >
      <Command.Input
        placeholder={t("commandPalette.placeholder")}
        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-72 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          {t("commandPalette.noResults")}
        </Command.Empty>
        {routes.map((route) => (
          <Command.Item
            key={route.path}
            value={t(route.key)}
            onSelect={() => {
              navigate({ to: route.path });
              setOpen(false);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
          >
            <route.icon className="h-4 w-4 text-muted-foreground" />
            {t(route.key)}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
