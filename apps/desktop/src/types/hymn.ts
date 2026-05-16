import type { Hymn, Album, HymnWriteInput } from "../lib/bindings";

export type { Hymn, Album, HymnWriteInput };

export interface HymnSearchResult {
  hymn: Hymn;
  highlight: string;
}
