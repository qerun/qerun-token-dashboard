// This file must be imported before any other code that uses window.__RUNTIME_CONFIG
// It populates window.__RUNTIME_CONFIG from Vite's import.meta.env for development

if (typeof window !== 'undefined') {
  window.__RUNTIME_CONFIG = Object.fromEntries(
    Object.entries(import.meta.env).filter(([key]) => key.startsWith(''))
  );
}