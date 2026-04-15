import { Monitor, Tablet, Smartphone } from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type DeviceMode = "desktop" | "tablet" | "mobile"

export const DEVICE_WIDTHS: Record<DeviceMode, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
}

const DEVICES: { value: DeviceMode; icon: typeof Monitor; label: string }[] = [
  { value: "desktop", icon: Monitor, label: "Desktop" },
  { value: "tablet", icon: Tablet, label: "Tablet" },
  { value: "mobile", icon: Smartphone, label: "Mobile" },
]

export function DevicePicker({
  value,
  onChange,
}: {
  value: DeviceMode
  onChange: (value: DeviceMode) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-white/10 p-0.5">
      {DEVICES.map((device) => {
        const active = value === device.value
        return (
          <Tooltip key={device.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(device.value)}
                className={cn(
                  "relative flex items-center justify-center h-6 w-7 rounded-[4px] transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/10",
                )}
              >
                <device.icon className={cn("h-3.5 w-3.5 transition-transform duration-200", active && "scale-110")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
              {`${device.label} (${DEVICE_WIDTHS[device.value]}px)`}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
