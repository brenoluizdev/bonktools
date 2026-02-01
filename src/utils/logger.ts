import chalk from "chalk";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export class Logger {
  private static formatMessage(level: LogLevel, message: string): string {
    const timestamp = chalk.gray(new Date().toLocaleTimeString("pt-BR"));
    const prefix = chalk.bold("[bonkbot]");

    let levelColor: string;
    switch (level) {
      case "DEBUG":
        levelColor = chalk.cyan(`[${level}]`);
        break;
      case "INFO":
        levelColor = chalk.green(`[${level}]`);
        break;
      case "WARN":
        levelColor = chalk.yellow(`[${level}]`);
        break;
      case "ERROR":
        levelColor = chalk.red(`[${level}]`);
        break;
      default:
        levelColor = chalk.white(`[${level}]`);
        break;
    }

    return `${timestamp} ${prefix} ${levelColor} ${message}`;
  }

  static debug(message: string): void {
    console.debug(this.formatMessage("DEBUG", message));
  }

  static info(message: string): void {
    console.log(this.formatMessage("INFO", message));
  }

  static warn(message: string): void {
    console.warn(this.formatMessage("WARN", message));
  }

  static error(message: string, error?: unknown): void {
    console.error(this.formatMessage("ERROR", message));
    if (error) {
      console.error(chalk.redBright(error instanceof Error ? error.stack : String(error)));
    }
  }
}
