import "@testing-library/jest-dom";
import { vi } from "vitest";

// jsdom doesn't implement the Web Animations API
Element.prototype.animate = vi.fn(() => ({
  cancel: vi.fn(),
  finished: Promise.resolve(),
  play: vi.fn(),
  pause: vi.fn(),
})) as unknown as typeof Element.prototype.animate;

// jsdom doesn't implement navigator.vibrate
Object.defineProperty(navigator, "vibrate", {
  value: vi.fn(),
  writable: true,
});
