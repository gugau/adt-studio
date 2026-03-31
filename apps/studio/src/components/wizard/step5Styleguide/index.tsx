/* eslint-disable lingui/no-unlocalized-strings */
import { useRef } from "react"
import { useStore } from "@tanstack/react-form"
import { Palette, Check, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useWizardForm } from "@/components/wizard/wizardForm"
import { useStyleguides, useUploadStyleguide } from "@/hooks/use-presets"

function StyleguideOption({
  name,
  selected,
  onSelect,
}: {
  name: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 shadow-sm transition-colors text-left",
        "bg-white border-border",
        "hover:bg-muted hover:border-input",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected && "border-primary/50 bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 bg-white",
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-foreground">{name}</span>
      </div>
      <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

export function Step5() {
  const form = useWizardForm()
  const styleguide = useStore(form.store, (s) => s.values.styleguide)
  const { data: styleguidesData, isLoading } = useStyleguides()
  const available = styleguidesData?.styleguides ?? []
  const uploadMutation = useUploadStyleguide()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function select(name: string) {
    form.setFieldValue("styleguide", styleguide === name ? "" : name)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        form.setFieldValue("styleguide", data.name)
      },
    })
    e.target.value = ""
  }

  return (
    <div className="flex w-full flex-col gap-5 p-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground leading-relaxed">
          A style guide provides consistent HTML and CSS patterns that the LLM uses when generating
          pages. It controls typography, colors, spacing, and component styles so every page in
          your book has a unified look.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Selecting "None" lets the LLM choose its own styling for each page.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <StyleguideOption
          name="None"
          selected={styleguide === ""}
          onSelect={() => form.setFieldValue("styleguide", "")}
        />

        {isLoading && (
          <p className="px-4 py-3 text-sm text-muted-foreground">Loading style guides...</p>
        )}

        {available.map((sg) => (
          <StyleguideOption
            key={sg}
            name={sg}
            selected={styleguide === sg}
            onSelect={() => select(sg)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer gap-2"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploadMutation.isPending ? "Uploading..." : "Upload Style Guide"}
        </Button>
        {uploadMutation.isError && (
          <p className="text-sm text-destructive">
            {uploadMutation.error?.message ?? "Upload failed"}
          </p>
        )}
      </div>
    </div>
  )
}
