import { Link } from "@tanstack/react-router";
import { Button } from "../../components/ui/button";

export interface PresentationEditorStateProps {
  title: string;
  description: string;
  backLabel: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function PresentationEditorState({
  title,
  description,
  backLabel,
  retryLabel,
  onRetry,
}: PresentationEditorStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {onRetry && retryLabel ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          <Link to="/presentations">
            <Button size="sm">{backLabel}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
