import { useState } from "react";
import { CategorySidebar } from "./category-sidebar";
import { ItemGrid } from "./item-grid";

export function MediaLibraryManager() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[400px] w-full gap-6">
      <CategorySidebar
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />
      <ItemGrid categoryId={selectedCategoryId} />
    </div>
  );
}
