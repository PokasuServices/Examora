"use client";

import * as React from "react";

/**
 * The practice paper a sketch is being viewed in. The same sketch question
 * can carry different marks in different papers, so sketch API calls pass it
 * along and totals come back in that paper's marks.
 */
const SketchPaperContext = React.createContext<string | undefined>(undefined);

export const SketchPaperProvider = SketchPaperContext.Provider;

export function useSketchPaper(): string | undefined {
  return React.useContext(SketchPaperContext);
}
