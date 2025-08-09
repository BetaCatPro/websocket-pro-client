export declare class TaskScheduler {
    private readonly maxConcurrent;
    private readonly onTaskError?;
    private queue;
    private runningCount;
    constructor(maxConcurrent: number, onTaskError?: ((err: Error) => void) | undefined);
    add(task: () => Promise<void>, priority: number): Promise<void>;
    private run;
    clear(): void;
}
