import { useAtom } from "jotai"
import { useHotkey } from "@tanstack/react-hotkeys"
import {
  dockMenuValueAtom,
  type DockMenuValue,
} from "@/shared/state/ui.atoms"

export function useDockShortcuts(): void {
  const [value, setValue] = useAtom(dockMenuValueAtom)

  const toggle = (next: DockMenuValue) =>
    setValue((prev) => (prev === next ? "" : next))

  useHotkey("X", () => toggle("toc"))
  useHotkey("A", () => toggle("settings"))
  useHotkey("L", () => toggle("language"))

  useHotkey("Escape", () => setValue(""), { enabled: value !== "" })
}
