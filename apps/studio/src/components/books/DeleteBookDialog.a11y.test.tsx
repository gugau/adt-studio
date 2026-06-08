// @vitest-environment jsdom
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { DeleteBookDialog } from "./DeleteBookDialog"

// ── Lingui mock ───────────────────────────────────────────────────────────────
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderOpen(overrides?: Partial<React.ComponentProps<typeof DeleteBookDialog>>) {
  return render(
    <DeleteBookDialog
      label="my-book"
      onConfirm={() => {}}
      onCancel={() => {}}
      isPending={false}
      {...overrides}
    />
  )
}

describe("DeleteBookDialog — accessibility", () => {
  it("has no axe violations when open", async () => {
    const { baseElement } = renderOpen()
    // Radix portals render into document.body, so audit baseElement
    const results = await axe.run(baseElement, {
      rules: {
        // color-contrast needs computed styles not available in jsdom
        "color-contrast": { enabled: false },
      },
    })
    expect(results.violations).toEqual([])
  })

  it("has no axe violations when isPending", async () => {
    const { baseElement } = renderOpen({ isPending: true })
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    })
    expect(results.violations).toEqual([])
  })

  it("renders with role=dialog and an accessible name", async () => {
    renderOpen()
    await waitFor(() => {
      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeTruthy()
      // The accessible name comes from DialogTitle via aria-labelledby
      const name = dialog.getAttribute("aria-labelledby")
      expect(name).toBeTruthy()
      expect(document.getElementById(name!)?.textContent).toContain("Delete book")
    })
  })

  it("both action buttons are reachable by keyboard", async () => {
    renderOpen()
    await waitFor(() => {
      const cancel = screen.getByRole("button", { name: /cancel/i })
      const confirm = screen.getByRole("button", { name: /delete/i })
      expect(cancel.getAttribute("tabIndex")).not.toBe("-1")
      expect(confirm.getAttribute("tabIndex")).not.toBe("-1")
    })
  })

  it("buttons are disabled and still announced when isPending", async () => {
    renderOpen({ isPending: true })
    await waitFor(() => {
      const cancel = screen.getByRole("button", { name: /cancel/i })
      expect(cancel).toHaveProperty("disabled", true)
      // Confirm button label changes to "Deleting..." for screen readers
      const deleting = screen.getByRole("button", { name: /deleting/i })
      expect(deleting).toBeTruthy()
    })
  })

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderOpen({ onCancel })
    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalled()
  })

  it("calls onConfirm when Delete button is clicked", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderOpen({ onConfirm })
    await waitFor(() => screen.getByRole("button", { name: /delete/i }))
    await user.click(screen.getByRole("button", { name: /delete/i }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it("does not render when label is null", () => {
    render(
      <DeleteBookDialog
        label={null}
        onConfirm={() => {}}
        onCancel={() => {}}
        isPending={false}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
