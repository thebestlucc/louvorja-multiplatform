import { useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

const FORGET_HOLD_MS = 1000;

export default function SettingsRoute() {
  const { t } = useTranslation();
  const device = useConnectionStore((s) => s.device);
  const wsState = useConnectionStore((s) => s.wsState);
  const forgetDevice = useConnectionStore((s) => s.forgetDevice);

  const forgetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const startForget = useCallback(() => {
    forgetTimerRef.current = setTimeout(() => {
      forgetDevice();
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
      {/* Connection section */}
      <Section title={t("remote.settings.connection_section")}>
        <Row
          label={t("remote.settings.server_name")}
          value={device?.name ?? "—"}
        />
        <Row
          label="Host"
          value={device ? `${device.host}:${device.port}` : "—"}
        />
        <Row
          label="Status"
          value={wsState}
        />
      </Section>

      {/* Appearance section */}
      <Section title={t("remote.settings.appearance")}>
        <div className="px-4 py-3">
          <p className="text-sm text-fg-muted">Theme and display preferences coming in Phase H.</p>
        </div>
      </Section>

      {/* About section */}
      <Section title={t("remote.settings.about_section")}>
        <Row label={t("remote.settings.version")} value="0.1.0" />
      </Section>

      {/* Danger zone */}
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
        <p className="text-center text-xs text-fg-muted mt-2">Hold for 1 second to confirm</p>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

