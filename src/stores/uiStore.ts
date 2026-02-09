import { create } from 'zustand';

interface PromptState {
  visible: boolean;
  title: string;
  defaultValue: string;
  isConfirm: boolean;
  resolve: ((value: string | boolean | null) => void) | null;
}

interface ImageCacheEntry {
  id: number;
  data: string;
  timestamp: number;
}

interface UIState {
  prompt: PromptState;
  imageCache: ImageCacheEntry[];
  imageCacheCounter: number;
  imageModalSrc: string | null;
  imageModalInfo: string | null;

  showPrompt: (title: string, defaultValue?: string) => Promise<string | null>;
  showConfirm: (title: string) => Promise<boolean>;
  closePrompt: (value: string | boolean | null) => void;

  addImageToCache: (dataUrl: string) => number;
  getImageFromCache: (imageNum: number) => ImageCacheEntry | null;
  showImageModal: (imageNum: number) => void;
  hideImageModal: () => void;
}

const MAX_IMAGE_CACHE = 100;

export const useUIStore = create<UIState>((set, get) => ({
  prompt: {
    visible: false,
    title: '',
    defaultValue: '',
    isConfirm: false,
    resolve: null,
  },
  imageCache: [],
  imageCacheCounter: 0,
  imageModalSrc: null,
  imageModalInfo: null,

  showPrompt: (title, defaultValue = '') =>
    new Promise<string | null>((resolve) => {
      set({
        prompt: {
          visible: true,
          title,
          defaultValue,
          isConfirm: false,
          resolve: resolve as (value: string | boolean | null) => void,
        },
      });
    }),

  showConfirm: (title) =>
    new Promise<boolean>((resolve) => {
      set({
        prompt: {
          visible: true,
          title,
          defaultValue: '',
          isConfirm: true,
          resolve: resolve as (value: string | boolean | null) => void,
        },
      });
    }),

  closePrompt: (value) => {
    const { resolve } = get().prompt;
    set({
      prompt: { visible: false, title: '', defaultValue: '', isConfirm: false, resolve: null },
    });
    if (resolve) resolve(value);
  },

  addImageToCache: (dataUrl) => {
    const counter = get().imageCacheCounter + 1;
    const entry: ImageCacheEntry = { id: counter, data: dataUrl, timestamp: Date.now() };
    const cache = [...get().imageCache, entry];
    while (cache.length > MAX_IMAGE_CACHE) cache.shift();
    set({ imageCache: cache, imageCacheCounter: counter });
    return counter;
  },

  getImageFromCache: (imageNum) => {
    const cache = get().imageCache;
    const index = cache.length - imageNum;
    if (index >= 0 && index < cache.length) return cache[index];
    return null;
  },

  showImageModal: (imageNum) => {
    const image = get().getImageFromCache(imageNum);
    if (image) {
      set({
        imageModalSrc: image.data,
        imageModalInfo: `Image #${imageNum} (cached at ${new Date(image.timestamp).toLocaleTimeString()})`,
      });
    }
  },

  hideImageModal: () => set({ imageModalSrc: null, imageModalInfo: null }),
}));
