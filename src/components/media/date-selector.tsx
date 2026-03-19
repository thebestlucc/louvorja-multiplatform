import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildMonthGrid, toIsoDate } from "../../lib/schedules";
import { useMediaLibraryItemDates } from "../../lib/queries";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "../../lib/utils";

interface DateSelectorProps {
  categoryId: number | null;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function DateSelector({ categoryId, selectedDate, onSelectDate }: DateSelectorProps) {
  const { i18n, t } = useTranslation();
  const { data: itemDates = [] } = useMediaLibraryItemDates(categoryId ?? 0);
  const [baseMonthOffset, setBaseMonthOffset] = useState(0);

  const monthsData = useMemo(() => {
    const now = new Date();
    const items: { year: number; month: number }[] = [];
    
    // Show 3 months starting from the current month + offset
    for (let i = 0; i < 3; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + baseMonthOffset + i, 1));
      items.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }
    return items;
  }, [baseMonthOffset]);

  const monthFormatter = new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" });
  const weekdayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" });
  
  const weekdays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => 
      weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + i)))
    );
  }, [i18n.language]);

  const hasItems = (isoDate: string) => itemDates.includes(isoDate);
  const isPast = (isoDate: string) => isoDate < toIsoDate(new Date());

  const handlePrev = () => setBaseMonthOffset(prev => prev - 3);
  const handleNext = () => setBaseMonthOffset(prev => prev + 3);
  const handleToday = () => setBaseMonthOffset(0);

  return (
    <div className="flex w-72 flex-col gap-2 border-r pr-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("mediaLibrary.schedule", "Schedule")}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleToday} title={t("actions.today", "Today")}>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button 
          onClick={() => onSelectDate(null)}
          className={cn(
            "text-[10px] hover:underline",
            selectedDate === null ? "font-bold text-primary" : "text-muted-foreground"
          )}
        >
          {t("mediaLibrary.allDates")}
        </button>
      </div>

      <ScrollArea className="h-full pr-2">
        <div className="flex flex-col gap-6 py-2">
          {monthsData.map(({ year, month }) => (
            <div key={`${year}-${month}`} className="space-y-2">
              <h4 className="text-xs font-medium capitalize px-1">
                {monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)))}
              </h4>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
                {weekdays.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {buildMonthGrid(year, month).flat().map((cell) => {
                  const itemsOnDate = hasItems(cell.isoDate);
                  const past = isPast(cell.isoDate);
                  const disabled = !cell.inCurrentMonth || (past && !itemsOnDate);
                  const isSelected = selectedDate === cell.isoDate;

                  return (
                    <button
                      key={cell.isoDate}
                      disabled={disabled}
                      onClick={() => onSelectDate(cell.isoDate)}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-md text-[11px] transition-all",
                        !cell.inCurrentMonth && "opacity-0 pointer-events-none",
                        disabled && "opacity-30 cursor-not-allowed",
                        !disabled && !isSelected && "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-primary text-primary-foreground font-bold shadow-sm scale-105 z-10",
                        !isSelected && cell.isToday && "border border-primary/50 text-primary",
                        !isSelected && !cell.isToday && "text-foreground"
                      )}
                    >
                      {cell.dayNumber}
                      {itemsOnDate && (
                        <span className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          isSelected ? "bg-primary-foreground" : "bg-primary"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
