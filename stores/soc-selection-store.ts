import { create } from "zustand";

export type SocEntityType = "session" | "device" | "user" | "fraudReport" | "beneficiary" | "cluster";

export interface SocSelection {
  type: SocEntityType;
  id: string;
  label: string;
}

interface SocSelectionState {
  selection: SocSelection | null;
  select: (selection: SocSelection) => void;
  toggle: (selection: SocSelection) => void;
  clear: () => void;
}

/**
 * The single shared "selected entity" behind the Admin SOC's cross-panel
 * synchronization: selecting a threat-map marker, a live-login row, an
 * investigation-queue item, or a government-intelligence hit all write here,
 * and every panel (including the embedded relationship graph) reads from it
 * to highlight/fly-to the same entity — this is what makes "selecting an
 * event anywhere updates every relevant panel" possible without prop
 * drilling six sibling panels through a common parent.
 */
export const useSocSelectionStore = create<SocSelectionState>((set) => ({
  selection: null,
  select: (selection) => set({ selection }),
  toggle: (selection) =>
    set((state) =>
      state.selection?.type === selection.type && state.selection.id === selection.id
        ? { selection: null }
        : { selection }
    ),
  clear: () => set({ selection: null }),
}));
