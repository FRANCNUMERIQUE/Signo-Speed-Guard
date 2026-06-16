import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "signo_device_id";

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  try {
    if (Platform.OS === "web") {
      let id = await AsyncStorage.getItem(KEY);
      if (!id) {
        id = uuid();
        await AsyncStorage.setItem(KEY, id);
      }
      return id;
    }
    let id = await SecureStore.getItemAsync(KEY);
    if (!id) {
      id = uuid();
      await SecureStore.setItemAsync(KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}
