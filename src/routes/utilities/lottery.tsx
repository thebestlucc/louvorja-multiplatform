import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { useRunLottery } from "../../lib/queries";
import { useUtilityProjection } from "../../hooks/use-utility-projection";
import { createUtilityProjectionPayload } from "../../types/utilities";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { LotteryAnimation } from "../../components/utilities/lottery-animation";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/utilities/lottery")({
  component: UtilitiesLotteryPage,
});

type LotteryMode = "names" | "numbers";

interface LotteryHistoryEntry {
  id: number;
  mode: LotteryMode;
  value: string;
}

function UtilitiesLotteryPage() {
  const { t } = useTranslation();
  const runLottery = useRunLottery();
  const { isProjecting, startProjection, stopProjection } = useUtilityProjection("lottery");
  const [mode, setMode] = useState<LotteryMode>("names");
  const [namesText, setNamesText] = useState("");
  const [maxNumber, setMaxNumber] = useState("10");
  const [winner, setWinner] = useState<string | null>(null);
  const [drawingDisplayValue, setDrawingDisplayValue] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  const [pickedNumbers, setPickedNumbers] = useState<number[]>([]);
  const [history, setHistory] = useState<LotteryHistoryEntry[]>([]);
  const drawTimerRef = useRef<number | null>(null);
  const lastProjectionSyncAtRef = useRef(0);

  const names = useMemo(() => sanitizeNames(namesText), [namesText]);
  const parsedMaxNumber = useMemo(() => Number.parseInt(maxNumber, 10), [maxNumber]);
  const availableNames = useMemo(
    () => names.filter((name) => !pickedNames.includes(name)),
    [names, pickedNames],
  );
  const availableNumbers = useMemo(
    () => buildAvailableNumbers(parsedMaxNumber, pickedNumbers),
    [parsedMaxNumber, pickedNumbers],
  );

  const currentTotal = mode === "names"
    ? names.length
    : (Number.isFinite(parsedMaxNumber) && parsedMaxNumber > 0 ? parsedMaxNumber : 0);
  const currentRemaining = mode === "names" ? availableNames.length : availableNumbers.length;
  const animationCandidates = mode === "names" ? availableNames : availableNumbers.map(String);
  const projectionValue = winner ?? (isDrawing ? drawingDisplayValue : null) ?? t("utilities.lottery.noWinner");
  const projectionSubtitle = isDrawing ? t("utilities.lottery.drawing") : t("utilities.lottery.winner");

  const projectLotteryValue = useCallback(async (value: string, subtitle: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return;
    }

    await startProjection(
      createUtilityProjectionPayload({
        kind: "lottery",
        displayValue: normalizedValue,
        subtitle,
        contextTitle: t("utilities.projection.context.lottery"),
      }),
    );
  }, [startProjection, t]);

  useEffect(() => {
    if (!isProjecting) {
      lastProjectionSyncAtRef.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastProjectionSyncAtRef.current < 90) {
      return;
    }
    lastProjectionSyncAtRef.current = now;
    void projectLotteryValue(projectionValue, projectionSubtitle);
  }, [isProjecting, projectLotteryValue, projectionSubtitle, projectionValue]);

  useEffect(() => {
    return () => {
      if (drawTimerRef.current != null) {
        window.clearTimeout(drawTimerRef.current);
      }
    };
  }, []);

  const handleDrawWinner = async () => {
    if (isDrawing) {
      return;
    }

    if (mode === "names") {
      if (names.length === 0) {
        notify.error(t("utilities.lottery.invalidNames"));
        return;
      }
      if (availableNames.length === 0) {
        notify.error(t("utilities.lottery.allPicked"));
        return;
      }

      const [selected, error] = await catcher(
        runLottery.mutateAsync(availableNames),
        { notify: true },
      );

      if (error) {
        setIsDrawing(false);
        return;
      }

      setIsDrawing(true);
      setWinner(null);
      setDrawingDisplayValue(null);
      if (drawTimerRef.current != null) {
        window.clearTimeout(drawTimerRef.current);
      }
      drawTimerRef.current = window.setTimeout(() => {
        setPickedNames((prev) => (prev.includes(selected) ? prev : [...prev, selected]));
        setHistory((prev) => [...prev, { id: prev.length + 1, mode: "names", value: selected }]);
        setWinner(selected);
        setIsDrawing(false);
        drawTimerRef.current = null;
      }, 1800);
      return;
    }

    if (!Number.isFinite(parsedMaxNumber) || parsedMaxNumber <= 0) {
      notify.error(t("utilities.lottery.invalidMax"));
      return;
    }
    if (availableNumbers.length === 0) {
      notify.error(t("utilities.lottery.allPicked"));
      return;
    }

    const [selected, error] = await catcher(
      (async () => {
        const sel = await runLottery.mutateAsync(availableNumbers.map(String));
        const selNumber = Number.parseInt(sel, 10);
        if (!Number.isFinite(selNumber)) {
          throw new Error("Invalid lottery result");
        }
        return sel;
      })(),
      { notify: true },
    );

    if (error) {
      setIsDrawing(false);
      return;
    }

    const selectedNumber = Number.parseInt(selected, 10);

    setIsDrawing(true);
    setWinner(null);
    setDrawingDisplayValue(null);
    if (drawTimerRef.current != null) {
      window.clearTimeout(drawTimerRef.current);
    }
    drawTimerRef.current = window.setTimeout(() => {
      setPickedNumbers((prev) => (prev.includes(selectedNumber) ? prev : [...prev, selectedNumber]));
      setHistory((prev) => [...prev, { id: prev.length + 1, mode: "numbers", value: String(selectedNumber) }]);
      setWinner(String(selectedNumber));
      setIsDrawing(false);
      drawTimerRef.current = null;
    }, 1800);
  };

  const handleResetCurrentMode = () => {
    if (mode === "names") {
      setPickedNames([]);
    } else {
      setPickedNumbers([]);
    }
    setWinner(null);
    setDrawingDisplayValue(null);
    setIsDrawing(false);
    if (isProjecting) {
      void stopProjection();
    }
  };

  const handleClear = () => {
    setNamesText("");
    setMaxNumber("10");
    setWinner(null);
    setDrawingDisplayValue(null);
    setPickedNames([]);
    setPickedNumbers([]);
    setHistory([]);
    setIsDrawing(false);
    if (isProjecting) {
      void stopProjection();
    }
  };

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>{t("utilities.lottery.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("utilities.lottery.description")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("utilities.lottery.mode")}</label>
            <div className="flex flex-wrap gap-2">
              <ModeButton
                active={mode === "names"}
                label={t("utilities.lottery.modeNames")}
                onClick={() => setMode("names")}
              />
              <ModeButton
                active={mode === "numbers"}
                label={t("utilities.lottery.modeNumbers")}
                onClick={() => setMode("numbers")}
              />
            </div>
          </div>

          {mode === "names" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("utilities.lottery.names")}</label>
              <textarea
                value={namesText}
                onChange={(event) => setNamesText(event.target.value)}
                placeholder={t("utilities.lottery.placeholder")}
                className="min-h-56 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("utilities.lottery.maxNumber")}</label>
              <input
                type="number"
                min={1}
                value={maxNumber}
                onChange={(event) => setMaxNumber(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleDrawWinner}
              disabled={runLottery.isPending || isDrawing}
            >
              {t("utilities.lottery.draw")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleResetCurrentMode}>
              {t("utilities.lottery.resetPicks")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear}>
              {t("utilities.lottery.clear")}
            </Button>
            <Button
              size="sm"
              variant={isProjecting ? "destructive" : "outline"}
              onClick={() => {
                if (isProjecting) {
                  void stopProjection();
                  return;
                }
                void projectLotteryValue(projectionValue, projectionSubtitle);
              }}
            >
              {isProjecting ? t("utilities.projection.clear") : t("utilities.projection.project")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("utilities.lottery.remaining", { remaining: currentRemaining, total: currentTotal })}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("utilities.lottery.winner")}</CardTitle>
          </CardHeader>
          <CardContent>
            <LotteryAnimation
              isDrawing={isDrawing}
              winner={winner}
              candidates={animationCandidates}
              emptyLabel={t("utilities.lottery.noWinner")}
              onDisplayValueChange={setDrawingDisplayValue}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("utilities.lottery.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("utilities.lottery.emptyHistory")}</p>
            ) : (
              <ol className="space-y-2">
                {[...history].reverse().map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{entry.value}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.mode === "names" ? t("utilities.lottery.modeNames") : t("utilities.lottery.modeNumbers")}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function sanitizeNames(value: string): string[] {
  const unique = new Set<string>();
  for (const name of value.split(/\r?\n/).map((item) => item.trim()).filter((item) => item.length > 0)) {
    unique.add(name);
  }
  return Array.from(unique);
}

function buildAvailableNumbers(maxNumber: number, pickedNumbers: number[]): number[] {
  if (!Number.isFinite(maxNumber) || maxNumber <= 0) {
    return [];
  }
  const picked = new Set(pickedNumbers);
  const result: number[] = [];
  for (let index = 1; index <= maxNumber; index += 1) {
    if (!picked.has(index)) {
      result.push(index);
    }
  }
  return result;
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
