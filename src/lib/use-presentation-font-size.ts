import { useEffect, useState } from "react";
import { catcher } from "./catcher";
import { getPreference, setPreference } from "./store";

export const PRESENTATION_FONT_SIZE_KEY = "presentation.defaultFontSize";
export const DEFAULT_PRESENTATION_FONT_SIZE = 48;

/** Read-only hook: returns the global presentation font size (async loaded from plugin-store). */
export function usePresentationFontSize(): number {
  const [size, setSize] = useState(DEFAULT_PRESENTATION_FONT_SIZE);
  useEffect(() => {
    void catcher(
      getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
    ).then(([saved]) => {
      if (saved != null) setSize(saved);
    });
  }, []);
  return size;
}

/** Read-write hook for the settings UI. */
export function usePresentationFontSizeSetting() {
  const [fontSize, setFontSize] = useState(DEFAULT_PRESENTATION_FONT_SIZE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [saved] = await catcher(
        getPreference<number>(PRESENTATION_FONT_SIZE_KEY, DEFAULT_PRESENTATION_FONT_SIZE),
      );
      if (saved != null) setFontSize(saved);
      setLoaded(true);
    };
    void load();
  }, []);

  const updateFontSize = (val: number) => {
    setFontSize(val);
    void catcher(setPreference(PRESENTATION_FONT_SIZE_KEY, val));
  };

  return { fontSize, updateFontSize, loaded };
}
