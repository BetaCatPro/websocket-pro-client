export type LogLevel = "debug" | "info" | "warn" | "error";
export interface Logger {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
}
export declare const getLogger: () => Logger;
export declare const setLogger: (logger: Logger) => void;
