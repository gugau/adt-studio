import * as SliderPrimitive from "@radix-ui/react-slider"

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>

export function Slider(props: SliderProps) {
  const isRange = Array.isArray(props.value) && props.value.length === 2

  return (
    <SliderPrimitive.Root
      {...props}
      className={`relative flex items-center select-none touch-none w-full h-5 ${props.className ?? ""} ${props.disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      <SliderPrimitive.Track className="bg-[#e5e5e5] relative grow rounded-full h-1.5">
        <SliderPrimitive.Range className="absolute bg-[#2b7fff] rounded-full h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-white border-2 border-[#2b7fff] rounded-full shadow focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/40 cursor-pointer" />
      {isRange && (
        <SliderPrimitive.Thumb className="block w-4 h-4 bg-white border-2 border-[#2b7fff] rounded-full shadow focus:outline-none focus:ring-2 focus:ring-[#2b7fff]/40 cursor-pointer" />
      )}
    </SliderPrimitive.Root>
  )
}
