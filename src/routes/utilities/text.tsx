import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useFormatText } from "../../lib/queries";
import type { TextFormat } from "../../types/utilities";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

export const Route = createFileRoute("/utilities/text")({
  component: UtilitiesTextPage,
});

function UtilitiesTextPage() {
  const { t } = useTranslation();
  const formatText = useFormatText();
  const [format, setFormat] = useState<TextFormat>("uppercase");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");

  const handleApplyFormat = async () => {
    if (inputText.trim().length === 0) {
      toast.error(t("utilities.text.emptyInput"));
      return;
    }

    try {
      const result = await formatText.mutateAsync({ text: inputText, format });
      setOutputText(result);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleCopyOutput = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      toast.success(t("utilities.text.copied"));
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>{t("utilities.text.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("utilities.text.description")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr] lg:items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("utilities.text.format")}</label>
            <Select value={format} onValueChange={(value) => setFormat(value as TextFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uppercase">{t("utilities.text.uppercase")}</SelectItem>
                <SelectItem value="lowercase">{t("utilities.text.lowercase")}</SelectItem>
                <SelectItem value="title_case">{t("utilities.text.titleCase")}</SelectItem>
                <SelectItem value="sentence_case">{t("utilities.text.sentenceCase")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleApplyFormat} disabled={formatText.isPending}>
              {t("utilities.text.apply")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyOutput}
              disabled={!outputText}
            >
              {t("utilities.text.copy")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("utilities.text.input")}</label>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              className="min-h-56 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("utilities.text.output")}</label>
            <textarea
              readOnly
              value={outputText}
              className="min-h-56 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
