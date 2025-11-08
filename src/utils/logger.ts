/**
 * Logger utility for BonkTools
 * Provides colored console logging with different levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface Logger {
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  setLevel(level: LogLevel | keyof typeof LogLevel): void;
  getLevel(): LogLevel;
}

// ANSI color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

/**
 * Format timestamp for logs
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format log message with color and timestamp
 */
function formatMessage(
  level: string,
  color: string,
  namespace: string,
  args: any[]
): string {
  const timestamp = `${colors.gray}[${getTimestamp()}]${colors.reset}`;
  const levelStr = `${color}${level.padEnd(5)}${colors.reset}`;
  const namespaceStr = `${colors.cyan}[${namespace}]${colors.reset}`;
  
  return `${timestamp} ${levelStr} ${namespaceStr}`;
}

/**
 * Serialize arguments for logging
 */
function serializeArgs(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') {
      return arg;
    }
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

/**
 * Create a logger instance
 */
export function createLogger(namespace: string, initialLevel: LogLevel | keyof typeof LogLevel = LogLevel.INFO): Logger {
  let currentLevel: LogLevel;
  
  // Parse initial level
  if (typeof initialLevel === 'string') {
    currentLevel = LogLevel[initialLevel as keyof typeof LogLevel];
  } else {
    currentLevel = initialLevel;
  }
  
  const logger: Logger = {
    debug(...args: any[]): void {
      if (currentLevel <= LogLevel.DEBUG) {
        const prefix = formatMessage('DEBUG', colors.gray, namespace, args);
        console.log(prefix, serializeArgs(args));
      }
    },
    
    info(...args: any[]): void {
      if (currentLevel <= LogLevel.INFO) {
        const prefix = formatMessage('INFO', colors.blue, namespace, args);
        console.log(prefix, serializeArgs(args));
      }
    },
    
    warn(...args: any[]): void {
      if (currentLevel <= LogLevel.WARN) {
        const prefix = formatMessage('WARN', colors.yellow, namespace, args);
        console.warn(prefix, serializeArgs(args));
      }
    },
    
    error(...args: any[]): void {
      if (currentLevel <= LogLevel.ERROR) {
        const prefix = formatMessage('ERROR', colors.red, namespace, args);
        console.error(prefix, serializeArgs(args));
      }
    },
    
    setLevel(level: LogLevel | keyof typeof LogLevel): void {
      if (typeof level === 'string') {
        currentLevel = LogLevel[level as keyof typeof LogLevel];
      } else {
        currentLevel = level;
      }
    },
    
    getLevel(): LogLevel {
      return currentLevel;
    }
  };
  
  return logger;
}

/**
 * Export LogLevel for convenience
 */
export const LOG_LEVELS = LogLevel;

/**
 * Default logger instance
 */
export const defaultLogger = createLogger('BonkTools');