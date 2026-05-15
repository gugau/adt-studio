import { usePlatform } from "@/hooks/use-platform"
import { useWindowControls } from "@/hooks/use-window-controls";

export function MacOSTrafficLightSpacer() {
  const platform = usePlatform()
  const { available } = useWindowControls()

  if (platform !== "macos" || !available) return null

  return (
    <div aria-hidden="true" className="w-[80px] shrink-0 h-full select-none" />
  );
}
