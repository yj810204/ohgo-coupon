// utils/secure-store.ts
import * as SecureStore from 'expo-secure-store';

export async function saveUser(user: { name: string; dob: string; uuid: string, isAdmin?: boolean }) {
  await SecureStore.setItemAsync('user', JSON.stringify(user));
}

export async function getUser() {
  const value = await SecureStore.getItemAsync('user');
  return value ? JSON.parse(value) : null;
}

export async function clearUser() {
  await SecureStore.deleteItemAsync('user');
}
