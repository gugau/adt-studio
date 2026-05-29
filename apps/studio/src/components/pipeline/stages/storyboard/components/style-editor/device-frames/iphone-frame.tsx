import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface IPhoneFrameProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Outer chrome width. Height is derived proportionally (iPhone 14 Pro ratio). */
  width?: number
}

// iPhone 14 Pro reference — ported from lowcode-studio's iphone.tsx.
const STD_WIDTH = 428
const STD_HEIGHT = 868

/** Real-looking iPhone shell. Renders the screen as `children`. */
export const IPhoneFrame = forwardRef<HTMLDivElement, IPhoneFrameProps>(
  ({ children, className, width = STD_WIDTH, style, ...props }, ref) => {
    const ratio = STD_HEIGHT / STD_WIDTH
    const height = Math.round(width * ratio)

    const screenWidth = Math.round(width * 0.911)
    const screenHeight = Math.round(height * 0.956)

    const islandWidth = Math.round(width * 0.28)
    const islandHeight = Math.round(height * 0.04)
    const islandLeft = Math.round(islandWidth / 2)
    const islandTop = Math.round(height * 0.033)

    const sensorSize = Math.round(width * 0.021)
    const sensorXOffset = Math.round(width * 0.084)
    const sensorYOffset = Math.round(height * 0.048)

    const camWidth = Math.round(width * 0.173)
    const camHeight = Math.round(height * 0.038)
    const camXOffset = Math.round(camWidth / 2) + Math.round(width * 0.047)
    const camYOffset = Math.round(height * 0.035)

    const btnWidth = Math.round(width * 0.007)
    const btnSmallHeight = Math.round(height * 0.037)
    const btnMediumHeight = Math.round(height * 0.071)
    const btnLargeHeight = Math.round(height * 0.115)

    const btnTopPosition = Math.round(height * 0.132)
    const btnMediumOffset = Math.round(height * 0.069)
    const btnLargeOffset = Math.round(height * 0.161)
    const powerTopPosition = Math.round(height * 0.23)

    const framePadding = Math.round(width * 0.044)

    const homeIndicatorSize = Math.round(width * 0.014)
    const homeIndicatorOffset = Math.round(width * 0.201)
    const homeIndicatorBorderWidth = Math.round(height * 0.007)

    const frameRounded = Math.round(width * 0.159)
    const islandRounded = Math.round(width * 0.047)
    const camRounded = Math.round(width * 0.04)
    const screenRounded = Math.round(width * 0.114)
    const btnRounded = Math.round(width * 0.005)

    const frameShadowSize = Math.round(width * 0.009)
    const frameBorderSize = Math.round(width * 0.014)

    const btnLeftOffset = Math.round(width * -0.005)
    const btnRightOffset = Math.round(width * -0.005)

    const cssVars = {
      "--width": `${width}px`,
      "--height": `${height}px`,
      "--screen-width": `${screenWidth}px`,
      "--screen-height": `${screenHeight}px`,
      "--island-width": `${islandWidth}px`,
      "--island-height": `${islandHeight}px`,
      "--island-left": `${islandLeft}px`,
      "--island-top": `${islandTop}px`,
      "--sensor-size": `${sensorSize}px`,
      "--sensor-x-offset": `${sensorXOffset}px`,
      "--sensor-y-offset": `${sensorYOffset}px`,
      "--cam-width": `${camWidth}px`,
      "--cam-height": `${camHeight}px`,
      "--cam-x-offset": `${camXOffset}px`,
      "--cam-y-offset": `${camYOffset}px`,
      "--btn-width": `${btnWidth}px`,
      "--btn-small-height": `${btnSmallHeight}px`,
      "--btn-medium-height": `${btnMediumHeight}px`,
      "--btn-large-height": `${btnLargeHeight}px`,
      "--btn-top-position": `${btnTopPosition}px`,
      "--btn-medium-offset": `${btnMediumOffset}px`,
      "--btn-large-offset": `${btnLargeOffset}px`,
      "--power-top-position": `${powerTopPosition}px`,
      "--frame-padding": `${framePadding}px`,
      "--home-indicator-size": `${homeIndicatorSize}px`,
      "--home-indicator-offset": `${homeIndicatorOffset}px`,
      "--home-indicator-border-width": `${homeIndicatorBorderWidth}px`,
      "--frame-rounded": `${frameRounded}px`,
      "--island-rounded": `${islandRounded}px`,
      "--cam-rounded": `${camRounded}px`,
      "--screen-rounded": `${screenRounded}px`,
      "--btn-rounded": `${btnRounded}px`,
      "--frame-shadow-size": `${frameShadowSize}px`,
      "--frame-border-size": `${frameBorderSize}px`,
      "--btn-left-offset": `${btnLeftOffset}px`,
      "--btn-right-offset": `${btnRightOffset}px`,
      ...(style as CSSProperties | undefined),
    } as CSSProperties

    return (
      <div
        {...props}
        ref={ref}
        style={cssVars}
        className={cn(
          "inline-block relative h-[var(--height)] w-[var(--width)]",
          className
        )}
      >
        <div className="bg-[#010101] border border-[#2b2433] rounded-[var(--frame-rounded)] shadow-[inset_0_0_var(--frame-shadow-size)_#8c7fa9,inset_0_0_0_var(--frame-border-size)_#342C3F] h-[var(--height)] w-[var(--width)] p-[var(--frame-padding)]">
          {/* Side buttons (silent + volume up + volume down) */}
          <div className="bg-[#2b2433] rounded-[var(--btn-rounded)] h-[var(--btn-small-height)] w-[var(--btn-width)] absolute left-[var(--btn-left-offset)] top-[var(--btn-top-position)] after:content-[''] after:absolute after:bg-[#2b2433] after:rounded-[var(--btn-rounded)] after:h-[var(--btn-medium-height)] after:w-[var(--btn-width)] after:left-0 after:top-[var(--btn-medium-offset)] before:content-[''] before:absolute before:bg-[#2b2433] before:rounded-[var(--btn-rounded)] before:h-[var(--btn-medium-height)] before:w-[var(--btn-width)] before:left-0 before:top-[var(--btn-large-offset)]" />
          {/* Power button */}
          <div className="bg-[#2b2433] rounded-[var(--btn-rounded)] h-[var(--btn-large-height)] w-[var(--btn-width)] absolute right-[var(--btn-right-offset)] top-[var(--power-top-position)]" />
          {/* Screen */}
          <div className="relative rounded-[var(--screen-rounded)] h-[var(--screen-height)] w-[var(--screen-width)] overflow-hidden z-[3] bg-white">
            {children}
          </div>
        </div>
      </div>
    )
  }
)
IPhoneFrame.displayName = "IPhoneFrame"
