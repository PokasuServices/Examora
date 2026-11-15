/**
 * Theme constants shared by the root layout (server) and ThemeProvider
 * (client) — kept out of the "use client" module so the server layout
 * receives the real string, not a client reference.
 */
export const THEME_STORAGE_KEY = "theme";

/** Inline <head> script — applies a saved dark theme before first paint (no light flash on reload). */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
