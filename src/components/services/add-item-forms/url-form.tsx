import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { catcherSync } from "../../../lib/catcher";
import type { AddItemOnAdd } from "./types";

export function UrlForm({ onAdd }: { onAdd: AddItemOnAdd }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const [validUrlData, urlError] = catcherSync(() => new URL(url));
  const isValidUrl = !urlError && !!validUrlData;

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder={t("services.urlTitlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <Input
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      {url.length > 0 && !isValidUrl && (
        <p className="text-xs text-destructive">{t("services.invalidUrl")}</p>
      )}
      <Button size="sm" disabled={!isValidUrl || title.trim().length === 0} onClick={() => onAdd("url", title.trim(), null, url)}>
        {t("actions.add")}
      </Button>
    </div>
  );
}
