import { useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Moon, Sun, SunMoon, Trash2 } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { usePreferencesStore, type Theme } from "@/stores/preferences-store";
import { cn } from "@/lib/utils";
import { setLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n";

const FORGET_HOLD_MS = 1000;
const APP_VERSION = "0.1.0";

export default function SettingsRoute() {
  const { t, i18n } = useTranslation();
  const device = useConnectionStore((s) => s.device);
  const wsState = useConnectionStore((s) => s.wsState);
  const forgetDevice = useConnectionStore((s) => s.forgetDevice);

  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const wakeLock = usePreferencesStore((s) => s.wakeLock);
  const setWakeLock = usePreferencesStore((s) => s.setWakeLock);
  const haptics = usePreferencesStore((s) => s.haptics);
  const setHaptics = usePreferencesStore((s) => s.setHaptics);

  const forgetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const startForget = useCallback(() => {
    if (forgetTimerRef.current !== undefined) return;
    forgetTimerRef.current = setTimeout(() => {
      forgetDevice();
      forgetTimerRef.current = undefined;
    }, FORGET_HOLD_MS);
  }, [forgetDevice]);

  const cancelForget = useCallback(() => {
    if (forgetTimerRef.current !== undefined) {
      clearTimeout(forgetTimerRef.current);
      forgetTimerRef.current = undefined;
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Connection ─────────────────────────────────────────────────────── */}
      <Section title={t("remote.settings.connection_section")}>
        <Row label={t("remote.settings.server_name")} value={device?.name ?? "—"} />
        <Row label={t("remote.settings.host")} value={device ? `${device.host}:${device.port}` : "—"} />
        {(() => {
          const statusLabel = wsState === "connected"
            ? t("remote.connection.connected")
            : wsState === "reconnecting"
              ? t("remote.connection.reconnecting")
              : t("remote.connection.offline");
          return <Row label={t("remote.settings.status")} value={statusLabel} />;
        })()}
      </Section>

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <Section title={t("remote.settings.appearance")}>
        <div className="px-4 py-3">
          <span className="text-sm text-fg">{t("remote.settings.theme")}</span>
          <div className="flex gap-2 mt-2" role="group" aria-label={t("remote.settings.theme")}>
            <ThemeChip
              active={theme === "light"}
              icon={<Sun className="h-3.5 w-3.5" aria-hidden="true" />}
              label={t("remote.settings.theme_light")}
              onClick={() => setTheme("light")}
            />
            <ThemeChip
              active={theme === "dark"}
              icon={<Moon className="h-3.5 w-3.5" aria-hidden="true" />}
              label={t("remote.settings.theme_dark")}
              onClick={() => setTheme("dark")}
            />
            <ThemeChip
              active={theme === "system"}
              icon={<SunMoon className="h-3.5 w-3.5" aria-hidden="true" />}
              label={t("remote.settings.theme_auto")}
              onClick={() => setTheme("system" as Theme)}
            />
          </div>
        </div>
      </Section>

      {/* ── Behavior ───────────────────────────────────────────────────────── */}
      <Section title={t("remote.settings.behavior_section")}>
        <ToggleRow
          label={t("remote.settings.wake_lock")}
          hint={t("remote.settings.wake_lock_hint")}
          checked={wakeLock}
          onChange={setWakeLock}
          id="pref-wake-lock"
        />
        <ToggleRow
          label={t("remote.settings.haptics")}
          hint={t("remote.settings.haptics_hint")}
          checked={haptics}
          onChange={setHaptics}
          id="pref-haptics"
        />
      </Section>

      {/* ── Language ──────────────────────────────────────────────────────── */}
      <Section title={t("remote.settings.language_section")}>
        <div className="px-4 py-3">
          <div className="flex gap-2 flex-wrap" role="group" aria-label={t("remote.settings.language")}>
            {SUPPORTED_LANGUAGES.map(({ code, label }) => (
              <LanguageChip
                key={code}
                code={code}
                label={label}
                active={i18n.language === code}
                onClick={() => setLanguage(code)}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ── About ──────────────────────────────────────────────────────────── */}
      <Section title={t("remote.settings.about_section")}>
        <Row label={t("remote.settings.app_name")} value={t("remote.title")} />
        <Row label={t("remote.settings.version")} value={APP_VERSION} />
        <a
          href="https://louvorja.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center justify-between px-4 py-3",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
          aria-label={t("remote.settings.desktop_link")}
        >
          <span className="text-sm text-fg">{t("remote.settings.desktop_link")}</span>
          <ExternalLink className="h-4 w-4 text-fg-muted" aria-hidden="true" />
        </a>
      </Section>

      {/* ── Danger zone ────────────────────────────────────────────────────── */}
      <div className="px-4 py-6 mt-auto">
        <button
          type="button"
          aria-label={t("remote.settings.forget_device")}
          onPointerDown={startForget}
          onPointerUp={cancelForget}
          onPointerLeave={cancelForget}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-12 rounded-lg",
            "border border-destructive/30 bg-destructive/5 text-destructive text-sm font-medium",
            "active:scale-[0.98] transition-transform select-none touch-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive",
          )}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t("remote.settings.forget_device")}
        </button>
        <p className="text-center text-xs text-fg-muted mt-2">
          {t("remote.settings.forget_device_hint")}
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-2">
      <h3 className="px-4 py-2 text-xs font-semibold text-fg-muted uppercase tracking-wide">
        {title}
      </h3>
      <div className="border-t border-b border-border divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-fg">{label}</span>
      <span className="text-sm text-fg-muted">{value}</span>
    </div>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ id, label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
    >
      <span className="flex-1 min-w-0 mr-3">
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="block text-xs text-fg-muted mt-0.5">{hint}</span>}
      </span>
      {/* Native checkbox styled as a toggle */}
      <div className="relative flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div
          aria-hidden="true"
          className={cn(
            "w-11 h-6 rounded-full transition-colors duration-200",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1",
            checked ? "bg-primary" : "bg-surface-3",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </div>
    </label>
  );
}

interface ThemeChipProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ThemeChip({ active, icon, label, onClick }: ThemeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-2 text-fg-muted hover:bg-surface-3",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface LanguageChipProps {
  code: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function LanguageChip({ code, label, active, onClick }: LanguageChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      lang={code}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-2 text-fg-muted hover:bg-surface-3",
      )}
    >
      {label}
    </button>
  );
}
