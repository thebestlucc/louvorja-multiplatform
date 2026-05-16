import { describe, test } from "node:test";
import { strict as assert } from "node:assert";

import {
  formatContentSyncEntityType,
  formatContentSyncPlanItemLabel,
  formatContentSyncReason,
} from "../../src/lib/content-sync-presentation";

const translations: Record<string, string> = {
  "settings.contentSync.entityTypes.album": "Álbum",
  "settings.contentSync.entityTypes.hymn": "Hino",
  "settings.contentSync.entityTypes.system": "Sistema",
  "settings.contentSync.fullSyncFallbackLabel": "Sincronização completa do banco necessária",
  "settings.contentSync.mediaTypes.audio": "áudio",
  "settings.contentSync.mediaTypes.cover": "capa",
  "settings.contentSync.mediaTypes.coverImage": "imagem de capa",
  "settings.contentSync.mediaTypes.playback": "playback",
  "settings.contentSync.notDownloaded": "não baixado",
  "settings.contentSync.reasons.managedHymnMediaMissingLocally": "A mídia gerenciada do hino está ausente localmente.",
  "settings.contentSync.reasons.missingWithDetails": "Ausente: {{details}}",
  "settings.contentSync.reasons.remoteHymnMissingLocally": "O hino remoto está ausente localmente.",
};

const t = (key: string, options?: Record<string, unknown>): string => {
  if (key === "settings.contentSync.reasons.missingWithDetails") {
    return translations[key].replace("{{details}}", String(options?.details ?? ""));
  }

  return translations[key] ?? key;
};

describe("content sync presentation", () => {
  test("translates backend entity types and plan labels", () => {
    assert.equal(formatContentSyncEntityType("hymn", t), "Hino");
    assert.equal(
      formatContentSyncPlanItemLabel(
        {
          action: "full_sync_fallback",
          label: "Full Database Sync Required",
        },
        t,
      ),
      "Sincronização completa do banco necessária",
    );
  });

  test("translates literal backend reasons", () => {
    assert.equal(
      formatContentSyncReason("Remote hymn is missing locally.", t),
      "O hino remoto está ausente localmente.",
    );
    assert.equal(
      formatContentSyncReason("Managed hymn media is missing locally.", t),
      "A mídia gerenciada do hino está ausente localmente.",
    );
  });

  test("translates missing-file detail prefixes without losing paths", () => {
    assert.equal(
      formatContentSyncReason(
        "Missing: audio (not downloaded), cover (config/imagens/teste.webp), playback (config/playbacks/teste.mp3)",
        t,
      ),
      "Ausente: áudio (não baixado), capa (config/imagens/teste.webp), playback (config/playbacks/teste.mp3)",
    );
    assert.equal(
      formatContentSyncReason("Missing: cover image", t),
      "Ausente: imagem de capa",
    );
  });
});
