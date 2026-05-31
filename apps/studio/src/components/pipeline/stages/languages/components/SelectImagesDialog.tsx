import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Clock, Images, X, Search, Maximize2 } from "lucide-react"
import { api, BASE_URL } from "@/api/client"
import { useLingui } from "@lingui/react/macro"
import { LoadingState } from "@/components/pipeline/components/LoadingState"
import { ImageLightbox } from "./ImageLightbox"

interface SelectImagesDialogProps {
  bookLabel: string
  initialSelected: string[]
  onConfirm: (imageIds: string[]) => void
  onClose: () => void
}

/**
 * Dialog that lets the user pick which captioned images should have their
 * burned-in text translated. Source list comes from /books/:label/captioned-images,
 * which only returns images appearing in the rendered storyboard.
 */
export function SelectImagesDialog({
  bookLabel,
  initialSelected,
  onConfirm,
  onClose,
}: SelectImagesDialogProps) {
  const { t } = useLingui()
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [lightbox, setLightbox] = useState<{ src: string; caption: string; imageId: string } | null>(null)

  const imagesQuery = useQuery({
    queryKey: ["books", bookLabel, "captioned-images"],
    queryFn: () => api.listCaptionedImages(bookLabel),
    staleTime: 30_000,
  })

  const filtered = imagesQuery.data?.images.filter((img) => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return (
      img.imageId.toLowerCase().includes(f) ||
      img.caption.toLowerCase().includes(f)
    )
  })

  const toggleAll = () => {
    if (!filtered) return
    if (filtered.every((img) => selected.has(img.imageId))) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const img of filtered) next.delete(img.imageId)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const img of filtered) next.add(img.imageId)
        return next
      })
    }
  }

  const toggleOne = (imageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(imageId)) next.delete(imageId)
      else next.add(imageId)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-8">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-pink-500" />
            <h2 className="text-sm font-semibold">{t`Select images to translate`}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t`Only images that appear in the storyboard are listed. The selected images will be regenerated for each output language with their text translated.`}
          </p>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
            <Clock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
              strokeWidth={2}
              aria-hidden
            />
            <span>
              {t`Heads up: regenerating images takes considerably longer than text translation — each selected image is redrawn for every output language.`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t`Filter by image ID or caption...`}
                className="w-full text-sm border rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
              />
            </div>
            {filtered && filtered.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium rounded px-3 py-2 bg-muted hover:bg-accent transition-colors cursor-pointer whitespace-nowrap"
              >
                {filtered.every((img) => selected.has(img.imageId))
                  ? t`Deselect all`
                  : t`Select all`}
              </button>
            )}
          </div>

          {imagesQuery.isLoading && (
            <LoadingState stageSlug="translate" label={t`Loading images...`} />
          )}

          {imagesQuery.isError && (
            <p className="text-center text-sm text-red-500 py-8">
              {t`Failed to load images.`}
            </p>
          )}

          {filtered && filtered.length === 0 && !imagesQuery.isLoading && (
            <p className="text-center text-sm text-muted-foreground py-12">
              {filter
                ? t`No images match your filter.`
                : t`No captioned images yet. Run the image-captioning step first.`}
            </p>
          )}

          {filtered && filtered.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((img) => {
                const isSelected = selected.has(img.imageId)
                return (
                  <div
                    key={img.imageId}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={img.imageId}
                    tabIndex={0}
                    onClick={() => toggleOne(img.imageId)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        toggleOne(img.imageId)
                      }
                    }}
                    className={`group relative rounded border overflow-hidden bg-card flex flex-col items-stretch transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                      isSelected
                        ? "ring-2 ring-pink-500 border-pink-500"
                        : "hover:ring-2 hover:ring-pink-500/40"
                    }`}
                  >
                    <div
                      className={`absolute top-1.5 left-1.5 z-10 h-4 w-4 rounded-[4px] border flex items-center justify-center shadow-sm transition-colors ${
                        isSelected
                          ? "bg-pink-500 border-pink-500"
                          : "bg-white/95 border-neutral-300 group-hover:border-pink-400"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightbox({
                          src: `${BASE_URL}/books/${bookLabel}/images/${img.imageId}`,
                          caption: img.caption,
                          imageId: img.imageId,
                        })
                      }}
                      aria-label={t`View image`}
                      className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-md bg-black/55 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/75 flex items-center justify-center transition-opacity cursor-pointer"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                    <img
                      src={`${BASE_URL}/books/${bookLabel}/images/${img.imageId}`}
                      alt={img.imageId}
                      draggable={false}
                      className="w-full h-32 object-contain bg-muted/30 select-none pointer-events-none"
                      loading="lazy"
                    />
                    <div className="px-2 py-1.5 border-t bg-muted/30">
                      <span className="text-[10px] font-mono text-muted-foreground truncate block">
                        {img.imageId}
                      </span>
                      {img.caption && (
                        <span className="text-[10px] text-foreground/80 line-clamp-2 mt-0.5">
                          {img.caption}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {selected.size === 1
              ? t`1 image selected`
              : t`${String(selected.size)} images selected`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium rounded px-3 py-1.5 bg-muted hover:bg-accent transition-colors cursor-pointer"
            >
              {t`Cancel`}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selected))}
              className="text-xs font-medium rounded px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white cursor-pointer transition-colors"
            >
              {t`Save selection`}
            </button>
          </div>
        </div>
      </div>
      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.imageId}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
