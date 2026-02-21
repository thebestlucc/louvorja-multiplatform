import { useTranslation } from "react-i18next";
import { useVerses, useBibleVersions } from "../../lib/queries";
import type { BibleVersion } from "../../types/bible";

interface VersionComparisonItemProps {
  version: BibleVersion;
  book: string;
  chapter: number;
  selectedVerses: number[];
}

function VersionComparisonItem({ version, book, chapter, selectedVerses }: VersionComparisonItemProps) {
  const { data: verses } = useVerses(version.id, book, chapter);

  const verseSet = new Set(selectedVerses);
  const filtered = verses?.filter((v) => verseSet.has(v.verse)) ?? [];

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1 rounded-lg border p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {version.abbreviation}
      </h4>
      <div className="text-sm leading-relaxed">
        {filtered.map((v) => (
          <span key={v.verse}>
            <sup className="mr-0.5 text-xs font-bold text-muted-foreground">{v.verse}</sup>
            {v.text}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}

interface VersionComparisonProps {
  currentVersionId: number;
  book: string;
  chapter: number;
  selectedVerses: number[];
}

export function VersionComparison({
  currentVersionId,
  book,
  chapter,
  selectedVerses,
}: VersionComparisonProps) {
  const { t } = useTranslation();
  const { data: versions } = useBibleVersions();

  if (!versions || versions.length <= 1 || selectedVerses.length === 0) return null;

  const otherVersions = versions.filter((v) => v.id !== currentVersionId);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("bible.comparison")}
      </h3>
      {otherVersions.map((version) => (
        <VersionComparisonItem
          key={version.id}
          version={version}
          book={book}
          chapter={chapter}
          selectedVerses={selectedVerses}
        />
      ))}
    </div>
  );
}
