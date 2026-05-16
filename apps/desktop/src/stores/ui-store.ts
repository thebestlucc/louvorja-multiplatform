import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  activePanel: string | null;
  modals: Record<string, boolean>;
  expandedNavItems: Record<string, boolean>;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  setActivePanel: (id: string | null) => void;
  toggleNavItem: (to: string) => void;
  setNavItemExpanded: (to: string, expanded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 240,
  activePanel: null,
  modals: {},
  expandedNavItems: {},
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  openModal: (id) => set((s) => ({ modals: { ...s.modals, [id]: true } })),
  closeModal: (id) => set((s) => ({ modals: { ...s.modals, [id]: false } })),
  setActivePanel: (id) => set({ activePanel: id }),
  toggleNavItem: (to) =>
    set((s) => ({
      expandedNavItems: { ...s.expandedNavItems, [to]: !s.expandedNavItems[to] },
    })),
  setNavItemExpanded: (to, expanded) =>
    set((s) => ({
      expandedNavItems: { ...s.expandedNavItems, [to]: expanded },
    })),
}));
