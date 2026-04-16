import { describe, test } from "node:test";
import { strict as assert } from "node:assert";

import {
  buildHymnSlides,
  buildVisibleHymnLyricItems,
} from "../../src/lib/hymn-slides";

const lyricsSync = JSON.stringify([
  {
    lyric: "Santo, santo, santo!\r\nDeus onipotente!",
    order: 1,
    time: "00:00:09",
    instrumental_time: "00:00:09",
    show_slide: 1,
  },
  {
    lyric: "Cedo de manhã\r\ncantaremos Teu louvor",
    order: 2,
    time: "00:00:20",
    instrumental_time: "00:00:20",
    show_slide: 1,
  },
  {
    lyric: "Santo, santo, santo!\r\nDeus Jeová triúno!",
    order: 3,
    time: "00:00:29",
    instrumental_time: "00:00:29",
    show_slide: 1,
  },
  {
    lyric: "És Deus excelso\r\nnosso Criador",
    order: 4,
    time: "00:00:39",
    instrumental_time: "00:00:39",
    show_slide: 1,
  },
  {
    lyric: "",
    order: 5,
    time: "00:00:00",
    instrumental_time: "00:00:00",
    show_slide: 0,
  },
  {
    lyric: "Santo, santo, santo!\r\nNós, os pecadores",
    order: 6,
    time: "00:00:49",
    instrumental_time: "00:00:49",
    show_slide: 1,
  },
]);

describe("hymn slide builder", () => {
  test("preserves ordered blank API items as cover-only slides", () => {
    const slides = buildHymnSlides({
      title: "Santo, Santo, Santo",
      lyrics:
        "Santo, santo, santo!\nDeus onipotente!\n\nCedo de manhã\ncantaremos Teu louvor\n\nSanto, santo, santo!\nDeus Jeová triúno!\n\nÉs Deus excelso\nnosso Criador\n\nSanto, santo, santo!\nNós, os pecadores",
      album: "HASD",
      coverPath: "cover.jpg",
      lyricsSync,
    });

    assert.equal(slides.length, 8, "cover + 6 ordered items + pause");
    assert.equal(slides[0]?.slideType, "cover");
    assert.equal(slides[5]?.slideType, "text", "order 5 gap should be a blank cover slide");
    assert.equal(slides[5]?.content, "");
    assert.equal(slides[5]?.background?.imagePath, "cover.jpg");
    assert.equal(slides[6]?.text, "Santo, santo, santo!\r\nNós, os pecadores");
  });

  test("keeps clickable visible lyrics aligned with real slide indexes", () => {
    const items = buildVisibleHymnLyricItems({
      lyrics:
        "Santo, santo, santo!\nDeus onipotente!\n\nCedo de manhã\ncantaremos Teu louvor\n\nSanto, santo, santo!\nDeus Jeová triúno!\n\nÉs Deus excelso\nnosso Criador\n\nSanto, santo, santo!\nNós, os pecadores",
      lyricsSync,
    });

    assert.deepEqual(
      items.map((item) => ({ slideIndex: item.slideIndex, text: item.text })),
      [
        { slideIndex: 1, text: "Santo, santo, santo!\r\nDeus onipotente!" },
        { slideIndex: 2, text: "Cedo de manhã\r\ncantaremos Teu louvor" },
        { slideIndex: 3, text: "Santo, santo, santo!\r\nDeus Jeová triúno!" },
        { slideIndex: 4, text: "És Deus excelso\r\nnosso Criador" },
        { slideIndex: 6, text: "Santo, santo, santo!\r\nNós, os pecadores" },
      ],
    );
  });
});
