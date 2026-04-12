import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ServiceRoute from "../service";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "remote.service.start": "Start service",
        "remote.service.stop": "Stop service",
        "remote.service.next_item": "Next item",
        "remote.service.prev_item": "Previous item",
        "remote.service.no_service": "No active service",
        "remote.service.item_count": "items",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockSend = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn().mockReturnValue(() => {});

vi.mock("@/stores/connection-store", () => ({
  useConnectionStore: (selector: (s: unknown) => unknown) =>
    selector({
      wsState: "connected",
      ws: { send: mockSend, on: mockOn },
    }),
}));

describe("ServiceRoute — G4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows no-service state when no service.state event received", () => {
    render(<ServiceRoute />);
    expect(screen.getByText("No active service")).toBeInTheDocument();
  });

  it("shows service title and items when service.state fires", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "service.state") handler = h;
      return () => {};
    });

    render(<ServiceRoute />);

    await act(async () => {
      handler?.({
        title: "Sunday Worship",
        activeIndex: 0,
        items: [
          { id: "i1", title: "Opening Prayer", type: "annotation" },
          { id: "i2", title: "Amazing Grace", type: "hymn" },
          { id: "i3", title: "Sermon", type: "annotation" },
        ],
      });
    });

    expect(screen.getByText("Sunday Worship")).toBeInTheDocument();
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
  });

  it("highlights active item", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "service.state") handler = h;
      return () => {};
    });

    render(<ServiceRoute />);

    await act(async () => {
      handler?.({
        title: "Sunday Worship",
        activeIndex: 1,
        items: [
          { id: "i1", title: "Opening Prayer", type: "annotation" },
          { id: "i2", title: "Amazing Grace", type: "hymn" },
        ],
      });
    });

    const activeItem = screen.getByText("Amazing Grace").closest("[data-active='true']");
    expect(activeItem).toBeInTheDocument();
  });

  it("clicking an item sends service.goto command", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "service.state") handler = h;
      return () => {};
    });

    render(<ServiceRoute />);

    await act(async () => {
      handler?.({
        title: "Sunday",
        activeIndex: 0,
        items: [{ id: "i1", title: "Amazing Grace", type: "hymn" }],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Amazing Grace"));
    });

    expect(mockSend).toHaveBeenCalledWith("service.goto", { index: 0 });
  });

  it("Stop service button sends service.stop command", async () => {
    let handler: ((payload: unknown) => void) | null = null;
    mockOn.mockImplementation((op: string, h: (payload: unknown) => void) => {
      if (op === "service.state") handler = h;
      return () => {};
    });

    render(<ServiceRoute />);

    await act(async () => {
      handler?.({
        title: "Sunday",
        activeIndex: 0,
        items: [{ id: "i1", title: "Amazing Grace", type: "hymn" }],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop service/i }));
    });

    expect(mockSend).toHaveBeenCalledWith("service.stop", {});
  });
});
