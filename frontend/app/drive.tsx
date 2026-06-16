import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import SpeedSign from "../src/components/SpeedSign";
import { api } from "../src/utils/api";
import { colors, speedStatus } from "../src/theme";

export default function DriveMode() {
  const router = useRouter();
  const [speed, setSpeed] = useState(0);
  const [limit, setLimit] = useState(50);
  const [roadName, setRoadName] = useState("");
  const [sub, setSub] = useState<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // Lock landscape
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});

    (async () => {
      if (Platform.OS === "web") return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 1500 },
        (loc) => {
          const spd = Math.max(0, (loc.coords.speed || 0) * 3.6);
          setSpeed(spd);
          api.getSpeedLimit(loc.coords.latitude, loc.coords.longitude)
            .then((d: any) => { setLimit(d.limit_kmh); setRoadName(d.road_name); })
            .catch(() => {});
        }
      );
      setSub(s);
    })();

    return () => {
      sub?.remove();
      ScreenOrientation.unlockAsync().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exitMode = async () => {
    sub?.remove();
    await ScreenOrientation.unlockAsync().catch(() => {});
    router.back();
  };

  const status = speedStatus(speed, limit);
  const inLimit = speed <= limit;

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <SpeedSign limit={limit} size={220} />
        {roadName ? <Text style={styles.road} numberOfLines={1}>{roadName}</Text> : null}
      </View>

      <View style={styles.right}>
        <Text testID="drive-speed" style={[styles.speedNumber, { color: status }]}>
          {Math.round(speed)}
        </Text>
        <Text style={[styles.speedUnit, { color: status }]}>km/h</Text>
        <View style={[styles.statusPill, { backgroundColor: status + "33", borderColor: status }]}>
          <Ionicons name={inLimit ? "checkmark-circle" : "warning"} size={18} color={status} />
          <Text style={[styles.statusText, { color: status }]}>
            {inLimit ? "Dans la limite" : "Dépassement"}
          </Text>
        </View>
      </View>

      <Pressable testID="drive-exit-btn" onPress={exitMode} style={styles.exitBtn}>
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: colors.surface,
    flexDirection: "row", alignItems: "center", justifyContent: "space-around",
    padding: 24,
  },
  left: { alignItems: "center", flex: 1 },
  road: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: 24, maxWidth: 380, textAlign: "center" },
  right: { alignItems: "center", flex: 1 },
  speedNumber: { fontSize: 220, fontWeight: "900", lineHeight: 230 },
  speedUnit: { fontSize: 32, fontWeight: "700", marginTop: -16 },
  statusPill: {
    marginTop: 24, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 999, borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 10,
  },
  statusText: { fontSize: 22, fontWeight: "700" },
  exitBtn: {
    position: "absolute", top: 24, right: 24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
});
