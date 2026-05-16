/**
 * Typed registry of all WebSocket operation names used between the Remote PWA
 * and the Tauri backend. Single source of truth — adding a new op is a
 * one-file change on the TypeScript side.
 *
 * Usage:
 *   ws.send(WsOps.SLIDE_GOTO, { index: 3 });
 *   ws.on(WsOps.SLIDE_CHANGED, (payload) => { ... });
 */

// ── Slide ─────────────────────────────────────────────────────────────────────
const SLIDE_NEXT     = "slide.next"     as const;
const SLIDE_PREV     = "slide.prev"     as const;
const SLIDE_GOTO     = "slide.goto"     as const;
const SLIDE_CLEAR    = "slide.clear"    as const;
const SLIDE_OVERLAY  = "slide.overlay"  as const;
const SLIDE_CHANGED  = "slide.changed"  as const;

// ── Audio ─────────────────────────────────────────────────────────────────────
const AUDIO_PLAY      = "audio.play"      as const;
const AUDIO_PAUSE     = "audio.pause"     as const;
const AUDIO_TOGGLE    = "audio.toggle"    as const;
const AUDIO_SEEK      = "audio.seek"      as const;
const AUDIO_VOLUME    = "audio.volume"    as const;
const AUDIO_SKIP_NEXT = "audio.skip_next" as const;
const AUDIO_SKIP_PREV = "audio.skip_prev" as const;
const AUDIO_STATUS    = "audio.status"    as const;

// ── Bible ─────────────────────────────────────────────────────────────────────
const BIBLE_SEARCH        = "bible.search"        as const;
const BIBLE_LIST_VERSIONS = "bible.list_versions" as const;
const BIBLE_LIST_BOOKS    = "bible.list_books"    as const;
const BIBLE_LIST_CHAPTERS = "bible.list_chapters" as const;
const BIBLE_LIST_VERSES   = "bible.list_verses"   as const;
const BIBLE_GET_VERSE     = "bible.get_verse"     as const;

// ── Hymn ──────────────────────────────────────────────────────────────────────
const HYMN_SEARCH = "hymn.search" as const;

// ── Presentation ──────────────────────────────────────────────────────────────
const PRESENTATION_LIST = "presentation.list" as const;

// ── Video ─────────────────────────────────────────────────────────────────────
const VIDEO_LIST        = "video.list"        as const;
const VIDEO_PLAY        = "video.play"        as const;
const VIDEO_PAUSE       = "video.pause"       as const;
const VIDEO_SEEK        = "video.seek"        as const;
const VIDEO_SET_TARGETS = "video.set_targets" as const;
const VIDEO_QUEUE_URL   = "video.queue_url"   as const;

// ── Service ───────────────────────────────────────────────────────────────────
const SERVICE_LIST_TODAY  = "service.list_today"  as const;
const SERVICE_START       = "service.start"       as const;
const SERVICE_STOP        = "service.stop"        as const;
const SERVICE_NEXT_ITEM   = "service.next_item"   as const;
const SERVICE_PREV_ITEM   = "service.prev_item"   as const;
const SERVICE_GOTO        = "service.goto"        as const;
const SERVICE_JUMP_TO     = "service.jump_to"     as const;
const SERVICE_STATE       = "service.state"       as const;

// ── Display / Overlay ─────────────────────────────────────────────────────────
const DISPLAY_OVERLAY = "display.overlay" as const;
const OVERLAY_BLACK   = "overlay.black"   as const;
const OVERLAY_CLEAR   = "overlay.clear"   as const;
const OVERLAY_LOGO    = "overlay.logo"    as const;

// ── Shortcut ──────────────────────────────────────────────────────────────────
const SHORTCUT_TRIGGER = "shortcut.trigger" as const;

// ── Queue ─────────────────────────────────────────────────────────────────────
const QUEUE_PLAY   = "queue.play"   as const;
const QUEUE_ADD    = "queue.add"    as const;
const QUEUE_REMOVE = "queue.remove" as const;
const QUEUE_STATE  = "queue.state"  as const;

// ── Search ────────────────────────────────────────────────────────────────────
const SEARCH_SELECT = "search.select" as const;

// ── Presence / Session ────────────────────────────────────────────────────────
const PRESENCE_LIST    = "presence.list"    as const;
const PRESENCE_CHANGED = "presence.changed" as const;
const STATE_SYNC       = "state.sync"       as const;
const PING             = "ping"             as const;

// ── Command attribution (inbound only) ────────────────────────────────────────
const COMMAND_ATTRIBUTED = "command.attributed" as const;

/**
 * All WS op names. Import specific constants from this object at call sites
 * to get compile-time op-name checking.
 */
export const WsOps = {
  SLIDE_NEXT,
  SLIDE_PREV,
  SLIDE_GOTO,
  SLIDE_CLEAR,
  SLIDE_OVERLAY,
  SLIDE_CHANGED,

  AUDIO_PLAY,
  AUDIO_PAUSE,
  AUDIO_TOGGLE,
  AUDIO_SEEK,
  AUDIO_VOLUME,
  AUDIO_SKIP_NEXT,
  AUDIO_SKIP_PREV,
  AUDIO_STATUS,

  BIBLE_SEARCH,
  BIBLE_LIST_VERSIONS,
  BIBLE_LIST_BOOKS,
  BIBLE_LIST_CHAPTERS,
  BIBLE_LIST_VERSES,
  BIBLE_GET_VERSE,

  HYMN_SEARCH,

  PRESENTATION_LIST,

  VIDEO_LIST,
  VIDEO_PLAY,
  VIDEO_PAUSE,
  VIDEO_SEEK,
  VIDEO_SET_TARGETS,
  VIDEO_QUEUE_URL,

  SERVICE_LIST_TODAY,
  SERVICE_START,
  SERVICE_STOP,
  SERVICE_NEXT_ITEM,
  SERVICE_PREV_ITEM,
  SERVICE_GOTO,
  SERVICE_JUMP_TO,
  SERVICE_STATE,

  DISPLAY_OVERLAY,
  OVERLAY_BLACK,
  OVERLAY_CLEAR,
  OVERLAY_LOGO,

  SHORTCUT_TRIGGER,

  QUEUE_PLAY,
  QUEUE_ADD,
  QUEUE_REMOVE,
  QUEUE_STATE,

  SEARCH_SELECT,

  PRESENCE_LIST,
  PRESENCE_CHANGED,
  STATE_SYNC,
  PING,

  COMMAND_ATTRIBUTED,
} as const;

/** Union of all valid WS op name strings. Used to narrow ws.send() / ws.on(). */
export type WsOpName = typeof WsOps[keyof typeof WsOps];
