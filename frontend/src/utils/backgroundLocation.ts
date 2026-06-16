import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKGROUND_LOCATION_TASK = "signo-background-location";
const STORAGE_KEY = "signo_bg_points";

// Define the task once at module load (web is no-op)
if (Platform.OS !== "web") {
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
      if (error) {
        console.warn("BG location task error:", error);
        return;
      }
      if (!data) return;
      const { locations } = data as { locations: Location.LocationObject[] };
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        for (const loc of locations) {
          arr.push({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            speed: loc.coords.speed || 0,
            ts: loc.timestamp,
          });
        }
        // Cap at 5000 points
        const trimmed = arr.slice(-5000);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch (e) {
        console.warn("BG storage error:", e);
      }
    });
  } catch {
    // task already defined on hot reload
  }
}

export async function startBackgroundTracking(): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS === "web") return { ok: false, reason: "Indisponible sur le web" };

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return { ok: false, reason: "Permission GPS refusée" };

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return { ok: false, reason: "Permission 'Toujours' requise. Ouvrez les réglages et autorisez la localisation en arrière-plan." };
  }

  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) return { ok: true };

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Signo · Suivi du trajet actif",
      notificationBody: "Signo enregistre votre parcours en arrière-plan.",
      notificationColor: "#7A3CFF",
    },
    pausesUpdatesAutomatically: false,
  });
  return { ok: true };
}

export async function stopBackgroundTracking(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {}
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function getStoredBackgroundPoints(): Promise<{ lat: number; lon: number; speed: number; ts: number }[]> {
  if (Platform.OS === "web") return [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearStoredBackgroundPoints(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}
