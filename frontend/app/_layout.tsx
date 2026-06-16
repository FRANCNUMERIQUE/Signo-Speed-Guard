import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { registerForPushNotifications } from "@/src/utils/notifications";

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
      // Register for push notifications (best effort, runs once)
      registerForPushNotifications().catch(() => {});
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#050B2E" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="drive" options={{ presentation: "fullScreenModal", animation: "fade" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
