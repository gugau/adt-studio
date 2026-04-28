/* eslint-disable lingui/no-unlocalized-strings -- format keywords (HEX/RGB/HSL/CSS) and inline data-URIs are technical identifiers, not UI copy */

import Color from "color";
import { PipetteIcon } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ColorPickerContextValue {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
  mode: string;
  setHue: (hue: number) => void;
  setSaturation: (saturation: number) => void;
  setLightness: (lightness: number) => void;
  setAlpha: (alpha: number) => void;
  setMode: (mode: string) => void;
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(
  undefined,
);

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);
  if (!context) {
    throw new Error("useColorPicker must be used within a ColorPickerProvider");
  }
  return context;
};

export type ColorPickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  /** Any color string parsable by `color`: hex (`#abc123`), `rgb(...)`, named (`red`), etc. */
  value?: string;
  defaultValue?: string;
  /** Fires on every internal change with `[r, g, b, a]` (a is 0-1). */
  onChange?: (value: [number, number, number, number]) => void;
};

function safeColor(input: string | undefined, fallback: string) {
  try {
    return Color(input ?? fallback);
  } catch {
    return Color(fallback);
  }
}

export const ColorPicker = ({
  value,
  defaultValue = "#000000",
  onChange,
  className,
  ...props
}: ColorPickerProps) => {
  const initial = safeColor(value ?? defaultValue, "#000000");

  const [hue, setHue] = useState(initial.hue() || 0);
  const [saturation, setSaturation] = useState(initial.saturationl());
  const [lightness, setLightness] = useState(initial.lightness());
  const [alpha, setAlpha] = useState(initial.alpha() * 100);
  const [mode, setMode] = useState("hex");

  // Track the latest `onChange` without retriggering the emission effect when
  // the parent re-renders with a fresh function identity. Combined with the
  // `skipEmitRef` below, this prevents the value→state→onChange→value loop
  // (which would silently overwrite Tailwind tokens with their resolved hex).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // True whenever the next state change is driven by something other than a
  // user interaction (initial mount, controlled `value` syncing). The
  // emission effect skips one tick after each true.
  const skipEmitRef = useRef(true);

  // Sync from controlled `value` whenever it changes externally.
  useEffect(() => {
    if (!value) return;
    const c = safeColor(value, "#000000");
    skipEmitRef.current = true;
    setHue(c.hue() || 0);
    setSaturation(c.saturationl());
    setLightness(c.lightness());
    setAlpha(c.alpha() * 100);
  }, [value]);

  // Notify parent of user-driven changes only.
  useEffect(() => {
    if (skipEmitRef.current) {
      skipEmitRef.current = false;
      return;
    }
    const fn = onChangeRef.current;
    if (!fn) return;
    const c = Color.hsl(hue, saturation, lightness).alpha(alpha / 100);
    const [r, g, b] = c.rgb().array();
    fn([r, g, b, alpha / 100]);
  }, [hue, saturation, lightness, alpha]);

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        alpha,
        mode,
        setHue,
        setSaturation,
        setLightness,
        setAlpha,
        setMode,
      }}
    >
      <div
        className={cn("flex size-full flex-col gap-3", className)}
        {...props}
      />
    </ColorPickerContext.Provider>
  );
};

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSelection = memo(
  ({ className, ...props }: ColorPickerSelectionProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [positionX, setPositionX] = useState(0);
    const [positionY, setPositionY] = useState(0);
    const { hue, setSaturation, setLightness } = useColorPicker();

    const backgroundGradient = useMemo(
      () =>
        `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
         linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
         hsl(${hue}, 100%, 50%)`,
      [hue],
    );

    const handlePointerMove = useCallback(
      (event: PointerEvent) => {
        if (!(isDragging && containerRef.current)) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / rect.width),
        );
        const y = Math.max(
          0,
          Math.min(1, (event.clientY - rect.top) / rect.height),
        );
        setPositionX(x);
        setPositionY(y);
        setSaturation(x * 100);
        const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
        const lightnessVal = topLightness * (1 - y);
        setLightness(lightnessVal);
      },
      [isDragging, setSaturation, setLightness],
    );

    useEffect(() => {
      const handlePointerUp = () => setIsDragging(false);
      if (isDragging) {
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
      }
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }, [isDragging, handlePointerMove]);

    return (
      <div
        className={cn("relative size-full cursor-crosshair rounded", className)}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          handlePointerMove(e.nativeEvent);
        }}
        ref={containerRef}
        style={{ background: backgroundGradient }}
        {...props}
      >
        <div
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute h-3.5 w-3.5 rounded-full border-2 border-white"
          style={{
            left: `${positionX * 100}%`,
            top: `${positionY * 100}%`,
            boxShadow:
              "0 0 0 1px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.1)",
          }}
        />
      </div>
    );
  },
);
ColorPickerSelection.displayName = "ColorPickerSelection";

export type ColorPickerHueProps = ComponentProps<typeof SliderPrimitive.Root>;

export const ColorPickerHue = ({
  className,
  ...props
}: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker();

  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-3.5 w-full touch-none", className)}
      max={360}
      onValueChange={([h]) => setHue(h)}
      step={1}
      value={[hue]}
      {...props}
    >
      <SliderPrimitive.Track className="relative my-0.5 h-2.5 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <SliderPrimitive.Range className="absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
};

export type ColorPickerAlphaProps = ComponentProps<typeof SliderPrimitive.Root>;

export const ColorPickerAlpha = ({
  className,
  ...props
}: ColorPickerAlphaProps) => {
  const { alpha, setAlpha } = useColorPicker();

  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-3.5 w-full touch-none", className)}
      max={100}
      onValueChange={([a]) => setAlpha(a)}
      step={1}
      value={[alpha]}
      {...props}
    >
      <SliderPrimitive.Track
        className="relative my-0.5 h-2.5 w-full grow rounded-full overflow-hidden"
        style={{
          background:
            'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-black/50" />
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-transparent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
};

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>;

export const ColorPickerEyeDropper = ({
  className,
  ...props
}: ColorPickerEyeDropperProps) => {
  const { setHue, setSaturation, setLightness, setAlpha } = useColorPicker();

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const c = Color(result.sRGBHex);
      const [h, s, l] = c.hsl().array();
      setHue(h);
      setSaturation(s);
      setLightness(l);
      setAlpha(100);
    } catch (error) {
      // User dismissed the eyedropper (Esc / clicked away) — that's not a
      // failure mode worth logging.
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("EyeDropper failed:", error);
    }
  };

  return (
    <Button
      className={cn(
        "h-7 w-7 shrink-0 text-muted-foreground border-0 bg-muted/60 hover:bg-muted hover:text-foreground shadow-none",
        className,
      )}
      onClick={handleEyeDropper}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <PipetteIcon size={14} />
    </Button>
  );
};

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>;

const formats = ["hex", "rgb", "css", "hsl"];

export const ColorPickerOutput = ({
  className,
  ...props
}: ColorPickerOutputProps) => {
  const { mode, setMode } = useColorPicker();

  return (
    <Select onValueChange={setMode} value={mode}>
      <SelectTrigger
        className={cn(
          "h-7 w-16 shrink-0 text-[11px] px-2 py-0",
          "border-0 bg-muted/60 ring-offset-0 focus:ring-1 focus:ring-inset focus:ring-violet-500 focus:ring-offset-0",
          "data-[state=open]:bg-background data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-violet-500",
          className,
        )}
        {...props}
      >
        <SelectValue placeholder="Mode" />
      </SelectTrigger>
      <SelectContent>
        {formats.map((format) => (
          <SelectItem className="text-[11px]" key={format} value={format}>
            {format.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/** Shared input look for every readout slot in the picker (hex / rgb / hsl /
 * css / percentage). Matches the gray-fill style used by the rest of the
 * style editor — no border, soft muted bg, violet inset ring on focus. */
const FORMAT_INPUT_CLASS =
  "h-7 px-2 py-0 text-[11px] font-mono shadow-none border-0 bg-muted/60 ring-offset-0 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500 focus-visible:ring-offset-0";

const PercentageInput = ({ className }: { className?: string }) => {
  const { alpha, setAlpha } = useColorPicker();
  const [draft, setDraft] = useState(String(Math.round(alpha)));

  // Re-sync the draft whenever alpha changes externally (slider drag, value
  // sync from props, etc.). The local draft only buffers user typing.
  useEffect(() => {
    setDraft(String(Math.round(alpha)));
  }, [alpha]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(Math.round(alpha)));
      return;
    }
    const clamped = Math.max(0, Math.min(100, n));
    setAlpha(clamped);
    setDraft(String(clamped));
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) =>
          setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))
        }
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        className={cn(
          FORMAT_INPUT_CLASS,
          "w-16 rounded-l-none pr-5",
          className,
        )}
      />
      <span className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-[10px]">
        %
      </span>
    </div>
  );
};

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerFormat = ({
  className,
  ...props
}: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, alpha, mode } = useColorPicker();
  const color = Color.hsl(hue, saturation, lightness, alpha / 100);

  if (mode === "hex") {
    const hex = color.hex();
    return (
      <div
        className={cn(
          "-space-x-px relative flex w-full items-center",
          className,
        )}
        {...props}
      >
        <Input
          className={cn(FORMAT_INPUT_CLASS, "rounded-r-none flex-1")}
          readOnly
          type="text"
          value={hex}
        />
        <PercentageInput />
      </div>
    );
  }

  if (mode === "rgb") {
    const rgb = color
      .rgb()
      .array()
      .map((v) => Math.round(v));
    return (
      <div
        className={cn("-space-x-px flex items-center", className)}
        {...props}
      >
        {rgb.map((value, index) => (
          <Input
            className={cn(
              FORMAT_INPUT_CLASS,
              "rounded-r-none flex-1",
              index && "rounded-l-none",
            )}
            key={`rgb-${index}`}
            readOnly
            type="text"
            value={value}
          />
        ))}
        <PercentageInput />
      </div>
    );
  }

  if (mode === "css") {
    const rgb = color
      .rgb()
      .array()
      .map((v) => Math.round(v));
    return (
      <div className={cn("w-full", className)} {...props}>
        <Input
          className={cn(FORMAT_INPUT_CLASS, "w-full")}
          readOnly
          type="text"
          value={`rgba(${rgb.join(", ")}, ${Math.round(alpha)}%)`}
        />
      </div>
    );
  }

  if (mode === "hsl") {
    const hsl = color
      .hsl()
      .array()
      .map((v) => Math.round(v));
    return (
      <div
        className={cn("-space-x-px flex items-center", className)}
        {...props}
      >
        {hsl.map((value, index) => (
          <Input
            className={cn(
              FORMAT_INPUT_CLASS,
              "rounded-r-none flex-1",
              index && "rounded-l-none",
            )}
            key={`hsl-${index}`}
            readOnly
            type="text"
            value={value}
          />
        ))}
        <PercentageInput />
      </div>
    );
  }

  return null;
};
