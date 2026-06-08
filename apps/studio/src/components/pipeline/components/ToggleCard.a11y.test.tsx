// @vitest-environment jsdom
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"
import { ToggleCard } from "./ToggleCard"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("ToggleCard — accessibility", () => {
  it("has no axe violations when unchecked", async () => {
    const { container } = render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
      />
    )
    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })

  it("has no axe violations when checked", async () => {
    const { container } = render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={true}
        onCheckedChange={() => {}}
      />
    )
    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })

  it("has no axe violations when disabled", async () => {
    const { container } = render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
        disabled
      />
    )
    const results = await axe.run(container)
    expect(results.violations).toEqual([])
  })

  it("exposes role=switch with correct aria-checked", () => {
    const { rerender } = render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
      />
    )
    const el = screen.getByRole("switch", { name: "Figure extraction" })
    expect(el).toBeTruthy()
    expect(el.getAttribute("aria-checked")).toBe("false")

    rerender(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={true}
        onCheckedChange={() => {}}
      />
    )
    expect(el.getAttribute("aria-checked")).toBe("true")
  })

  it("is reachable by keyboard (tabIndex=0 when enabled)", () => {
    render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
      />
    )
    const el = screen.getByRole("switch")
    expect(el.getAttribute("tabIndex")).toBe("0")
  })

  it("is not reachable by keyboard when disabled (tabIndex=-1)", () => {
    render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
        disabled
      />
    )
    const el = screen.getByRole("switch")
    expect(el.getAttribute("tabIndex")).toBe("-1")
  })

  it("toggles on Space key press", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    )
    const el = screen.getByRole("switch")
    el.focus()
    await user.keyboard(" ")
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("toggles on Enter key press", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    )
    const el = screen.getByRole("switch")
    el.focus()
    await user.keyboard("{Enter}")
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it("does not toggle on keyboard when disabled", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={onCheckedChange}
        disabled
      />
    )
    const el = screen.getByRole("switch")
    el.focus()
    await user.keyboard(" ")
    await user.keyboard("{Enter}")
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it("decorative switch is hidden from assistive technology", () => {
    const { container } = render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
      />
    )
    // The inner BrandedSwitch is decorative — must be aria-hidden
    const hiddenSwitch = container.querySelector('[aria-hidden="true"]')
    expect(hiddenSwitch).toBeTruthy()
  })

  it("title and description are linked via aria-labelledby / aria-describedby", () => {
    render(
      <ToggleCard
        title="Figure extraction"
        description="Extract figures from the PDF"
        checked={false}
        onCheckedChange={() => {}}
      />
    )
    const el = screen.getByRole("switch")
    const labelledBy = el.getAttribute("aria-labelledby")
    const describedBy = el.getAttribute("aria-describedby")
    expect(labelledBy).toBeTruthy()
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toBe("Figure extraction")
    expect(document.getElementById(describedBy!)?.textContent).toBe("Extract figures from the PDF")
  })
})
