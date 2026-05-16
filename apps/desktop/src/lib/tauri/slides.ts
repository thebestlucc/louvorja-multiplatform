import { invoke } from "@tauri-apps/api/core";
import type { Presentation, Slide, SlideContent, TransitionConfig } from "../bindings";

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

// Presentations
export async function getPresentations(): Promise<Presentation[]> {
  return tauriInvoke<Presentation[]>("get_presentations");
}

export async function getPresentation(id: number): Promise<Presentation> {
  return tauriInvoke<Presentation>("get_presentation", { id });
}

export async function createPresentation(title: string, aspectRatio: string): Promise<Presentation> {
  return tauriInvoke<Presentation>("create_presentation", { title, aspectRatio });
}

export async function updatePresentation(id: number, title: string, aspectRatio: string): Promise<void> {
  return tauriInvoke<void>("update_presentation", { id, title, aspectRatio });
}

export async function deletePresentation(id: number): Promise<void> {
  return tauriInvoke<void>("delete_presentation", { id });
}

// Slides
export async function getSlides(presentationId: number): Promise<Slide[]> {
  return tauriInvoke<Slide[]>("get_slides", { presentationId });
}

/** Batch variant: fetch slides for N presentations in a single IPC call. */
export async function getSlidesBatch(presentationIds: number[]): Promise<Slide[]> {
  return tauriInvoke<Slide[]>("get_slides_batch", { presentationIds });
}

/** @deprecated Use createSlideTyped — this wrapper serialises content to JSON string for backward compat */
export async function createSlide(presentationId: number, contentJson: string, sortOrder: number): Promise<Slide> {
  const content = JSON.parse(contentJson) as SlideContent;
  return tauriInvoke<Slide>("create_slide", { presentationId, content, sortOrder });
}

/** @deprecated Use updateSlideContent — this wrapper serialises content to JSON string for backward compat */
export async function updateSlide(id: number, contentJson: string): Promise<void> {
  const content = JSON.parse(contentJson) as SlideContent;
  return tauriInvoke<void>("update_slide", { id, content });
}

export async function deleteSlide(id: number): Promise<void> {
  return tauriInvoke<void>("delete_slide", { id });
}

export async function reorderSlides(presentationId: number, slideIds: number[]): Promise<void> {
  return tauriInvoke<void>("reorder_slides", { presentationId, slideIds });
}

export async function importSlja(path: string): Promise<Presentation> {
  return tauriInvoke<Presentation>("import_slja", { path });
}

export async function exportSlja(presentationId: number, path: string): Promise<void> {
  return tauriInvoke<void>("export_slja", { presentationId, path });
}

// New typed wrappers

export async function createSlideTyped(presentationId: number, content: SlideContent, sortOrder: number): Promise<Slide> {
  return tauriInvoke<Slide>("create_slide", { presentationId, content, sortOrder });
}

export async function updateSlideContent(id: number, content: SlideContent): Promise<void> {
  return tauriInvoke<void>("update_slide", { id, content });
}

export async function updateSlideNotes(id: number, notes: string): Promise<void> {
  return tauriInvoke<void>("update_slide_notes", { id, notes });
}

export async function updateSlideTransition(id: number, transition: TransitionConfig): Promise<void> {
  return tauriInvoke<void>("update_slide_transition", { id, transition });
}

export async function importPptx(path: string): Promise<Presentation> {
  return tauriInvoke<Presentation>("import_pptx", { path });
}

export async function exportPptx(presentationId: number, path: string): Promise<void> {
  return tauriInvoke<void>("export_pptx", { presentationId, path });
}
