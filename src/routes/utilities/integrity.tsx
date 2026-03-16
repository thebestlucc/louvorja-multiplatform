import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck, AlertTriangle, FileSearch, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useMediaIntegrity, useDeleteExcessMedia } from "../../lib/queries";
import { notify } from "../../lib/notifications";
import { catcher } from "../../lib/catcher";
import { cn } from "../../lib/utils";
import { ConfirmationDialog } from "../../components/schedules/confirmation-dialog";

export const Route = createFileRoute("/utilities/integrity")({
  component: MediaIntegrityPage,
});

function MediaIntegrityPage() {
  const { t } = useTranslation();
  const { data: report, isLoading, refetch, isFetching } = useMediaIntegrity();
  const deleteMutation = useDeleteExcessMedia();
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const handleScan = async () => {
    await refetch();
  };

  const handleCleanup = async () => {
    if (!report?.excessFiles?.length) return;
    
    const [_, error] = await catcher(
      deleteMutation.mutateAsync(report.excessFiles),
      { notify: true }
    );

    if (!error) {
      notify.success(t("mediaIntegrity.cleanUpSuccess"));
      setCleanupOpen(false);
    }
  };

  const missingCount = report?.missingFiles?.length ?? 0;
  const excessCount = report?.excessFiles?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("mediaIntegrity.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("mediaIntegrity.description")}</p>
        </div>
        <Button onClick={handleScan} disabled={isLoading || isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", (isLoading || isFetching) && "animate-spin")} />
          {t("mediaIntegrity.scan")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className={cn(missingCount > 0 ? "border-destructive/50 bg-destructive/5" : "")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("mediaIntegrity.missingFiles")}</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", missingCount > 0 ? "text-destructive" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {missingCount > 0 ? "Needs attention" : "Everything found"}
            </p>
          </CardContent>
        </Card>

        <Card className={cn(excessCount > 0 ? "border-amber-500/50 bg-amber-500/5" : "")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t("mediaIntegrity.excessFiles")}</CardTitle>
            <ShieldCheck className={cn("h-4 w-4", excessCount > 0 ? "text-amber-500" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{excessCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {excessCount > 0 ? "Unreferenced files" : "Clean library"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="missing" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="missing" className="gap-2">
                  {t("mediaIntegrity.missingFiles")}
                  {missingCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{missingCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="excess" className="gap-2">
                  {t("mediaIntegrity.excessFiles")}
                  {excessCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{excessCount}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="excess" className="m-0">
                {excessCount > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setCleanupOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("mediaIntegrity.cleanUp")}
                  </Button>
                )}
              </TabsContent>
            </div>

            <TabsContent value="missing" className="mt-0">
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Path</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t("mediaIntegrity.source")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.missingFiles?.map((file, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-[11px] text-destructive">{file.path}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{file.sourceName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{file.sourceType} #{file.sourceId}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {missingCount === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                          <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          {t("mediaIntegrity.emptyMissing")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="excess" className="mt-0">
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.excessFiles?.map((path, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{path}</td>
                      </tr>
                    ))}
                    {excessCount === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground">
                          <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          {t("mediaIntegrity.emptyExcess")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={cleanupOpen}
        title={t("mediaIntegrity.cleanUp")}
        description={t("mediaIntegrity.cleanUpConfirm", { count: excessCount })}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isPending={deleteMutation.isPending}
        onOpenChange={setCleanupOpen}
        onConfirm={() => void handleCleanup()}
      />
    </div>
  );
}

function Badge({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "secondary" | "destructive"; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      variant === "default" && "bg-primary text-primary-foreground",
      variant === "secondary" && "bg-secondary text-secondary-foreground",
      variant === "destructive" && "bg-destructive text-destructive-foreground",
      className
    )}>
      {children}
    </span>
  );
}
