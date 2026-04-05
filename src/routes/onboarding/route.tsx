import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingLayout,
});

const STEP_ORDER = [
  { to: "/onboarding/welcome", key: "onboarding.steps.welcome" },
  { to: "/onboarding/setup", key: "onboarding.steps.setup" },
  { to: "/onboarding/content", key: "onboarding.steps.content" },
  { to: "/onboarding/monitors", key: "onboarding.steps.monitors" },
  { to: "/onboarding/ready", key: "onboarding.steps.ready" },
] as const;

function OnboardingLayout() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentStep = STEP_ORDER.findIndex((step) => pathname.startsWith(step.to));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Stepper header — uses a 9-column grid: circle, line, circle, line, ... circle */}
      <header className="mx-auto w-full max-w-3xl px-4 pt-8 pb-2 space-y-1.5">
        <div className="grid items-center" style={{ gridTemplateColumns: "auto 1fr auto 1fr auto 1fr auto 1fr auto" }}>
          {STEP_ORDER.map((step, index) => {
            const isDone = currentStep > index;
            const isActive = currentStep === index;
            return (
              <div key={step.to} className="contents">
                {/* Circle */}
                <div className="flex justify-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                      isDone && "border-green-500 bg-green-500 text-white",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      !isDone && !isActive && "border-border bg-surface text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                </div>
                {/* Connector line */}
                {index < STEP_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 h-0.5 transition-colors",
                      currentStep > index ? "bg-green-500" : "bg-border",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        {/* Labels — same 9-column grid, labels span the circle columns */}
        <div className="grid" style={{ gridTemplateColumns: "auto 1fr auto 1fr auto 1fr auto 1fr auto" }}>
          {STEP_ORDER.map((step, index) => {
            const isDone = currentStep > index;
            const isActive = currentStep === index;
            const col = index * 2 + 1; // columns 1, 3, 5, 7, 9
            return (
              <span
                key={step.to}
                className={cn(
                  "text-center text-[11px] font-medium",
                  isActive && "text-foreground",
                  isDone && "text-green-600",
                  !isDone && !isActive && "text-muted-foreground",
                )}
                style={{ gridColumn: col }}
              >
                {t(step.key)}
              </span>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
