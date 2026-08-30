import { createContext } from 'preact';

/**
 * Application context shared across all components.
 * Provides campaign data, annotation operations, map engine reference, and app state.
 */
export const AppContext = createContext(null);
