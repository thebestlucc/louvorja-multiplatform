import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const TOUR_KEY = "help.guidedTourSeen";

export function GuidedTour() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(() => localStorage.getItem(TOUR_KEY) === "true");

  const steps = useMemo(
    () => [
      {
        title: t("help.tour.steps.library.title"),
        description: t("help.tour.steps.library.description"),
      },
      {
        title: t("help.tour.steps.projection.title"),
        description: t("help.tour.steps.projection.description"),
      },
      {
        title: t("help.tour.steps.utilities.title"),
        description: t("help.tour.steps.utilities.description"),
      },
      {
        title: t("help.tour.steps.streaming.title"),
        description: t("help.tour.steps.streaming.description"),
      },
    ],
    [t],
  );

  if (closed) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          localStorage.removeItem(TOUR_KEY);
          setClosed(false);
          setStep(0);
        }}
      >
        {t("help.tour.restart")}
      </Button>
    );
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("help.tour.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-foreground">{current.title}</p>
        <p className="text-sm text-muted-foreground">{current.description}</p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {step + 1}/{steps.length}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
              disabled={step === 0}
            >
              {t("help.tour.previous")}
            </Button>
            {isLast ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  localStorage.setItem(TOUR_KEY, "true");
                  setClosed(true);
                }}
              >
                {t("help.tour.finish")}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setStep((currentStep) => currentStep + 1)}>
                {t("help.tour.next")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
