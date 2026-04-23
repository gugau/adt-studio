import { usePlatform } from "@/hooks/use-platform"
import { useWindowControls } from "@/hooks/use-window-controls"
import { MacOSTrafficLightSpacer } from "./MacOSTrafficLightSpacer";
import { LinuxControls } from "./LinuxControls";
import { WindowsControls } from "./WindowsControls";
import { cn } from "@/lib/utils";


interface TitleBarControls {
  className?: string
}
export function TitleBarControls(props: TitleBarControls) {
  const { available } = useWindowControls();
  const platform = usePlatform();

  if (!available) return null;

  if (platform === "macos") return <MacOSTrafficLightSpacer />;
  if (platform === "linux")
    return (
      <>
        <div className="flex-1" />
        <LinuxControls className={cn("self-stretch pr-3", props.className)}  />
      </>
    );
  if (platform === "windows")
    return <WindowsControls className={cn("self-stretch", props.className)} />;

  return null;
}
