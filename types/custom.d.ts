declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: any;
  export default AsyncStorage;
}

declare module '../../firebase' {
  import type { Firestore } from 'firebase/firestore';
  export const db: Firestore;
  export const storage: any;
}

