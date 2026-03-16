import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/identify")({
  component: IdentifyPage,
});

function IdentifyPage() {
  const { id } = Route.useSearch<{ id: string }>();

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-black/60 text-white select-none pointer-events-none">
      <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
        <div className="text-[40vh] font-black leading-none drop-shadow-[0_10px_50px_rgba(0,0,0,0.8)]">
          {id}
        </div>
        <div className="text-4xl font-bold uppercase tracking-[0.2em] opacity-80">
          Monitor
        </div>
      </div>
    </div>
  );
}
