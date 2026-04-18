import { useEffect, useCallback } from "react";
import { useQueueStore } from "../stores/queue-store";
import { useAudioStore } from "../stores/audio-store";
import { useDisplayStore } from "../stores/display-store";
import { useMediaPlayerStore } from "../stores/media-player-store";
import { resolvePlaybackVariantPaths, parseLyricsSyncToPoints } from "../lib/audio-sync";
import { getSyncPoints } from "../lib/tauri";
import { catcher } from "../lib/catcher";
import { projectSlideIndex } from "../lib/projection-playback";
import { hymnToSlides } from "./use-hymn-playback";
import type { HymnMediaItem } from "../types/media";
import type { QueueItem } from "../stores/queue-store";

// Module-level state — survives component remounts so we can distinguish
// "remount with same queue" from "new content queued".
let _lastPlayedIndex: number | null = null;
let _lastPlayedItemId: string | null = null;

/**
 * Reset coordinator tracking. Called by clearActivePlayback() so that
 * after external content (bible, presentation, video) takes over,
 * the coordinator can re-start playback if the user returns to the queue.
 */
export function resetCoordinatorPlaybackState() {
  _lastPlayedIndex = null;
  _lastPlayedItemId = null;
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function playHymnItem(
  item: QueueItem,
  setSyncPoints: (pts: import("../lib/bindings").SyncPoint[]) => void,
  setPlaybackMode: (m: "sung" | "karaoke" | "silent") => void,
  playAudio: (path: string, offset: number) => Promise<void>,
  playAudioVariants: (sung: string, karaoke: string, mode: "sung" | "karaoke", offset: number) => Promise<void>,
  stopAudio: () => Promise<void>,
) {
  const hymnId = item.hymn?.id;
  const variantPaths = resolvePlaybackVariantPaths(
    item.hymn?.audioPath,
    item.hymn?.playbackPath,
  );
  const audioPath = item.type === "projection"
    ? null
    : item.type === "playback"
      ? (item.hymn?.playbackPath || item.hymn?.audioPath)
      : item.hymn?.audioPath; // "audio" = Cantado = sung version

  // 0. Stop any active video playback from previous content
  const { useVideoPlayerStore } = await import("../stores/video-player-store");
  const videoState = useVideoPlayerStore.getState();
  if (videoState.videoId || videoState.videoSrc) {
    videoState.resetVideoState();
  }

  // 1. Resolve sync points
  let effectiveSyncPoints: import("../lib/bindings").SyncPoint[] = [];
  if (hymnId) {
    const syncPoints = await getSyncPoints(hymnId);
    effectiveSyncPoints = (syncPoints && syncPoints.length > 0)
      ? syncPoints
      : parseLyricsSyncToPoints(item.hymn?.lyricsSync);
  }

  // 2. Build slides (prefer pre-built slides from legacy collection items)
  const slides = item.slides ??
    (item.hymn
      ? hymnToSlides(
          item.hymn.title,
          item.hymn.lyrics,
          item.hymn.album,
          item.hymn.coverPath,
          item.hymn.lyricsSync,
        )
      : []);

  // 3. Map queue type → media mode
  const mode: HymnMediaItem["mode"] =
    item.type === "playback" ? "karaoke"
    : item.type === "projection" ? "silent"
    : "sung";

  // 4. Construct HymnMediaItem and dispatch to media-player-store
  if (item.hymn) {
    const mediaItem: HymnMediaItem = {
      type: "hymn",
      hymn: item.hymn,
      mode,
      slides,
      syncPoints: effectiveSyncPoints,
      audioPath: item.hymn.audioPath ?? undefined,
      playbackPath: item.hymn.playbackPath ?? undefined,
    };
    useMediaPlayerStore.getState().load(mediaItem);
  }

  // 5. Push sync points to audio store so the sync loop can auto-advance slides
  setSyncPoints(effectiveSyncPoints);

  // 6. Start audio playback (rodio lifecycle stays here)
  if (audioPath) {
    const activeMode = item.type === "playback" ? "karaoke" : "sung";
    setPlaybackMode(activeMode);
    if (variantPaths) {
      await playAudioVariants(
        variantPaths.sungPath,
        variantPaths.karaokePath,
        activeMode,
        0,
      );
    } else {
      await playAudio(audioPath, 0);
    }
  } else {
    setPlaybackMode("silent");
    await stopAudio();
  }

  // 7. Project first slide
  useDisplayStore.getState().setCurrentProjectionType("hymn");
  await projectSlideIndex(0);
}

async function playBibleItem(item: QueueItem) {
  if (!item.bibleContext) return;
  const { verses, initialVerse, bookName } = item.bibleContext;
  const { usePresentationStore } = await import("../stores/presentation-store");
  const { useDisplayStore: displayStore } = await import("../stores/display-store");
  const { setCurrentSlide } = await import("../lib/tauri/display");
  const { defaultBackground } = await import("../types/presentation");
  const { useAudioStore: audioStore } = await import("../stores/audio-store");

  // Build one slide per verse in the chapter. Preserves intra-chapter
  // next/prev via usePresentationStore.setActiveSlideIndex WITHOUT advancing the queue —
  // slide index is presentation-store-local, not queue-local.
  const slides: import("../lib/bindings").SlideContent[] = verses.map((v) => ({
    slideType: "bible" as const,
    text: v.text,
    reference: `${bookName} ${v.chapter}:${v.verse}`,
    mode: { alignment: "center" as const, refPosition: "bottom" as const, textShadow: false, gradient: null, fontFamily: null },
    background: defaultBackground(),
    text_color: null,
    text_size: null,
  }));

  // Find the initial-verse slide index
  const startIdx = Math.max(0, verses.findIndex((v) => v.verse === initialVerse));

  // Stop audio + unload media player (bible items are silent)
  await audioStore.getState().stop();
  useMediaPlayerStore.getState().unload();

  // Reset any active video
  const { useVideoPlayerStore } = await import("../stores/video-player-store");
  const vs = useVideoPlayerStore.getState();
  if (vs.videoId || vs.videoSrc) {
    vs.resetVideoState();
  }

  // Populate presentation store with the WHOLE chapter
  const pres = usePresentationStore.getState();
  pres.setSlides(slides);
  pres.setActiveSlideIndex(startIdx);
  displayStore.getState().setCurrentProjectionType("bible");
  await catcher(setCurrentSlide(slides[startIdx]));
}

async function playVideoItem(item: QueueItem) {
  if (!item.videoMedia) return;
  const { useAudioStore: audioStore } = await import("../stores/audio-store");
  const { usePresentationStore } = await import("../stores/presentation-store");
  const { setCurrentSlide } = await import("../lib/tauri/display");

  await audioStore.getState().stop();

  const vm = item.videoMedia;
  // onlineVideo SlideContent: { slideType: "onlineVideo"; url: string; video_id: string; source: VideoSource; title: string | null }
  // youtube: url is empty (player uses video_id), local: url is the path
  const slide: import("../lib/bindings").SlideContent = {
    slideType: "onlineVideo" as const,
    url: vm.videoUrl ?? "",
    video_id: vm.videoId ?? "",
    source: vm.videoSource,
    title: vm.videoTitle ?? null,
  };

  // Populate media-player-store so Playing Now shows preview + control bar.
  // Symmetry with playHymnItem (which also calls load()).
  if (vm.videoSource === "local" && vm.videoUrl) {
    useMediaPlayerStore.getState().load({
      type: "offline_video",
      videoPath: vm.videoUrl,
      title: vm.videoTitle ?? "Video",
      isManaged: vm.videoUrl.startsWith("media/"),
    });
  } else if (vm.videoId) {
    useMediaPlayerStore.getState().load({
      type: "online_video",
      videoId: vm.videoId,
      videoSource: "youtube",
      title: vm.videoTitle ?? "Video",
    });
  } else {
    useMediaPlayerStore.getState().unload();
  }

  usePresentationStore.getState().setSlides([slide]);
  usePresentationStore.getState().setActiveSlideIndex(0);
  useDisplayStore.getState().setCurrentProjectionType("presentation");

  // When the Rust video pipeline flag is on, load the URI into the Rust runtime
  // so Phase 2 controls (play/pause/seek/volume) actually drive a backed pipeline.
  // Must run BEFORE setCurrentSlide so projector/return RustVideoConsumers find a
  // loaded + playing pipeline the moment they subscribe on slide-changed.
  const { useVideoPlayerStore } = await import("../stores/video-player-store");
  if (useVideoPlayerStore.getState().useRustVideoPipeline) {
    const videoPipeline = await import("../lib/tauri/video-pipeline");
    let mediaSource: import("../lib/bindings").MediaSource | null = null;
    if (vm.videoSource === "local" && vm.videoUrl) {
      // Managed-media local videos (vm.videoUrl starts with "media/") are NOT
      // supported by the Rust pipeline yet — MediaSource::Local requires an
      // absolute path (see src-tauri/src/video_pipeline/source.rs validation).
      // Restore parity in Phase 3.x. For now, warn and skip.
      if (!vm.videoUrl.startsWith("media/") && vm.videoUrl.startsWith("/")) {
        mediaSource = { type: "local", absolutePath: vm.videoUrl };
      }
    } else if (vm.videoId) {
      mediaSource = { type: "youtube", videoId: vm.videoId };
    }

    if (mediaSource) {
      try {
        await videoPipeline.load(mediaSource);
        // Pipeline transitions to PAUSED on load (preroll). Mirror legacy queue
        // behavior of autoplay on advance by transitioning to PLAYING here.
        await videoPipeline.play();
      } catch (err) {
        console.error("[video-pipeline] load/play failed", err);
      }
    } else {
      console.warn("[video-pipeline] no resolvable MediaSource for", vm);
    }
  }

  // The PersistentVideoPlayer listens to slide-changed and manages its own lifecycle
  await catcher(setCurrentSlide(slide));
}

// RULE: Presentations are manual-advance only for MVP.
// Slide-end-of-presentation does NOT auto-advance the queue.
async function playPresentationItem(item: QueueItem) {
  if (!item.presentationId) return;
  const { commands } = await import("../lib/bindings");
  const { usePresentationStore } = await import("../stores/presentation-store");
  const { setCurrentSlide } = await import("../lib/tauri/display");

  const [res] = await catcher(commands.getSlides(item.presentationId));
  if (!res || res.status !== "ok") return;
  const rawSlides = res.data;
  if (!rawSlides || rawSlides.length === 0) return;

  // Parse each Slide.content JSON string into SlideContent
  const slides = rawSlides
    .map((s) => { try { return JSON.parse(s.content); } catch { return null; } })
    .filter(Boolean) as import("../lib/bindings").SlideContent[];
  if (slides.length === 0) return;

  await useAudioStore.getState().stop();
  useMediaPlayerStore.getState().unload();

  // Reset any active video
  const { useVideoPlayerStore } = await import("../stores/video-player-store");
  const vs = useVideoPlayerStore.getState();
  if (vs.videoId || vs.videoSrc) {
    vs.resetVideoState();
  }

  usePresentationStore.getState().setSlides(slides);
  usePresentationStore.getState().setActiveSlideIndex(0);
  useDisplayStore.getState().setCurrentProjectionType("presentation");
  await catcher(setCurrentSlide(slides[0]));
}

// ── Coordinator hook ───────────────────────────────────────────────────────────

/**
 * Centralized hook to coordinate playback and projection based on the queue store.
 * This ensures that whenever the queue's current index changes, the audio,
 * slides, and projection are automatically synchronized.
 */
export function usePlaybackCoordinator() {
  const items = useQueueStore((s) => s.items);
  const currentIndex = useQueueStore((s) => s.currentIndex);
  const replayTrigger = useQueueStore((s) => s.replayTrigger);
  const next = useQueueStore((s) => s.next);

  const setOnFinished = useAudioStore((s) => s.setOnFinished);
  const setPlaybackMode = useAudioStore((s) => s.setPlaybackMode);
  const setSyncPoints = useAudioStore((s) => s.setSyncPoints);
  const playAudio = useAudioStore((s) => s.play);
  const playAudioVariants = useAudioStore((s) => s.playVariants);
  const stopAudio = useAudioStore((s) => s.stop);

  const playItem = useCallback(async (index: number) => {
    const item = items[index];
    if (!item) return;

    // Already playing this exact item at this index — skip (handles remount + append)
    if (_lastPlayedIndex === index && _lastPlayedItemId === item.id) return;

    _lastPlayedIndex = index;
    _lastPlayedItemId = item.id;

    await catcher(async () => {
      try {
        switch (item.kind) {
          case "hymn":
            return await playHymnItem(item, setSyncPoints, setPlaybackMode, playAudio, playAudioVariants, stopAudio);
          case "bible":
            return await playBibleItem(item);
          case "video":
            return await playVideoItem(item);
          case "presentation":
            return await playPresentationItem(item);
        }
      } catch (err) {
        _lastPlayedIndex = null;
        _lastPlayedItemId = null; // allow retry
        throw err;               // catcher will notify
      }
    }, { notify: true });
  }, [items, setSyncPoints, setPlaybackMode, playAudio, playAudioVariants, stopAudio]);

  // Effect: React to queue index changes (and repeat-one replay triggers)
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < items.length) {
      // replayTrigger > 0 means repeat=one fired — force re-play same index
      if (replayTrigger > 0) {
        _lastPlayedIndex = null;
      }
      playItem(currentIndex);
    } else if (currentIndex === -1) {
      _lastPlayedIndex = null;
      _lastPlayedItemId = null;
      // Queue ended — stop audio, clear projection, and unload Playing Now
      stopAudio();
      useMediaPlayerStore.getState().unload();
      useDisplayStore.getState().setCurrentProjectionType(null);
      // Clear presentation-store slides so the effectiveSlides fallback in
      // playing-now doesn't render a stale onlineVideo thumbnail after queue ends.
      import("../stores/presentation-store").then(({ usePresentationStore }) => {
        usePresentationStore.getState().setSlides([]);
      }).catch(() => {});
    }
  }, [currentIndex, items.length, replayTrigger, playItem, stopAudio]);

  // Effect: Register Auto-Next callback
  useEffect(() => {
    setOnFinished(() => {
      next();
    });

    return () => {
      setOnFinished(null);
    };
  }, [setOnFinished, next]);
}
