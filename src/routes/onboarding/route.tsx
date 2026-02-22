import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingLayout,
});

const STEP_ORDER = [
  { to: "/onboarding/welcome", key: "onboarding.steps.welcome" },
  { to: "/onboarding/monitors", key: "onboarding.steps.monitors" },
  { to: "/onboarding/complete", key: "onboarding.steps.complete" },
] as const;

function OnboardingLayout() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentStep = STEP_ORDER.findIndex((step) => pathname.startsWith(step.to));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("onboarding.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
      </header>

      <ol className="grid grid-cols-3 gap-2">
        {STEP_ORDER.map((step, index) => {
          const isDone = currentStep > index;
          const isActive = currentStep === index;
          return (
            <li key={step.to}>
              <Link
                to={step.to}
                className={cn(
                  "flex items-center justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                  isActive && "border-primary bg-primary/15 text-foreground",
                  isDone && "border-green-600/40 bg-green-600/10 text-foreground",
                  !isDone && !isActive && "border-border bg-surface text-muted-foreground",
                )}
              >
                {t(step.key)}
              </Link>
            </li>
          );
        })}
      </ol>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
