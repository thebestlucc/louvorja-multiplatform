import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Send, XCircle, Type, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import { useOverlayState, useSetAlert, useClearAlert } from "../../lib/queries";
import { catcher } from "../../lib/catcher";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/utilities/interactive-text")({
  component: InteractiveTextPage,
});

function InteractiveTextPage() {
  const { t } = useTranslation();
  const { data: overlayState } = useOverlayState();
  const setAlertMutation = useSetAlert();
  const clearAlertMutation = useClearAlert();

  const [text, setText] = useState("");
  const [isTicker, setIsTicker] = useState(false);

  const currentAlert = overlayState?.alert;
  const isActive = currentAlert?.isVisible && currentAlert?.text;

  // Sync local state when an alert is already active
  useEffect(() => {
    if (currentAlert?.isVisible) {
      setText(currentAlert.text);
      setIsTicker(currentAlert.isTicker);
    }
  }, [currentAlert]);

  const handleProject = async () => {
    if (!text.trim()) return;
    await catcher(
      setAlertMutation.mutateAsync({ text: text.trim(), isTicker }),
      { notify: true }
    );
  };

  const handleClear = async () => {
    await catcher(clearAlertMutation.mutateAsync(), { notify: true });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("interactiveText.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("utilities.interactiveText.description", "Project temporary messages or scrolling tickers over any screen.")}
          </p>
        </div>
        {isActive && (
          <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1 animate-pulse">
            <Activity className="h-3.5 w-3.5" />
            {t("interactiveText.live")}
          </Badge>
        )}
      </div>

      <div className="grid gap-6">
        <Card className={cn("transition-colors duration-300", isActive && "border-destructive/50 bg-destructive/5")}>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              {t("interactiveText.displayMode")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 p-1 rounded-lg border bg-muted/20 w-fit">
              <Button
                variant={!isTicker ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsTicker(false)}
                className="px-6"
              >
                {t("interactiveText.static")}
              </Button>
              <Button
                variant={isTicker ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsTicker(true)}
                className="px-6"
              >
                {t("interactiveText.ticker")}
              </Button>
            </div>

            <div className="space-y-3">
              <Textarea
                placeholder={t("interactiveText.placeholder")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-32 text-lg resize-none focus-visible:ring-destructive"
              />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {isActive ? t("interactiveText.status") : ""}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                size="lg"
                className="flex-1 gap-2 shadow-lg shadow-primary/20"
                onClick={handleProject}
                disabled={!text.trim() || setAlertMutation.isPending}
              >
                <Send className="h-4 w-4" />
                {t("interactiveText.project")}
              </Button>
              
              {isActive && (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClear}
                  disabled={clearAlertMutation.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  {t("interactiveText.clear")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isActive && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-destructive uppercase tracking-widest flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {t("interactiveText.status")}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {currentAlert?.isTicker ? "MODE: TICKER" : "MODE: STATIC"}
              </span>
            </div>
            <div className="bg-background/50 rounded border p-3 min-h-12 flex items-center overflow-hidden">
              <p className={cn(
                "text-sm font-medium",
                currentAlert?.isTicker && "animate-[marquee_10s_linear_infinite] whitespace-nowrap pl-[100%]"
              )}>
                {currentAlert?.text}
              </p>
            </div>
            <style>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-100%); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
