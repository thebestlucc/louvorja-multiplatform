import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  checkForUpdates,
  installUpdate,
} from "../tauri";
import { queryKeys } from "./keys";

export function useCheckForUpdates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.updater.info,
    queryFn: () => checkForUpdates(),
    enabled: options?.enabled,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });
}

export function useInstallUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => installUpdate(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.updater.info, null);
    },
  });
}
