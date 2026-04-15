import { useReducer, useCallback } from "react";
import type { PopupState, PopupAction } from "./popup-types";

const MAX_UNDO = 50;

const INITIAL_STATE: PopupState = {
  latex: "",
  undoStack: [],
  redoStack: [],
  activePanel: "symbols",
  activeTab: "formula",
  commandPaletteOpen: false,
};

function popupReducer(state: PopupState, action: PopupAction): PopupState {
  switch (action.type) {
    case "SET_LATEX": {
      if (action.latex === state.latex) return state;
      const undoStack = [state.latex, ...state.undoStack].slice(0, MAX_UNDO);
      return { ...state, latex: action.latex, undoStack, redoStack: [] };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const [prev, ...rest] = state.undoStack;
      return {
        ...state,
        latex: prev,
        undoStack: rest,
        redoStack: [state.latex, ...state.redoStack],
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const [next, ...rest] = state.redoStack;
      return {
        ...state,
        latex: next,
        redoStack: rest,
        undoStack: [state.latex, ...state.undoStack],
      };
    }
    case "TOGGLE_PANEL": {
      const activePanel = state.activePanel === action.panel ? null : action.panel;
      return { ...state, activePanel };
    }
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_COMMAND_PALETTE":
      return { ...state, commandPaletteOpen: action.open };
    case "RESET":
      return { ...INITIAL_STATE, latex: action.initialLatex };
  }
}

export function usePopupState(initialLatex: string) {
  const [state, dispatch] = useReducer(popupReducer, {
    ...INITIAL_STATE,
    latex: initialLatex,
  });

  const setLatex = useCallback((latex: string) => {
    dispatch({ type: "SET_LATEX", latex });
  }, []);

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const reset = useCallback((latex: string) => {
    dispatch({ type: "RESET", initialLatex: latex });
  }, []);

  return { state, dispatch, setLatex, undo, redo, reset } as const;
}
