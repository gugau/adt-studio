import { MacOSTrafficLightSpacer } from "./MacOSTrafficLightSpacer";
import { LinuxControls } from "./LinuxControls";
import { WindowsControls } from "./WindowsControls";
import { cn } from "@/lib/utils";

interface TitleBarControls {
  className?: string;
}
export function TitleBarControls(props: TitleBarControls) {
  return (
    <>
      <LinuxControls className={cn("self-stretch", props.className)} />
      <WindowsControls
        variant="light"
        className={cn("self-stretch", props.className)}
      />
    </>
  );
}
