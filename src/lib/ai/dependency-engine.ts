import type { Task } from "@/types/app.types";

export class DependencyEngine {
  /**
   * Detects if adding a dependency would create a circular reference cycle (deadlock).
   * Returns true if a cycle is found.
   */
  static hasCycle(
    taskId: string,
    dependencyTitles: string[],
    allTasks: Task[]
  ): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const taskMap = new Map<string, Task>();
    const titleMap = new Map<string, Task>();
    
    for (const t of allTasks) {
      taskMap.set(t.id, t);
      titleMap.set(t.title.toLowerCase().trim(), t);
    }

    const check = (currId: string): boolean => {
      if (stack.has(currId)) return true;
      if (visited.has(currId)) return false;

      visited.add(currId);
      stack.add(currId);

      const task = taskMap.get(currId);
      if (task) {
        const deps = (task.dependencies as string[]) || [];
        for (const depTitle of deps) {
          const depTask = titleMap.get(depTitle.toLowerCase().trim());
          if (depTask) {
            if (check(depTask.id)) return true;
          }
        }
      }

      stack.delete(currId);
      return false;
    };

    // Temporarily inject the proposed dependencies into a mock state
    const currentTask = taskMap.get(taskId);
    if (currentTask) {
      const originalDeps = currentTask.dependencies;
      currentTask.dependencies = dependencyTitles;
      const isCycle = check(taskId);
      currentTask.dependencies = originalDeps; // Restore original state
      return isCycle;
    }

    return false;
  }

  /**
   * Recalculates task priority scores based on dependency critical paths.
   * If a task blocks 3 other high-priority tasks, its priority score is boosted!
   */
  static recalibratePriorities(allTasks: Task[]): Array<{ id: string; priority_score: number }> {
    const taskMap = new Map<string, Task>();
    const titleMap = new Map<string, Task>();
    const blockingCount = new Map<string, number>(); // How many tasks depend on this task ID

    for (const t of allTasks) {
      taskMap.set(t.id, t);
      titleMap.set(t.title.toLowerCase().trim(), t);
      blockingCount.set(t.id, 0);
    }

    // Calculate blocking weights
    for (const t of allTasks) {
      const deps = (t.dependencies as string[]) || [];
      for (const depTitle of deps) {
        const parentTask = titleMap.get(depTitle.toLowerCase().trim());
        if (parentTask) {
          blockingCount.set(parentTask.id, (blockingCount.get(parentTask.id) || 0) + 1);
        }
      }
    }

    // Calibrate scores: Boost priority score of tasks that block other tasks
    return allTasks.map((t) => {
      const currentScore = Number(t.priority_score) || 50;
      const blocksCount = blockingCount.get(t.id) || 0;
      
      // Boost score by 15 points per blocked task, capped at 100
      const boostedScore = Math.min(100, Math.max(0, Math.round(currentScore + blocksCount * 15)));
      
      return {
        id: t.id,
        priority_score: boostedScore,
      };
    });
  }
}
