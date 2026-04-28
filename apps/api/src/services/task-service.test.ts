import { describe, expect, it } from "vitest"
import { createBookEventBus, type BookSSEEvent } from "./book-event-bus.js"
import { createTaskService } from "./task-service.js"

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("task-service", () => {
  it("stores progress updates on active tasks", async () => {
    const eventBus = createBookEventBus()
    const taskService = createTaskService(eventBus)
    const events: BookSSEEvent[] = []
    let finishTask!: () => void

    eventBus.addListener("book-one", (event) => events.push(event))

    const { taskId } = taskService.submitTask(
      "book-one",
      "translation-evaluation",
      "Running translation evaluation for es-ES",
      async (emitProgress) => {
        emitProgress("Evaluated 5 of 10 entries", 60)
        await new Promise<void>((resolve) => {
          finishTask = resolve
        })
      },
    )

    await nextTick()

    expect(taskService.getActiveTasks("book-one")).toEqual([
      expect.objectContaining({
        taskId,
        progressMessage: "Evaluated 5 of 10 entries",
        progressPercent: 60,
      }),
    ])
    expect(events).toContainEqual({
      type: "task",
      data: {
        type: "task-progress",
        taskId,
        message: "Evaluated 5 of 10 entries",
        percent: 60,
      },
    })

    finishTask()
    await nextTick()
  })
})
