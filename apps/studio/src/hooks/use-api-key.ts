import { useCallback, useSyncExternalStore } from "react"
import { STORAGE_KEY_OPENAI } from "@/lib/openai-api-key-storage"

const STORAGE_KEY_ANTHROPIC = "adt-studio-anthropic-key"
const STORAGE_KEY_GOOGLE = "adt-studio-google-key"
const STORAGE_KEY_CUSTOM_BASE_URL = "adt-studio-custom-base-url"
const STORAGE_KEY_CUSTOM_API_KEY = "adt-studio-custom-api-key"
const STORAGE_KEY_AZURE = "adt-studio-azure-key"
const STORAGE_KEY_AZURE_REGION = "adt-studio-azure-region"
const STORAGE_KEY_GEMINI = "adt-studio-gemini-key"

type StorageListener = () => void

const listenersByKey = new Map<string, Set<StorageListener>>()
const memoryValues = new Map<string, string>()

function normalizeStorageValue(value: string): string {
  return value.trim()
}

function readStoredValue(key: string): string {
  if (typeof window === "undefined") return memoryValues.get(key) ?? ""

  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return memoryValues.get(key) ?? ""
  }
}

function writeStoredValue(key: string, rawValue: string) {
  const value = normalizeStorageValue(rawValue)

  if (value) memoryValues.set(key, value)
  else memoryValues.delete(key)

  if (typeof window === "undefined") return

  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    // localStorage unavailable
  }
}

function notifyStorageKey(key: string) {
  listenersByKey.get(key)?.forEach((listener) => listener())
}

function subscribeToStorageKey(key: string, listener: StorageListener) {
  const listeners = listenersByKey.get(key) ?? new Set<StorageListener>()
  listeners.add(listener)
  listenersByKey.set(key, listeners)

  const handleStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener()
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) listenersByKey.delete(key)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage)
    }
  }
}

function useLocalStorageState(key: string) {
  const subscribe = useCallback(
    (listener: StorageListener) => subscribeToStorageKey(key, listener),
    [key],
  )
  const getSnapshot = useCallback(() => readStoredValue(key), [key])
  const value = useSyncExternalStore(subscribe, getSnapshot, () => "")

  const setValue = useCallback(
    (v: string) => {
      writeStoredValue(key, v)
      notifyStorageKey(key)
    },
    [key]
  )

  return [value, setValue] as const
}

/**
 * Hook to manage API keys in localStorage.
 */
export function useApiKey() {
  const [apiKey, setApiKey] = useLocalStorageState(STORAGE_KEY_OPENAI)
  const [anthropicKey, setAnthropicKey] = useLocalStorageState(STORAGE_KEY_ANTHROPIC)
  const [googleKey, setGoogleKey] = useLocalStorageState(STORAGE_KEY_GOOGLE)
  const [customBaseUrl, setCustomBaseUrl] = useLocalStorageState(STORAGE_KEY_CUSTOM_BASE_URL)
  const [customApiKey, setCustomApiKey] = useLocalStorageState(STORAGE_KEY_CUSTOM_API_KEY)
  const [azureKey, setAzureKey] = useLocalStorageState(STORAGE_KEY_AZURE)
  const [azureRegion, setAzureRegion] = useLocalStorageState(STORAGE_KEY_AZURE_REGION)
  const [geminiKey, setGeminiKey] = useLocalStorageState(STORAGE_KEY_GEMINI)

  return {
    apiKey,
    setApiKey,
    hasApiKey: apiKey.trim().length > 0,
    anthropicKey,
    setAnthropicKey,
    hasAnthropicKey: anthropicKey.trim().length > 0,
    googleKey,
    setGoogleKey,
    hasGoogleKey: googleKey.trim().length > 0,
    customBaseUrl,
    setCustomBaseUrl,
    customApiKey,
    setCustomApiKey,
    hasCustomProvider: customBaseUrl.trim().length > 0,
    azureKey,
    setAzureKey,
    hasAzureKey: azureKey.trim().length > 0,
    azureRegion,
    setAzureRegion,
    geminiKey,
    setGeminiKey,
    hasGeminiKey: geminiKey.trim().length > 0,
  }
}
