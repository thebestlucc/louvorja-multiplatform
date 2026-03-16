import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/identify")({
  validateSearch: (search: Record<string, unknown>): { id: string } => {
    return {
      id: (search.id as string) || "0",
    };
  },
  component: IdentifyPage,
});

function IdentifyPage() {
  const { id } = Route.useSearch();
  const { t } = useTranslation();

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-transparent text-white select-none pointer-events-none">
      <div className="flex aspect-square h-full flex-col items-center justify-center gap-1 animate-in zoom-in duration-300 bg-black/60 backdrop-blur-xl rounded-3xl shadow-2xl">
        <div className="text-[45vh] font-black leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)]">
          {id}
        </div>
        <div className="text-[7vh] font-bold uppercase tracking-widest opacity-80">
          {t("display.monitorLabel")}
        </div>
      </div>
    </div>
  );
}
