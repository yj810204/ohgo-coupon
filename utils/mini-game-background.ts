import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

type MiniGameKey = 'fishing' | 'block';

type BackgroundMeta = {
  url: string;
  updatedAt?: number;
  localUri: string;
};

const STORAGE_KEY_PREFIX = 'miniGameBackground:';
const BACKGROUND_DIR = `${FileSystem.documentDirectory}mini-game-backgrounds/`;

const ensureBackgroundDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(BACKGROUND_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKGROUND_DIR, { intermediates: true });
  }
};

const resolveExtension = (url: string) => {
  const withoutQuery = url.split('?')[0];
  const ext = withoutQuery.split('.').pop();
  if (!ext) return 'jpg';
  const normalized = ext.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(normalized)) {
    return normalized === 'jpeg' ? 'jpg' : normalized;
  }
  return 'jpg';
};

const readStoredMeta = async (storageKey: string): Promise<BackgroundMeta | null> => {
  try {
    const stored = await AsyncStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed as BackgroundMeta;
  } catch (error) {
    console.error('Failed to parse background meta:', error);
    return null;
  }
};

const saveMeta = async (storageKey: string, meta: BackgroundMeta) => {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(meta));
  } catch (error) {
    console.error('Failed to save background meta:', error);
  }
};

const removeMeta = async (storageKey: string) => {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Failed to remove background meta:', error);
  }
};

export const loadMiniGameBackground = async (game: MiniGameKey): Promise<string | null> => {
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}${game}`;
    const docSnap = await getDoc(doc(db, 'gameSettings', 'backgrounds'));
    const remoteData = docSnap.exists() ? (docSnap.data()?.[game] as any) : null;
    const remoteUrl: string | undefined = remoteData?.url;
    const remoteUpdatedAt: number | undefined = remoteData?.updatedAt
      ? remoteData.updatedAt.toDate
        ? remoteData.updatedAt.toDate().getTime()
        : remoteData.updatedAt
      : undefined;

    const storedMeta = await readStoredMeta(storageKey);

    if (!remoteUrl) {
      if (storedMeta?.localUri) {
        const info = await FileSystem.getInfoAsync(storedMeta.localUri);
        if (info.exists) {
          return storedMeta.localUri;
        }
      }
      await removeMeta(storageKey);
      return null;
    }

    await ensureBackgroundDir();

    const extension = resolveExtension(remoteUrl);
    const filePath = `${BACKGROUND_DIR}${game}-background.${extension}`;

    const shouldDownload =
      !storedMeta ||
      storedMeta.url !== remoteUrl ||
      (remoteUpdatedAt !== undefined && storedMeta.updatedAt !== remoteUpdatedAt);

    if (shouldDownload) {
      try {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      } catch (error) {
        // ignore delete errors
      }

      try {
        const download = await FileSystem.downloadAsync(remoteUrl, filePath);
        const meta: BackgroundMeta = {
          url: remoteUrl,
          updatedAt: remoteUpdatedAt ?? Date.now(),
          localUri: download.uri,
        };
        await saveMeta(storageKey, meta);
        return download.uri;
      } catch (error) {
        console.error('Background download failed:', error);
        return remoteUrl;
      }
    }

    if (storedMeta?.localUri) {
      const info = await FileSystem.getInfoAsync(storedMeta.localUri);
      if (info.exists) {
        return storedMeta.localUri;
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      const meta: BackgroundMeta = {
        url: remoteUrl,
        updatedAt: remoteUpdatedAt ?? storedMeta?.updatedAt ?? Date.now(),
        localUri: filePath,
      };
      await saveMeta(storageKey, meta);
      return filePath;
    }

    try {
      const download = await FileSystem.downloadAsync(remoteUrl, filePath);
      const meta: BackgroundMeta = {
        url: remoteUrl,
        updatedAt: remoteUpdatedAt ?? Date.now(),
        localUri: download.uri,
      };
      await saveMeta(storageKey, meta);
      return download.uri;
    } catch (error) {
      console.error('Background redownload failed:', error);
      return remoteUrl;
    }
  } catch (error) {
    console.error('Failed to load mini game background:', error);
    return null;
  }
};

export const clearMiniGameBackgroundCache = async (game: MiniGameKey) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${game}`;
  const meta = await readStoredMeta(storageKey);
  if (meta?.localUri) {
    try {
      await FileSystem.deleteAsync(meta.localUri, { idempotent: true });
    } catch (error) {
      console.error('Failed to delete cached background:', error);
    }
  }
  await removeMeta(storageKey);
};

