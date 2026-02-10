import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Music, BookOpen, Presentation, ListChecks } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();

  const quickAccess = [
    { to: "/hymnal", icon: Music, label: t("nav.hymnal"), description: "Browse and search hymns" },
    { to: "/bible", icon: BookOpen, label: t("nav.bible"), description: "Read and project Bible verses" },
    { to: "/presentations", icon: Presentation, label: t("nav.presentations"), description: "Create and edit slides" },
    { to: "/services", icon: ListChecks, label: t("nav.services"), description: "Plan worship services" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("dashboard.welcome")}
        </h1>
        <p className="text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {quickAccess.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="cursor-pointer transition-colors hover:bg-surface-hover">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                    <item.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
