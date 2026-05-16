import type { SlideContent, BackgroundConfig } from "./bindings";

type HymnSlidesInput = {
  title: string;
  lyrics: string | null;
  album: string | null;
  coverPath?: string | null;
  lyricsSync?: string | null;
};

type RawSyncLyric = {
  lyric?: unknown;
  order?: unknown;
  showSlide?: unknown;
  show_slide?: unknown;
};

type HymnLyricSequenceItem = {
  order: number;
  slideIndex: number;
  text: string | null;
  isCoverOnly: boolean;
};

export type VisibleHymnLyricItem = {
  slideIndex: number;
  text: string;
};

function normalizeOrder(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeShowSlide(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseLyricsSyncSequence(lyricsSync: string | null | undefined): HymnLyricSequenceItem[] {
  if (!lyricsSync) {
    return [];
  }

  try {
    const parsed = JSON.parse(lyricsSync) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => {
        const typed = item as RawSyncLyric;
        const lyric = typeof typed.lyric === "string" ? typed.lyric.trim() : "";
        const showSlide = normalizeShowSlide(typed.showSlide ?? typed.show_slide);
        const isCoverOnly = showSlide === 0 || lyric.length === 0;

        return {
          order: normalizeOrder(typed.order, index + 1),
          text: isCoverOnly ? null : lyric,
          isCoverOnly,
        };
      })
      .sort((left, right) => left.order - right.order)
      .map((item, index) => ({
        ...item,
        slideIndex: index + 1,
      }));
  } catch {
    return [];
  }
}

function parseLyricsTextSequence(lyrics: string | null): HymnLyricSequenceItem[] {
  if (!lyrics) {
    return [];
  }

  return lyrics
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((text, index) => ({
      order: index + 1,
      slideIndex: index + 1,
      text,
      isCoverOnly: false,
    }));
}

function buildLyricSequence(
  lyrics: string | null,
  lyricsSync: string | null | undefined,
): HymnLyricSequenceItem[] {
  const syncedSequence = parseLyricsSyncSequence(lyricsSync);
  if (syncedSequence.length > 0) {
    return syncedSequence;
  }

  return parseLyricsTextSequence(lyrics);
}

function createBackground(backgroundImage: string | null): BackgroundConfig {
  return {
    kind: backgroundImage ? "image" : "solid",
    color: "#1a1a2e",
    imagePath: backgroundImage,
    gradientStart: null,
    gradientEnd: null,
    gradientAngle: null,
    opacity: null,
  };
}

export function buildVisibleHymnLyricItems(input: Pick<HymnSlidesInput, "lyrics" | "lyricsSync">): VisibleHymnLyricItem[] {
  return buildLyricSequence(input.lyrics, input.lyricsSync)
    .filter((item): item is HymnLyricSequenceItem & { text: string } => item.text != null)
    .map((item) => ({
      slideIndex: item.slideIndex,
      text: item.text,
    }));
}

export function buildHymnSlides({
  title,
  lyrics,
  album,
  coverPath,
  lyricsSync,
}: HymnSlidesInput): SlideContent[] {
  const slides: SlideContent[] = [];
  const backgroundImage = coverPath ?? null;
  const lyricSequence = buildLyricSequence(lyrics, lyricsSync);
  const visibleLyricCount = lyricSequence.filter((item) => item.text != null).length;
  let visibleLyricIndex = 0;

  const bg = createBackground(backgroundImage);

  slides.push({
    slideType: "cover",
    title,
    subtitle: album ?? null,
    label: null,
    background: bg,
    text_color: null,
    text_size: null,
  });

  for (const item of lyricSequence) {
    if (item.isCoverOnly) {
      slides.push({
        slideType: "text",
        content: "",
        background: bg,
        text_color: null,
        text_size: null,
      });
      continue;
    }

    visibleLyricIndex += 1;
    slides.push({
      slideType: "lyrics",
      text: item.text ?? "",
      label: `${visibleLyricIndex}/${visibleLyricCount}`,
      background: bg,
      text_color: null,
      text_size: null,
    });
  }

  slides.push({ slideType: "pause" });

  return slides;
}
