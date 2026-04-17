import { cn } from "@/lib/utils";

interface HighlightedSnippetProps {
  html: string;
  className?: string;
}

/**
 * Renders FTS snippet text containing `<mark>…</mark>` tags as React elements.
 * Safe: splits on the literal tag delimiters, extracts inner text via slice,
 * and renders React mark elements — never parses raw HTML. Matches the main
 * app's pattern so highlights look identical across desktop and remote.
 */
export function HighlightedSnippet({ html, className }: HighlightedSnippetProps) {
  const parts = html.split(/(<mark>.*?<\/mark>)/g);
  return (
    <span className={cn(className)}>
      {parts.map((part, i) =>
        part.startsWith("<mark>") && part.endsWith("</mark>") ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-300/80 px-0.5 font-semibold text-yellow-900 dark:bg-yellow-600/60 dark:text-yellow-100"
          >
            {part.slice(6, -7)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
