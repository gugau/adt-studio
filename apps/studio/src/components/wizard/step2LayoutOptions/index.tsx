/* eslint-disable lingui/no-unlocalized-strings */
import { RenderStrategyPicker } from "./RenderStrategyPicker"
import { PageGroupingMode } from "./PageGroupingMode"

export function Step2() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <RenderStrategyPicker />
      <PageGroupingMode />
    </div>
  )
}
