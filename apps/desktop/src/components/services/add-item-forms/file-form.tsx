import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { LibraryBrowser } from "../../media/library-browser";
import type { AddItemOnAdd } from "./types";

export function FileForm({ onAdd, initialFilePath, initialTitle: _initialTitle, submitLabel }: { onAdd: AddItemOnAdd; initialFilePath?: string; initialTitle?: string; submitLabel?: string }) {
  const { t } = useTranslation();
  const [filePath, setFilePath] = useState(initialFilePath ?? "");

  const handleBrowse = async () => {
    const selected = await openFileDialog({ multiple: false });
    if (selected && !Array.isArray(selected)) setFilePath(selected);
  };

  const fileName = filePath ? filePath.split(/[\\/]/).pop() ?? filePath : "";

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="upload">{t("services.fileTabs.upload", "Local File")}</TabsTrigger>
        <TabsTrigger value="library">{t("services.fileTabs.library", "Library")}</TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input readOnly placeholder={t("services.filePlaceholder")} value={filePath} className="flex-1" />
          <Button variant="outline" onClick={handleBrowse}>
            {t("services.browse")}
          </Button>
        </div>
        <Button disabled={filePath.length === 0} onClick={() => onAdd("file", fileName, null, filePath)}>
          {submitLabel ?? t("actions.add")}
        </Button>
      </TabsContent>

      <TabsContent value="library">
        <LibraryBrowser onSelect={(name, path) => onAdd("file", name, null, path)} />
      </TabsContent>
    </Tabs>
  );
}
