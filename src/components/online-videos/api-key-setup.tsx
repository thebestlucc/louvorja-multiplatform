import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Key } from "lucide-react";
import { Button } from "../ui/button";

export function ApiKeySetup() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Key className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{t("onlineVideos.setup.title")}</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("onlineVideos.setup.description")}
      </p>
      <Link to="/settings">
        <Button>{t("onlineVideos.setup.goToSettings")}</Button>
      </Link>
    </div>
  );
}
