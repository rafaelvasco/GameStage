import { Color } from "../graphics/Color";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  prefix?: string;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private loggedOnceMessages: Set<string> = new Set();

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableColors: true,
      enableTimestamps: true,
      ...config,
    };
  }

  /**
   * Get the singleton Logger instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable or disable colored output
   */
  setColorsEnabled(enabled: boolean): void {
    this.config.enableColors = enabled;
  }

  /**
   * Enable or disable timestamps
   */
  setTimestampsEnabled(enabled: boolean): void {
    this.config.enableTimestamps = enabled;
  }

  /**
   * Set a prefix for all log messages
   */
  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }

  /**
   * Log a debug message
   */
  debug(message: string, color?: Color): void {
    this.log(LogLevel.DEBUG, message, color || Color.fromHex("#888888"));
  }

  /**
   * Log an info message
   */
  info(message: string, color?: Color): void {
    this.log(LogLevel.INFO, message, color || Color.fromHex("#00AAFF"));
  }

  /**
   * Log a warning message
   */
  warn(message: string, color?: Color): void {
    this.log(LogLevel.WARN, message, color || Color.fromHex("#FFAA00"));
  }

  /**
   * Log an error message
   */
  error(message: string, color?: Color): void {
    this.log(LogLevel.ERROR, message, color || Color.fromHex("#FF4444"));
  }

  /**
   * Log a success message
   */
  success(message: string, color?: Color): void {
    this.log(LogLevel.INFO, message, color || Color.fromHex("#44FF44"));
  }

  /**
   * Log a message with custom color
   */
  paint(message: string, color: Color, level: LogLevel = LogLevel.INFO): void {
    this.log(level, message, color);
  }

  /**
   * Log a debug message only once per unique message
   */
  debugOnce(message: string, color?: Color): void {
    if (!this.loggedOnceMessages.has(message)) {
      this.loggedOnceMessages.add(message);
      this.debug(message, color);
    }
  }

  /**
   * Log an info message only once per unique message
   */
  infoOnce(message: string, color?: Color): void {
    if (!this.loggedOnceMessages.has(message)) {
      this.loggedOnceMessages.add(message);
      this.info(message, color);
    }
  }

  /**
   * Log an error message only once per unique message
   */
  errorOnce(message: string, color?: Color): void {
    if (!this.loggedOnceMessages.has(message)) {
      this.loggedOnceMessages.add(message);
      this.error(message, color);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, color?: Color): void {
    if (level < this.config.level) {
      return;
    }

    let formattedMessage = "";

    // Add timestamp
    if (this.config.enableTimestamps) {
      const timestamp = new Date().toISOString();
      formattedMessage += `[${timestamp}] `;
    }

    // Add prefix
    if (this.config.prefix) {
      formattedMessage += `[${this.config.prefix}] `;
    }

    // Add level
    formattedMessage += `[${LogLevel[level]}] `;

    // Add message
    formattedMessage += message;

    // Output with or without color
    if (this.config.enableColors && color) {
      this.outputColoredMessage(formattedMessage, color, level);
    } else {
      this.outputPlainMessage(formattedMessage, level);
    }
  }

  /**
   * Output a colored message to console
   */
  private outputColoredMessage(
    message: string,
    color: Color,
    level: LogLevel
  ): void {
    const cssColor = color.toHex();
    const styles = [`color: ${cssColor}`, "font-weight: normal"];

    // Add additional styling based on log level
    switch (level) {
      case LogLevel.ERROR:
        styles.push("font-weight: bold");
        break;
      case LogLevel.WARN:
        styles.push("font-weight: bold");
        break;
      case LogLevel.DEBUG:
        styles.push("font-style: italic");
        break;
    }

    console.log(`%c${message}`, styles.join("; "));
  }

  /**
   * Output a plain message to console
   */
  private outputPlainMessage(message: string, level: LogLevel): void {
    switch (level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      default:
        console.log(message);
        break;
    }
  }

  /**
   * Create a group of related log messages
   */
  group(title: string, color?: Color): void {
    if (this.config.enableColors && color) {
      console.group(`%c${title}`, `color: ${color.toHex()}; font-weight: bold`);
    } else {
      console.group(title);
    }
  }

  /**
   * End a log group
   */
  groupEnd(): void {
    console.groupEnd();
  }

  /**
   * Create a collapsed group of related log messages
   */
  groupCollapsed(title: string, color?: Color): void {
    if (this.config.enableColors && color) {
      console.groupCollapsed(
        `%c${title}`,
        `color: ${color.toHex()}; font-weight: bold`
      );
    } else {
      console.groupCollapsed(title);
    }
  }

  /**
   * Log a table of data
   */
  table(data: any, color?: Color): void {
    if (this.config.level <= LogLevel.INFO) {
      if (this.config.enableColors && color) {
        console.log(
          `%cTable Data:`,
          `color: ${color.toHex()}; font-weight: bold`
        );
      }
      console.table(data);
    }
  }

  /**
   * Clear the console
   */
  clear(): void {
    console.clear();
  }

  /**
   * Clear the one-time message cache
   */
  clearOnceCache(): void {
    this.loggedOnceMessages.clear();
  }

  /**
   * Log performance timing
   */
  time(label: string): void {
    console.time(label);
  }

  /**
   * End performance timing
   */
  timeEnd(label: string): void {
    console.timeEnd(label);
  }

  /**
   * Log performance timing without ending
   */
  timeLog(label: string, ...data: any[]): void {
    console.timeLog(label, ...data);
  }

  /**
   * Assert a condition and log if false
   */
  assert(condition: boolean, message: string, color?: Color): void {
    if (!condition) {
      this.error(`Assertion failed: ${message}`, color);
    }
  }

  /**
   * Count occurrences of a label
   */
  count(label: string = "default"): void {
    console.count(label);
  }

  /**
   * Reset count for a label
   */
  countReset(label: string = "default"): void {
    console.countReset(label);
  }

  /**
   * Create a trace of the call stack
   */
  trace(message?: string, color?: Color): void {
    if (this.config.level <= LogLevel.DEBUG) {
      if (message) {
        if (this.config.enableColors && color) {
          console.log(`%c${message}`, `color: ${color.toHex()}`);
        } else {
          console.log(message);
        }
      }
      console.trace();
    }
  }
}

// Export a default logger instance for convenience
export const logger = Logger.getInstance();

// Export some common color presets for logging
export const LogColors = {
  DEBUG: Color.fromHex("#888888"),
  INFO: Color.fromHex("#00AAFF"),
  WARN: Color.fromHex("#FFAA00"),
  ERROR: Color.fromHex("#FF4444"),
  SUCCESS: Color.fromHex("#44FF44"),
  PURPLE: Color.fromHex("#AA44FF"),
  CYAN: Color.fromHex("#44FFFF"),
  PINK: Color.fromHex("#FF44AA"),
  ORANGE: Color.fromHex("#FF8844"),
  LIME: Color.fromHex("#88FF44"),
};
