import { reportError } from './diagnostics/reportError';
// Simple centralized logger with environment guard
// Replaces scattered console.* calls and makes it easy to swap with Sentry later

const isDev = __DEV__ === true;

const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
    else reportError(args.find(value => value instanceof Error));
  },
};

export default logger;
