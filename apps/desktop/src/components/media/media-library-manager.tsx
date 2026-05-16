import { useState } from "react";
import { CategorySidebar } from "./category-sidebar";
import { DateSelector } from "./date-selector";
import { ItemGrid } from "./item-grid";

export function MediaLibraryManager() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleSelectCategory = (id: number) => {
    setSelectedCategoryId(id);
    setSelectedDate(null);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-100 w-full gap-6">
      <CategorySidebar
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
      />
      <DateSelector
        categoryId={selectedCategoryId}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <ItemGrid
        categoryId={selectedCategoryId}
        selectedDate={selectedDate}
      />
    </div>
  );
}
