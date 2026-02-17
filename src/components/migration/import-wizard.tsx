import { FileArchive, RefreshCw } from "lucide-react";
import type { MigrationOptions } from "../../types/migration";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface ImportWizardProps {
  title: string;
  description: string;
  sourcePath: string;
  options: MigrationOptions;
  loading?: boolean;
  errorMessage?: string | null;
  onSourcePathChange: (value: string) => void;
  onBrowseSourcePath: () => void;
  onOptionsChange: (next: MigrationOptions) => void;
  onStartImport: () => void;
  onStartFresh: () => void;
  labels: {
    sourcePath: string;
    browse: string;
    startImport: string;
    startFresh: string;
    includeHymns: string;
    includeBible: string;
    includeFavorites: string;
    includeServices: string;
    includeSettings: string;
    replaceExisting: string;
    domainTitle: string;
    domainsSelected: string;
    domainsNoneSelected: string;
  };
}

export function ImportWizard({
  title,
  description,
  sourcePath,
  options,
  loading,
  errorMessage,
  onSourcePathChange,
  onBrowseSourcePath,
  onOptionsChange,
  onStartImport,
  onStartFresh,
  labels,
}: ImportWizardProps) {
  const totalEnabled = [
    options.includeHymns,
    options.includeBible,
    options.includeFavorites,
    options.includeServices,
    options.includeSettings,
  ].filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{labels.sourcePath}</label>
          <div className="flex gap-2">
            <Input
              value={sourcePath}
              onChange={(event) => onSourcePathChange(event.target.value)}
              placeholder="/path/to/legacy.db"
            />
            <Button type="button" variant="outline" onClick={onBrowseSourcePath} disabled={loading}>
              {labels.browse}
            </Button>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">{labels.domainTitle}</legend>
          <OptionToggle
            label={labels.includeHymns}
            checked={options.includeHymns}
            onChange={(checked) => onOptionsChange({ ...options, includeHymns: checked })}
          />
          <OptionToggle
            label={labels.includeBible}
            checked={options.includeBible}
            onChange={(checked) => onOptionsChange({ ...options, includeBible: checked })}
          />
          <OptionToggle
            label={labels.includeFavorites}
            checked={options.includeFavorites}
            onChange={(checked) => onOptionsChange({ ...options, includeFavorites: checked })}
          />
          <OptionToggle
            label={labels.includeServices}
            checked={options.includeServices}
            onChange={(checked) => onOptionsChange({ ...options, includeServices: checked })}
          />
          <OptionToggle
            label={labels.includeSettings}
            checked={options.includeSettings}
            onChange={(checked) => onOptionsChange({ ...options, includeSettings: checked })}
          />
          <OptionToggle
            label={labels.replaceExisting}
            checked={options.replaceExisting}
            onChange={(checked) => onOptionsChange({ ...options, replaceExisting: checked })}
          />
          <p className="text-xs text-muted-foreground">
            {totalEnabled > 0
              ? labels.domainsSelected.replace("{{count}}", String(totalEnabled))
              : labels.domainsNoneSelected}
          </p>
        </fieldset>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onStartImport}
            disabled={loading || sourcePath.trim().length === 0 || totalEnabled === 0}
            className="min-w-40"
          >
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {labels.startImport}
          </Button>
          <Button type="button" variant="outline" onClick={onStartFresh} disabled={loading}>
            {labels.startFresh}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-hover">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}
