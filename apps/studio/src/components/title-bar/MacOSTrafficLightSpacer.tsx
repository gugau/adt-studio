import { usePlatform } from "@/hooks/use-platform"

export function MacOSTrafficLightSpacer() {
  const platform = usePlatform()

  if (platform !== "macos") return null

  return (
    <div aria-hidden="true" className="w-[80px] shrink-0 h-full select-none" />
  );
}
