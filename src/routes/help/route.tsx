import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle, Keyboard, LifeBuoy, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { GuidedTour } from "../../components/help/guided-tour";
import { openKeyboardShortcutsPanel } from "../../components/utilities/keyboard-shortcuts-panel";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { resetAllTours } from "../../lib/tour";

export const Route = createFileRoute("/help")({
  component: HelpRoutePage,
});

function HelpRoutePage() {
  const { t } = useTranslation();

  async function handleResetTours() {
    await resetAllTours();
    toast.success(t("help.toursReset"));
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {t("help.title")}
          </CardTitle>
          <CardDescription>{t("help.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={openKeyboardShortcutsPanel}>
              <Keyboard className="mr-2 h-4 w-4" />
              {t("help.openShortcuts")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                document.getElementById("help-documentation")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              <LifeBuoy className="mr-2 h-4 w-4" />
              {t("help.openDocs")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleResetTours()}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("help.restartTours")}
            </Button>
          </div>
          <div id="help-documentation" className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("help.documentationTitle")}</p>
            <p className="mt-1">docs/USER_GUIDE.md</p>
            <p>docs/MIGRATION_GUIDE.md</p>
          </div>
          <GuidedTour />
        </CardContent>
      </Card>
    </section>
  );
}
