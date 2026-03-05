import { toast } from "sonner";

/**
 * Standard backend error response structure (matches Rust AppErrorResponse)
 */
export interface AppErrorResponse {
  code: string;
  message: string;
  details?: string;
}

/**
 * Type guard to check if an object is an AppErrorResponse
 */
export function isAppErrorResponse(error: any): error is AppErrorResponse {
  return (
    error &&
    typeof error === "object" &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

/**
 * Standard notification options
 */
export interface NotificationOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Standardized notification handler
 */
export const notify = {
  success: (message: string, options?: NotificationOptions) => {
    toast.success(message, {
      description: options?.description,
      duration: options?.duration || 3000,
      action: options?.action,
    });
  },

  error: (message: string, options?: NotificationOptions) => {
    toast.error(message, {
      description: options?.description,
      duration: options?.duration || 5000,
      action: options?.action,
    });
  },

  info: (message: string, options?: NotificationOptions) => {
    toast.info(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
    });
  },

  loading: (message: string, options?: NotificationOptions) => {
    return toast.loading(message, {
      description: options?.description,
      action: options?.action,
    });
  },

  /**
   * Specialized handler for Tauri/Rust backend errors
   */
  tauriError: (error: unknown, fallbackMessage = "An unexpected error occurred") => {
    if (isAppErrorResponse(error)) {
      toast.error(error.message, {
        description: error.details || `Error code: ${error.code}`,
        duration: 6000,
      });
      return;
    }

    // Fallback for string errors or other unknown shapes
    const message = typeof error === "string" ? error : fallbackMessage;
    toast.error(message, {
      duration: 5000,
    });
  },

  /**
   * Helper to dismiss a toast by ID
   */
  dismiss: (id?: string | number) => {
    toast.dismiss(id);
  },
};
