"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class Logger {
    static formatMessage(level, message) {
        const timestamp = chalk_1.default.gray(new Date().toISOString());
        const prefix = chalk_1.default.bold("[bonktools]");
        let levelColor;
        switch (level) {
            case "DEBUG":
                levelColor = chalk_1.default.cyan(`[${level}]`);
                break;
            case "INFO":
                levelColor = chalk_1.default.green(`[${level}]`);
                break;
            case "WARN":
                levelColor = chalk_1.default.yellow(`[${level}]`);
                break;
            case "ERROR":
                levelColor = chalk_1.default.red(`[${level}]`);
                break;
            default:
                levelColor = chalk_1.default.white(`[${level}]`);
                break;
        }
        return `${timestamp} ${prefix} ${levelColor} ${message}`;
    }
    static debug(message) {
        console.debug(this.formatMessage("DEBUG", message));
    }
    static info(message) {
        console.log(this.formatMessage("INFO", message));
    }
    static warn(message) {
        console.warn(this.formatMessage("WARN", message));
    }
    static error(message, error) {
        console.error(this.formatMessage("ERROR", message));
        if (error) {
            console.error(chalk_1.default.redBright(error instanceof Error ? error.stack : String(error)));
        }
    }
}
exports.Logger = Logger;
