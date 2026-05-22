import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface IPadFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Inner screen width. Device chrome is derived proportionally. */
  screenWidth?: number
  /** Inner screen height. Default keeps the iPad Pro aspect (1366/1024). */
  screenHeight?: number
}

const STD_SCREEN_WIDTH = 1024
const STD_SCREEN_HEIGHT = 1366

/** Real-looking iPad shell — ported from lowcode-studio's ipad.tsx. */
export const IPadFrame = forwardRef<HTMLDivElement, IPadFrameProps>(
  (
    {
      children,
      className,
      screenWidth = STD_SCREEN_WIDTH,
      screenHeight = STD_SCREEN_HEIGHT,
      style,
      ...props
    },
    ref
  ) => {
    const deviceWidth = Math.round(screenWidth / 0.904)
    const deviceHeight = Math.round(screenHeight / 0.931)

    const framePadding = Math.round(deviceWidth * 0.048)

    const btnSmallWidth = Math.round(deviceWidth * 0.064)
    const btnSmallHeight = Math.round(deviceHeight * 0.003)
    const btnRightOffset = Math.round(deviceWidth * 0.071)
    const btnTopOffset = Math.round(deviceHeight * -0.003)

    const btnSideWidth = Math.round(deviceWidth * 0.004)
    const btnSideHeight = Math.round(deviceHeight * 0.041)
    const btnSideRightOffset = Math.round(deviceWidth * -0.004)
    const btnSideTopOffset = Math.round(deviceHeight * 0.081)
    const btnSideShadowOffset = Math.round(deviceHeight * 0.048)

    const sensorSize = Math.round(deviceWidth * 0.018)
    const sensorOffset = Math.round(deviceWidth * 0.054)
    const sensorTopOffset = Math.round(deviceHeight * 0.015)

    const cameraSize = Math.round(deviceWidth * 0.011)
    const cameraOffset = Math.round(deviceWidth * 0.005)
    const cameraTopOffset = Math.round(deviceHeight * 0.018)

    const frameRounded = Math.round(deviceWidth * 0.064)
    const screenRounded = Math.round(deviceWidth * 0.02)

    const cssVars = {
      "--device-width": `${deviceWidth}px`,
      "--device-height": `${deviceHeight}px`,
      "--screen-width": `${screenWidth}px`,
      "--screen-height": `${screenHeight}px`,
      "--frame-padding": `${framePadding}px`,
      "--btn-small-width": `${btnSmallWidth}px`,
      "--btn-small-height": `${btnSmallHeight}px`,
      "--btn-right-offset": `${btnRightOffset}px`,
      "--btn-top-offset": `${btnTopOffset}px`,
      "--btn-side-width": `${btnSideWidth}px`,
      "--btn-side-height": `${btnSideHeight}px`,
      "--btn-side-right-offset": `${btnSideRightOffset}px`,
      "--btn-side-top-offset": `${btnSideTopOffset}px`,
      "--btn-side-shadow-offset": `${btnSideShadowOffset}px`,
      "--sensor-size": `${sensorSize}px`,
      "--sensor-offset": `${sensorOffset}px`,
      "--sensor-top-offset": `${sensorTopOffset}px`,
      "--camera-size": `${cameraSize}px`,
      "--camera-offset": `${cameraOffset}px`,
      "--camera-top-offset": `${cameraTopOffset}px`,
      "--frame-rounded": `${frameRounded}px`,
      "--screen-rounded": `${screenRounded}px`,
      ...(style as CSSProperties | undefined),
    } as CSSProperties

    return (
      <div
        {...props}
        ref={ref}
        style={cssVars}
        className={cn(
          "inline-block relative h-[var(--device-height)] w-[var(--device-width)]",
          className
        )}
      >
        <div className="bg-[#0d0d0d] rounded-[var(--frame-rounded)] shadow-[inset_0_0_0_1px_#bfc0c1,inset_0_0_1px_3px_#e2e3e4] h-[var(--device-height)] w-[var(--device-width)] p-[var(--frame-padding)]">
          {/* Top buttons + power-side button */}
          <div className="after:content-[''] after:absolute after:bg-[#bfc0c1] after:h-[var(--btn-small-height)] after:w-[var(--btn-small-width)] after:right-[var(--btn-right-offset)] after:top-[var(--btn-top-offset)] before:content-[''] before:absolute before:bg-[#bfc0c1] before:h-[var(--btn-side-height)] before:w-[var(--btn-side-width)] before:right-[var(--btn-side-right-offset)] before:top-[var(--btn-side-top-offset)] before:shadow-[0_var(--btn-side-shadow-offset)_#bfc0c1]" />
          {/* Front camera + sensor cluster */}
          <div className="after:content-[''] after:absolute after:bg-[#1a1a1a] after:rounded-full after:h-[var(--sensor-size)] after:w-[var(--sensor-size)] after:left-1/2 after:-ml-[var(--sensor-offset)] after:top-[var(--sensor-top-offset)] before:content-[''] before:absolute before:bg-[radial-gradient(farthest-corner_at_20%_20%,#6074BF_0,transparent_40%),radial-gradient(farthest-corner_at_80%_80%,#513785_0,#24555E_20%,transparent_50%)] before:shadow-[0_0_1px_1px_rgba(255,255,255,0.05)] before:rounded-full before:h-[var(--camera-size)] before:w-[var(--camera-size)] before:left-1/2 before:-ml-[var(--camera-offset)] before:top-[var(--camera-top-offset)]" />
          {/* Screen */}
          <div className="relative border-[2px] border-[#111111] rounded-[var(--screen-rounded)] h-[var(--screen-height)] w-[var(--screen-width)] bg-white overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    )
  }
)
IPadFrame.displayName = "IPadFrame"
