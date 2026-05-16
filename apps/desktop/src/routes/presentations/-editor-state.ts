export type PresentationEditorViewState =
  | "invalid-id"
  | "loading"
  | "not-found"
  | "error"
  | "success";

interface ResolvePresentationEditorStateInput {
  presentationId: number;
  isInitialLoading: boolean;
  isPresentationError: boolean;
  presentationError: unknown;
  hasPresentation: boolean;
}

export function resolvePresentationEditorState({
  presentationId,
  isInitialLoading,
  isPresentationError,
  presentationError,
  hasPresentation,
}: ResolvePresentationEditorStateInput): PresentationEditorViewState {
  if (isInvalidPresentationId(presentationId)) {
    return "invalid-id";
  }

  if (isInitialLoading) {
    return "loading";
  }

  if (isPresentationError && isPresentationNotFoundError(presentationError)) {
    return "not-found";
  }

  if (isPresentationError) {
    return "error";
  }

  if (!hasPresentation) {
    return "not-found";
  }

  return "success";
}

export function isInvalidPresentationId(id: number): boolean {
  return !Number.isInteger(id) || id <= 0;
}

export function toPresentationErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error;
    if (typeof message === "string") {
      return message;
    }
  }
  return String(error ?? "");
}

export function isPresentationNotFoundError(error: unknown): boolean {
  return /not[\s-]?found|404/i.test(toPresentationErrorMessage(error));
}
