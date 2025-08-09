import { Task } from "../types";

export class TaskScheduler {
  private queue: Task[] = [];
  private runningCount = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly onTaskError?: (err: Error) => void
  ) {}

  add(task: () => Promise<void>, priority: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          await task();
          resolve();
        } catch (err) {
          this.onTaskError?.(err as Error);
          reject(err);
        }
      };

      this.queue.push({ task: wrappedTask, priority });
      this.queue.sort((a, b) => b.priority - a.priority); // 降序排列
      this.run();
    });
  }

  private run(): void {
    while (this.runningCount < this.maxConcurrent && this.queue.length > 0) {
      const { task } = this.queue.shift()!;
      this.runningCount++;

      task().finally(() => {
        this.runningCount--;
        this.run();
      });
    }
  }

  clear(): void {
    this.queue = [];
  }
}
