import { logger } from "../../utils/logger";

type ScriptHandler = (tick: number) => void;

export type ScriptTaskOwner =
    | { kind: "player"; id: number }
    | { kind: "npc"; id: number }
    | { kind: "quest"; id: string };

interface ScriptTask {
    id: number;
    executeTick: number;
    repeatTicks?: number;
    owner?: ScriptTaskOwner;
    handler: ScriptHandler;
}

export class ScriptScheduler {
    private nextId = 1;
    private readonly queue: ScriptTask[] = [];

    clear(): void {
        this.queue.length = 0;
        this.nextId = 1;
    }

    scheduleAt(
        tick: number,
        handler: ScriptHandler,
        repeatTicks?: number,
        owner?: ScriptTaskOwner,
    ): number {
        const id = this.nextId++;
        const executeTick = Math.max(0, Math.floor(tick));
        this.queue.push({
            id,
            handler,
            executeTick,
            repeatTicks:
                repeatTicks !== undefined ? Math.max(1, Math.floor(repeatTicks)) : undefined,
            owner,
        });
        return id;
    }

    scheduleIn(
        currentTick: number,
        delayTicks: number,
        handler: ScriptHandler,
        owner?: ScriptTaskOwner,
    ): number {
        const targetTick = currentTick + Math.max(0, Math.floor(delayTicks));
        return this.scheduleAt(targetTick, handler, undefined, owner);
    }

    cancel(taskId: number): void {
        const idx = this.queue.findIndex((task) => task.id === taskId);
        if (idx >= 0) this.queue.splice(idx, 1);
    }

    cancelOwner(owner: ScriptTaskOwner): number {
        let removed = 0;
        for (let index = this.queue.length - 1; index >= 0; index--) {
            const taskOwner = this.queue[index].owner;
            if (taskOwner?.kind !== owner.kind || taskOwner.id !== owner.id) continue;
            this.queue.splice(index, 1);
            removed++;
        }
        return removed;
    }

    process(currentTick: number): void {
        if (this.queue.length === 0) return;
        const due: ScriptTask[] = [];
        for (let i = this.queue.length - 1; i >= 0; i--) {
            const task = this.queue[i];
            if (task.executeTick <= currentTick) {
                due.push(task);
                this.queue.splice(i, 1);
            }
        }
        if (due.length === 0) return;
        due.sort((a, b) => a.executeTick - b.executeTick || a.id - b.id);
        for (const task of due) {
            try {
                task.handler(currentTick);
            } catch (err) {
                // swallow to keep tick loop resilient
                logger.warn("[ScriptScheduler] task execution failed", err);
            }
            if (task.repeatTicks && task.repeatTicks > 0) {
                task.executeTick = currentTick + task.repeatTicks;
                this.queue.push(task);
            }
        }
    }
}
