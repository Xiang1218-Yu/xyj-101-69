import { create } from 'zustand'

export interface StoryInput {
  childName: string
  favoriteAnimal: string
  recentExperiences: string[]
  language: 'zh' | 'en'
  coloringModeEnabled: boolean
}

export interface Sticker {
  id: string
  emoji: string
  x: number
  y: number
  rotation: number
  scale: number
}

export interface ColoringArtwork {
  id: string
  pageIndex: number
  imageDataUrl: string
  createdAt: string
}

export interface BookPage {
  pageNumber: number
  illustrationUrl: string
  lineArtUrl: string
  text: string
  pageType: 'cover' | 'story' | 'back'
  stickers: Sticker[]
  coloringArtworks: ColoringArtwork[]
}

export interface StoryBook {
  id: string
  title: string
  input: StoryInput
  pages: BookPage[]
  createdAt: string
  language: 'zh' | 'en'
}

export interface BedtimeSettings {
  enabled: boolean
  duration: number
  lightColor: string
  startTime: number | null
  brightness: number
  showGoodNight: boolean
}

interface AppState {
  storyInput: StoryInput
  storyBook: StoryBook | null
  isGenerating: boolean
  currentStep: number
  bedtimeSettings: BedtimeSettings

  setStoryInput: (input: Partial<StoryInput>) => void
  setStoryBook: (book: StoryBook) => void
  setIsGenerating: (value: boolean) => void
  setCurrentStep: (step: number) => void
  resetAll: () => void
  addSticker: (pageIndex: number, sticker: Sticker) => void
  updateSticker: (pageIndex: number, stickerId: string, updates: Partial<Sticker>) => void
  deleteSticker: (pageIndex: number, stickerId: string) => void
  addColoringArtwork: (pageIndex: number, artwork: ColoringArtwork) => void
  deleteColoringArtwork: (pageIndex: number, artworkId: string) => void
  setBedtimeSettings: (settings: Partial<BedtimeSettings>) => void
  startBedtimeMode: (duration: number, lightColor: string) => void
  stopBedtimeMode: () => void
  updateBrightness: (brightness: number) => void
  showGoodNightScreen: () => void
  hideGoodNightScreen: () => void
}

const initialInput: StoryInput = {
  childName: '',
  favoriteAnimal: '',
  recentExperiences: [],
  language: 'zh',
  coloringModeEnabled: false,
}

const initialBedtimeSettings: BedtimeSettings = {
  enabled: false,
  duration: 15,
  lightColor: '#FFB6C1',
  startTime: null,
  brightness: 1,
  showGoodNight: false,
}

export const useStore = create<AppState>((set) => ({
  storyInput: { ...initialInput },
  storyBook: null,
  isGenerating: false,
  currentStep: 0,
  bedtimeSettings: { ...initialBedtimeSettings },

  setStoryInput: (input) =>
    set((state) => ({
      storyInput: { ...state.storyInput, ...input },
    })),

  setStoryBook: (book) =>
    set({
      storyBook: {
        ...book,
        pages: book.pages.map((page) => ({
          ...page,
          stickers: page.stickers || [],
          lineArtUrl: page.lineArtUrl || '',
          coloringArtworks: page.coloringArtworks || [],
        })),
      },
    }),

  setIsGenerating: (value) => set({ isGenerating: value }),

  setCurrentStep: (step) => set({ currentStep: step }),

  resetAll: () =>
    set({
      storyInput: { ...initialInput },
      storyBook: null,
      isGenerating: false,
      currentStep: 0,
    }),

  addSticker: (pageIndex: number, sticker: Sticker) =>
    set((state) => {
      if (!state.storyBook) return state
      const newPages = [...state.storyBook.pages]
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        stickers: [...(newPages[pageIndex].stickers || []), sticker],
      }
      return {
        storyBook: {
          ...state.storyBook,
          pages: newPages,
        },
      }
    }),

  updateSticker: (pageIndex: number, stickerId: string, updates: Partial<Sticker>) =>
    set((state) => {
      if (!state.storyBook) return state
      const newPages = [...state.storyBook.pages]
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        stickers: newPages[pageIndex].stickers.map((s) =>
          s.id === stickerId ? { ...s, ...updates } : s
        ),
      }
      return {
        storyBook: {
          ...state.storyBook,
          pages: newPages,
        },
      }
    }),

  deleteSticker: (pageIndex: number, stickerId: string) =>
    set((state) => {
      if (!state.storyBook) return state
      const newPages = [...state.storyBook.pages]
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        stickers: newPages[pageIndex].stickers.filter((s) => s.id !== stickerId),
      }
      return {
        storyBook: {
          ...state.storyBook,
          pages: newPages,
        },
      }
    }),

  addColoringArtwork: (pageIndex: number, artwork: ColoringArtwork) =>
    set((state) => {
      if (!state.storyBook) return state
      const newPages = [...state.storyBook.pages]
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        coloringArtworks: [...newPages[pageIndex].coloringArtworks, artwork],
      }
      return {
        storyBook: {
          ...state.storyBook,
          pages: newPages,
        },
      }
    }),

  deleteColoringArtwork: (pageIndex: number, artworkId: string) =>
    set((state) => {
      if (!state.storyBook) return state
      const newPages = [...state.storyBook.pages]
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        coloringArtworks: newPages[pageIndex].coloringArtworks.filter((a) => a.id !== artworkId),
      }
      return {
        storyBook: {
          ...state.storyBook,
          pages: newPages,
        },
      }
    }),

  setBedtimeSettings: (settings) =>
    set((state) => ({
      bedtimeSettings: { ...state.bedtimeSettings, ...settings },
    })),

  startBedtimeMode: (duration, lightColor) =>
    set({
      bedtimeSettings: {
        enabled: true,
        duration,
        lightColor,
        startTime: Date.now(),
        brightness: 1,
        showGoodNight: false,
      },
    }),

  stopBedtimeMode: () =>
    set({
      bedtimeSettings: { ...initialBedtimeSettings },
    }),

  updateBrightness: (brightness) =>
    set((state) => ({
      bedtimeSettings: { ...state.bedtimeSettings, brightness },
    })),

  showGoodNightScreen: () =>
    set((state) => ({
      bedtimeSettings: { ...state.bedtimeSettings, showGoodNight: true },
    })),

  hideGoodNightScreen: () =>
    set((state) => ({
      bedtimeSettings: { ...state.bedtimeSettings, showGoodNight: false },
    })),
}))
