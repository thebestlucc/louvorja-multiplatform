---
feature: installers-pipeline
gate: 8
phase: B - Safe Updates
date: 2026-02-18
---

# Phase B Subtasks: Safe Updates (UX)

## TASK-010: Add i18n keys (do this FIRST — blocks TASK-007/008/009)

### ST-010-1: Add English updater keys (3 min)
**File:** `src/locales/en.json`
**Location:** Inside `"updater"` object (lines 630-636)
**Action:** Add after existing keys:
```json
"guardActive": "Update available — will notify after service",
"errorNetwork": "Could not download the update",
"errorNetworkWhy": "Your internet connection may be unstable.",
"errorNetworkAction": "Check your connection and try again.",
"errorDiskSpace": "Could not install the update",
"errorDiskSpaceWhy": "There is not enough disk space available.",
"errorDiskSpaceAction": "Free up some disk space and try again.",
"errorPermission": "Could not install the update",
"errorPermissionWhy": "The app needs permission to write files.",
"errorPermissionAction": "Try running as administrator, or contact your IT administrator.",
"errorGeneric": "Something went wrong with the update",
"errorGenericWhy": "An unexpected error occurred.",
"errorGenericAction": "Try again later, or download the latest version from our website.",
"errorDataSafe": "Your data and settings are safe.",
"tryAgain": "Try again"
```

### ST-010-2: Add Portuguese updater keys (5 min)
**File:** `src/locales/pt.json`
**Location:** Inside `"updater"` object
**Action:** Add Portuguese translations:
```json
"guardActive": "Atualização disponível — será notificado após o culto",
"errorNetwork": "Não foi possível baixar a atualização",
"errorNetworkWhy": "Sua conexão com a internet pode estar instável.",
"errorNetworkAction": "Verifique sua conexão e tente novamente.",
"errorDiskSpace": "Não foi possível instalar a atualização",
"errorDiskSpaceWhy": "Não há espaço em disco suficiente.",
"errorDiskSpaceAction": "Libere espaço no disco e tente novamente.",
"errorPermission": "Não foi possível instalar a atualização",
"errorPermissionWhy": "O aplicativo precisa de permissão para gravar arquivos.",
"errorPermissionAction": "Tente executar como administrador ou entre em contato com o responsável de TI.",
"errorGeneric": "Algo deu errado com a atualização",
"errorGenericWhy": "Ocorreu um erro inesperado.",
"errorGenericAction": "Tente novamente mais tarde ou baixe a versão mais recente do nosso site.",
"errorDataSafe": "Seus dados e configurações estão seguros.",
"tryAgain": "Tentar novamente"
```

### ST-010-3: Add Spanish updater keys (5 min)
**File:** `src/locales/es.json`
**Location:** Inside `"updater"` object
**Action:** Add Spanish translations:
```json
"guardActive": "Actualización disponible — se notificará después del servicio",
"errorNetwork": "No se pudo descargar la actualización",
"errorNetworkWhy": "Su conexión a internet puede ser inestable.",
"errorNetworkAction": "Verifique su conexión e intente de nuevo.",
"errorDiskSpace": "No se pudo instalar la actualización",
"errorDiskSpaceWhy": "No hay suficiente espacio en disco.",
"errorDiskSpaceAction": "Libere espacio en disco e intente de nuevo.",
"errorPermission": "No se pudo instalar la actualización",
"errorPermissionWhy": "La aplicación necesita permiso para escribir archivos.",
"errorPermissionAction": "Intente ejecutar como administrador o contacte al administrador de TI.",
"errorGeneric": "Algo salió mal con la actualización",
"errorGenericWhy": "Ocurrió un error inesperado.",
"errorGenericAction": "Intente de nuevo más tarde o descargue la versión más reciente de nuestro sitio web.",
"errorDataSafe": "Sus datos y configuraciones están seguros.",
"tryAgain": "Intentar de nuevo"
```

---

## TASK-008: Implement pastoral error messaging

### ST-008-1: Create error classifier utility (5 min)
**File:** `src/lib/update-errors.ts` (new file)
**Action:** Create:
```typescript
import type { TFunction } from "i18next";

export type UpdateErrorCategory = "network" | "disk_space" | "permission" | "generic";

interface PastoralError {
  titleKey: string;
  whyKey: string;
  actionKey: string;
  reassuranceKey: string;
}

const CATEGORY_PATTERNS: Record<UpdateErrorCategory, RegExp> = {
  network: /network|connection|timeout|dns|fetch/i,
  disk_space: /space|disk|enospc|storage/i,
  permission: /permission|access|eacces|denied/i,
  generic: /.*/, // fallback, always matches
};

const CATEGORY_KEYS: Record<UpdateErrorCategory, PastoralError> = {
  network: { titleKey: "updater.errorNetwork", whyKey: "updater.errorNetworkWhy", actionKey: "updater.errorNetworkAction", reassuranceKey: "updater.errorDataSafe" },
  disk_space: { titleKey: "updater.errorDiskSpace", whyKey: "updater.errorDiskSpaceWhy", actionKey: "updater.errorDiskSpaceAction", reassuranceKey: "updater.errorDataSafe" },
  permission: { titleKey: "updater.errorPermission", whyKey: "updater.errorPermissionWhy", actionKey: "updater.errorPermissionAction", reassuranceKey: "updater.errorDataSafe" },
  generic: { titleKey: "updater.errorGeneric", whyKey: "updater.errorGenericWhy", actionKey: "updater.errorGenericAction", reassuranceKey: "updater.errorDataSafe" },
};

export function classifyUpdateError(error: unknown): PastoralError {
  const msg = String(error);
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(msg)) return CATEGORY_KEYS[category as UpdateErrorCategory];
  }
  return CATEGORY_KEYS.generic;
}
```
**Verify:** File compiles with `npx tsc --noEmit`.

### ST-008-2: Replace raw error toast in update-notification (3 min)
**File:** `src/components/update-notification.tsx`
**Line:** 58-66 (catch block)
**Action:** Import `classifyUpdateError` and replace `toast.error(String(error))` with:
```typescript
const pastoral = classifyUpdateError(error);
toast.error(t(pastoral.titleKey), {
  description: `${t(pastoral.whyKey)} ${t(pastoral.actionKey)}\n\n${t(pastoral.reassuranceKey)}`,
  duration: Infinity,
});
```
**Verify:** Error toasts show structured messages, don't auto-dismiss.

---

## TASK-007: Implement service-aware update guard

### ST-007-1: Add guard state and store subscription (5 min)
**File:** `src/components/update-notification.tsx`
**Location:** Inside the component, after existing state declarations
**Action:** Add:
```typescript
const [pendingUpdate, setPendingUpdate] = useState(false);
const [guardActive, setGuardActive] = useState(false);

// Subscribe to presentation store for guard conditions
useEffect(() => {
  const unsub = usePresentationStore.subscribe((state) => {
    const active = state.isProjectorOpen || state.isPlayingService || state.activeServiceId !== null;
    setGuardActive(active);
  });
  // Set initial value
  const initial = usePresentationStore.getState();
  setGuardActive(initial.isProjectorOpen || initial.isPlayingService || initial.activeServiceId !== null);
  return unsub;
}, []);
```
**Verify:** `guardActive` updates when projector opens/closes.

### ST-007-2: Gate notification visibility on guard (3 min)
**File:** `src/components/update-notification.tsx`
**Location:** The render/return section
**Action:** Wrap the notification banner JSX with guard condition:
- If `updateInfo && guardActive && !dismissed && !skipped`: set `pendingUpdate = true`, render `null` (banner hidden)
- If `updateInfo && !guardActive && !dismissed && !skipped`: show banner (existing behavior)
- When `guardActive` transitions from true→false and `pendingUpdate` is true: show banner
**Verify:** Banner hides when projector is open, reappears when closed.

### ST-007-3: Preserve dismissed/skipped across guard transitions (2 min)
**File:** `src/components/update-notification.tsx`
**Action:** Ensure that if user dismissed the banner before guard activated, the banner does NOT reappear when guard releases. Check `dismissed` and `skippedVersion` state before showing deferred notification.
**Verify:** Dismiss → open projector → close projector → banner stays dismissed.

---

## TASK-009: Add status bar update indicator

### ST-009-1: Create StatusBarUpdateIndicator component (5 min)
**File:** `src/components/layout/status-bar-update-indicator.tsx` (new file)
**Action:** Create component following existing status bar indicator pattern (timer/streaming buttons):
```typescript
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  visible: boolean;
}

export function StatusBarUpdateIndicator({ visible }: Props) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground"
          aria-label={t("updater.guardActive")}
        >
          <Download className="h-3 w-3" />
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t("updater.guardActive")}</TooltipContent>
    </Tooltip>
  );
}
```
**Verify:** Component renders small icon + dot with tooltip.

### ST-009-2: Integrate indicator in status bar (3 min)
**File:** `src/components/layout/status-bar.tsx`
**Line:** After `<ProjectorControls />` (~line 55)
**Action:** Import and render `<StatusBarUpdateIndicator visible={...} />`. The `visible` prop needs to come from a shared state — either lift from UpdateNotification or use a small Zustand slice. Simplest: export `pendingUpdate && guardActive` from the update notification via a tiny store or context.
**Verify:** Green dot appears in status bar when update is deferred during projection.

---

## Phase B Verification Checklist

After all Phase B subtasks:
- [ ] Open projector → update notification does NOT appear
- [ ] Status bar shows download icon + green dot
- [ ] Close projector → notification banner appears
- [ ] Click "Update now" → if error, pastoral toast appears in current language
- [ ] Error toast does not auto-dismiss
- [ ] Error toast shows: what happened, why, what to do, "your data is safe"
- [ ] All 15 new i18n keys present in en.json, pt.json, es.json
- [ ] Run `pnpm vite build && npx tsc --noEmit` — passes
