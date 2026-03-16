import { Link, createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, CaseSensitive, Clock3, Shuffle, Timer, Type } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const Route = createFileRoute("/utilities/")({
  component: UtilitiesIndex,
});

function UtilitiesIndex() {
  const { t } = useTranslation();

  const tools = [
    {
      to: "/utilities/timer",
      icon: Timer,
      title: t("utilities.timer.title"),
      description: t("utilities.timer.description"),
    },
    {
      to: "/utilities/clock",
      icon: Clock3,
      title: t("utilities.clock.title"),
      description: t("utilities.clock.description"),
    },
    {
      to: "/utilities/schedules",
      icon: CalendarDays,
      title: t("utilities.overview.cards.schedules.title"),
      description: t("utilities.overview.cards.schedules.description"),
    },
    {
      to: "/utilities/lottery",
      icon: Shuffle,
      title: t("utilities.lottery.title"),
      description: t("utilities.lottery.description"),
    },
    {
      to: "/utilities/text",
      icon: CaseSensitive,
      title: t("utilities.text.title"),
      description: t("utilities.text.description"),
    },
    {
      to: "/utilities/interactive-text",
      icon: Type,
      title: t("interactiveText.title"),
      description: t("utilities.interactiveText.description"),
    },
  ] as const;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("utilities.overview.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("utilities.overview.description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to}>
            <Card className="h-full cursor-pointer transition-colors hover:bg-surface-hover">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                    <tool.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
