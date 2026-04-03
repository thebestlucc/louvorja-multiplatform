import { useTranslation } from "react-i18next";
import type { SlideContent, BibleMode, TextAlignment, RefPosition } from "../../../lib/bindings";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/utils";
import { ToggleField } from "./toggle-field";

type BibleSlide = Extract<SlideContent, { slideType: "bible" }>;

interface BibleFieldsProps {
  slide: BibleSlide;
  onChange: (slide: BibleSlide) => void;
}

interface BibleModeEditorProps {
  value: BibleMode;
  onChange: (mode: BibleMode) => void;
}

const ALIGNMENTS: TextAlignment[] = ["left", "center", "right"];
const REF_POSITIONS: RefPosition[] = ["bottom", "top", "hidden"];

function BibleModeEditor({ value, onChange }: BibleModeEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.bibleAlignment")}
        </label>
        <div className="flex gap-1">
          {ALIGNMENTS.map((a) => (
            <button
              key={a}
              type="button"
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                value.alignment === a
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/10 text-muted-foreground hover:bg-white/20",
              )}
              onClick={() => onChange({ ...value, alignment: a })}
              aria-pressed={value.alignment === a}
              aria-label={a}
            >
              {t(`presentations.align${a.charAt(0).toUpperCase() + a.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.bibleRefPosition")}
        </label>
        <div className="flex gap-1">
          {REF_POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                value.refPosition === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/10 text-muted-foreground hover:bg-white/20",
              )}
              onClick={() => onChange({ ...value, refPosition: p })}
              aria-pressed={value.refPosition === p}
              aria-label={p}
            >
              {t(`presentations.refPos${p.charAt(0).toUpperCase() + p.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <ToggleField
        label={t("presentations.bibleTextShadow")}
        checked={value.textShadow}
        onToggle={() => onChange({ ...value, textShadow: !value.textShadow })}
      />
    </div>
  );
}

export function BibleFields({ slide, onChange }: BibleFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0">
          {t("presentations.bibleReference")}
        </label>
        <Input
          readOnly
          value={slide.reference}
          className="bg-muted"
          aria-label={t("presentations.bibleReference")}
        />
      </div>
      <div className="flex gap-3">
        <label className="text-sm font-medium text-muted-foreground w-24 shrink-0 pt-2">
          {t("presentations.text")}
        </label>
        <textarea
          readOnly
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground",
          )}
          value={slide.text}
        />
      </div>
      <div className="border-t border-border pt-3">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("presentations.bibleDisplayMode")}
        </h4>
        <BibleModeEditor
          value={slide.mode}
          onChange={(mode) => onChange({ ...slide, mode })}
        />
      </div>
    </div>
  );
}
