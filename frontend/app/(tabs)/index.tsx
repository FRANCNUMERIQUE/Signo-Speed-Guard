import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Vibration,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import SpeedSign from "../../src/components/SpeedSign";
import GlassCard from "../../src/components/GlassCard";
import MapWrapper, { MapHandle } from "../../src/components/MapWrapper";
import { api } from "../../src/utils/api";
import { colors, radius, spacing, speedStatus } from "../../src/theme";

interface Point { lat: number; lon: number; }

interface DangerZone {
  id: string; lat: number; lon: number; type: string; label: string; confirmations: number;
}

const DANGER_OPTIONS = [
  { type: "police", label: "Police", icon: "shield" },
  { type: "speed_camera", label: "Radar", icon: "camera" },
  { type: "accident", label: "Accident", icon: "warning" },
  { type: "hazard", label: "Obstacle", icon: "alert-circle" },
  { type: "construction", label: "Travaux", icon: "construct" },
];

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapHandle | null>(null);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [location, setLocation] = useState<{ lat: number; lon: number; heading: number } | null>(null);
  const [speed, setSpeed] = useState(0);
  const [limit, setLimit] = useState<number>(50);
  const [roadName, setRoadName] = useState("Recherche...");
  const [upcoming, setUpcoming] = useState<{ distance_m: number; limit_kmh: number }[]>([
    { distance_m: 500, limit_kmh: 50 },
    { distance_m: 2000, limit_kmh: 80 },
  ]);
  const [weather, setWeather] = useState<{ temp_c: number | null; label: string; icon: string } | null>(null);
  const [zones, setZones] = useState<DangerZone[]>([]);
  const [signalOpen, setSignalOpen] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [route, setRoute] = useState<Point[]>([]);
  const [tripStats, setTripStats] = useState({
    distance: 0, overspeed: 0, maxSpeed: 0, startTime: 0, sumSpeed: 0, samples: 0,
  });
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastFetchRef = useRef(0);
  const lastWarnRef = useRef(0);
  const prevPosRef = useRef<{ lat: number; lon: number } | null>(null);

  const askPermission = async () => {
    if (Platform.OS === "web") {
      if (!navigator.geolocation) { setPermission("denied"); setLocation({ lat: 48.8566, lon: 2.3522, heading: 0 }); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => { setPermission("granted"); setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, heading: pos.coords.heading || 0 }); setSpeed(Math.max(0, (pos.coords.speed || 0) * 3.6)); },
        () => { setPermission("denied"); setLocation({ lat: 48.8566, lon: 2.3522, heading: 0 }); }
      );
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setPermission("denied"); setLocation({ lat: 48.8566, lon: 2.3522, heading: 0 }); return; }
    setPermission("granted");
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude, heading: loc.coords.heading || 0 });
  };

  useEffect(() => { askPermission(); return () => { subRef.current?.remove(); }; }, []);

  useEffect(() => {
    if (!location) return;
    const now = Date.now();
    if (now - lastFetchRef.current < 8000) return;
    lastFetchRef.current = now;
    api.getSpeedLimit(location.lat, location.lon).then((d: any) => { setLimit(d.limit_kmh); setRoadName(d.road_name); }).catch(() => {});
    api.getUpcomingLimits(location.lat, location.lon, location.heading || 0).then((d: any) => setUpcoming(d.upcoming)).catch(() => {});
    api.getWeather(location.lat, location.lon).then((d: any) => setWeather(d)).catch(() => {});
    api.listDangerZones(location.lat, location.lon, 5).then((d: any) => setZones(d)).catch(() => {});
  }, [location?.lat, location?.lon]);

  useEffect(() => {
    if (speed > limit + 2) {
      const now = Date.now();
      if (now - lastWarnRef.current > 8000) {
        lastWarnRef.current = now;
        try { Speech.speak("Attention, vous dépassez la vitesse autorisée.", { language: "fr-FR" }); } catch {}
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        if (Platform.OS !== "web") Vibration.vibrate(300);
        if (location) {
          api.createAlert({ speed_kmh: Math.round(speed), limit_kmh: limit, lat: location.lat, lon: location.lon, route_name: roadName }).catch(() => {});
          setTripStats((s) => ({ ...s, overspeed: s.overspeed + 1 }));
        }
      }
    }
  }, [speed, limit]);

  const haversine = (a: Point, b: Point) => {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat); const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const startTrip = async () => {
    setTripStats({ distance: 0, overspeed: 0, maxSpeed: 0, startTime: Date.now(), sumSpeed: 0, samples: 0 });
    setRoute([]);
    prevPosRef.current = null;
    setTracking(true);
    if (Platform.OS === "web" || permission !== "granted") return;
    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        const lat = loc.coords.latitude; const lon = loc.coords.longitude;
        const heading = loc.coords.heading || 0;
        const spd = Math.max(0, (loc.coords.speed || 0) * 3.6);
        setLocation({ lat, lon, heading });
        setSpeed(spd);
        setRoute((r) => [...r, { lat, lon }]);
        setTripStats((s) => {
          let dist = s.distance;
          if (prevPosRef.current) dist += haversine(prevPosRef.current, { lat, lon }) / 1000;
          prevPosRef.current = { lat, lon };
          return { ...s, distance: dist, maxSpeed: Math.max(s.maxSpeed, spd), sumSpeed: s.sumSpeed + spd, samples: s.samples + 1 };
        });
      }
    );
  };

  const endTrip = async () => {
    subRef.current?.remove();
    subRef.current = null;
    setTracking(false);
    const duration_min = (Date.now() - tripStats.startTime) / 60000;
    const avg_speed_kmh = tripStats.samples > 0 ? tripStats.sumSpeed / tripStats.samples : 0;
    if (tripStats.distance < 0.05) return;
    const points = route;
    const step = Math.max(1, Math.floor(points.length / 500));
    const sampled = points.filter((_, i) => i % step === 0);
    try {
      await api.createTrip({
        started_at: new Date(tripStats.startTime).toISOString(),
        ended_at: new Date().toISOString(),
        distance_km: Number(tripStats.distance.toFixed(2)),
        duration_min: Number(duration_min.toFixed(1)),
        avg_speed_kmh: Number(avg_speed_kmh.toFixed(1)),
        max_speed_kmh: Number(tripStats.maxSpeed.toFixed(1)),
        overspeed_count: tripStats.overspeed,
        route_name: roadName,
        route_points: sampled,
      });
    } catch {}
  };

  const reportDanger = useCallback(async (type: string) => {
    if (!location) return;
    setSignalOpen(false);
    // Optimistic: drop a marker immediately at the user's current position
    const tempId = `local-${Date.now()}`;
    const optimistic: DangerZone = {
      id: tempId,
      lat: location.lat,
      lon: location.lon,
      type,
      label: type,
      confirmations: 1,
    };
    setZones((prev) => [optimistic, ...prev]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      const created: any = await api.reportDangerZone({ lat: location.lat, lon: location.lon, type });
      // Replace the temp marker with the persisted one
      setZones((prev) => {
        const filtered = prev.filter((z) => z.id !== tempId);
        if (created && created.id) {
          return [
            {
              id: created.id,
              lat: created.lat,
              lon: created.lon,
              type: created.type,
              label: created.label || type,
              confirmations: created.confirmations || 1,
            },
            ...filtered,
          ];
        }
        return filtered;
      });
      // Refresh the full list to stay in sync
      try {
        const updated: any = await api.listDangerZones(location.lat, location.lon, 5);
        setZones(updated);
      } catch {}
    } catch {
      // Rollback optimistic marker on failure
      setZones((prev) => prev.filter((z) => z.id !== tempId));
    }
  }, [location]);

  const recenterMap = () => {
    if (!location) return;
    Haptics.selectionAsync().catch(() => {});
    mapRef.current?.recenter({
      latitude: location.lat,
      longitude: location.lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const status = speedStatus(speed, limit);
  const inLimit = speed <= limit;
  const region = location ? { latitude: location.lat, longitude: location.lon, latitudeDelta: 0.01, longitudeDelta: 0.01 } : undefined;

  const topPad = insets.top + 8;
  const bottomPad = 56 + insets.bottom + 12;

  return (
    <View style={styles.root}>
      <MapWrapper ref={mapRef} region={region} route={route} zones={zones} />

      {/* TOP: Header + speed number just below */}
      <View style={[styles.topFloat, { top: topPad }]} pointerEvents="box-none">
        <GlassCard style={styles.headerCard} testID="header-card">
          <View style={styles.headerInner}>
            <Ionicons name="navigate" size={18} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{roadName}</Text>
              <Text style={styles.headerSub}>Signo · Temps réel</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: inLimit ? colors.success : colors.error }]}>
              <Text style={styles.badgeText}>{inLimit ? "OK" : "ALERTE"}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Speed number just under header, no card */}
        <View style={styles.speedDisplay}>
          <Text testID="current-speed" style={[styles.speedNumber, { color: status }]}>
            {Math.round(speed)}
          </Text>
          <Text style={[styles.speedUnit, { color: status }]}>km/h</Text>
          <View style={[styles.statusPill, { backgroundColor: status + "33", borderColor: status }]}>
            <Ionicons name={inLimit ? "checkmark-circle" : "warning"} size={12} color={status} />
            <Text style={[styles.statusText, { color: status }]} numberOfLines={1}>
              {inLimit ? "Dans la limite" : "Dépassement"}
            </Text>
          </View>
        </View>
      </View>

      {/* RIGHT: Météo + Signaler + Recenter (stacked) */}
      <View style={[styles.rightFloat, { top: topPad + 72 }]} pointerEvents="box-none">
        {weather && (
          <GlassCard style={styles.sideCard}>
            <Text style={styles.sideCardTitle}>Météo</Text>
            <View style={styles.weatherRow}>
              <Ionicons name={weather.icon as any} size={26} color={colors.info} />
              <View style={{ marginLeft: 6 }}>
                <Text style={styles.weatherTemp}>{weather.temp_c !== null ? `${Math.round(weather.temp_c)}°` : "--"}</Text>
                <Text style={styles.weatherLabel} numberOfLines={2}>{weather.label}</Text>
              </View>
            </View>
          </GlassCard>
        )}

        <Pressable
          testID="signal-btn"
          onPress={() => setSignalOpen(true)}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="megaphone" size={22} color="#fff" />
          {zones.length > 0 && (
            <View style={styles.zoneBadge}><Text style={styles.zoneBadgeText}>{zones.length}</Text></View>
          )}
        </Pressable>

        <Pressable
          testID="drive-mode-btn"
          onPress={() => router.push("/drive")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="car-sport" size={22} color="#fff" />
        </Pressable>

        <Pressable
          testID="recenter-btn"
          onPress={recenterMap}
          style={({ pressed }) => [styles.recenterBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="locate" size={22} color={colors.brand} />
        </Pressable>
      </View>

      {/* LEFT: Speed sign (current limit) — sits just above the À venir card */}
      <View style={[styles.signFloat, { bottom: bottomPad + 138 }]} pointerEvents="box-none">
        <SpeedSign limit={limit} size={96} />
      </View>

      {/* BOTTOM: À venir + Démarrer */}
      <View style={[styles.bottomFloat, { bottom: bottomPad }]} pointerEvents="box-none">
        <GlassCard style={styles.upcomingCard} testID="upcoming-card">
          <View style={styles.upcomingRow}>
            {upcoming.slice(0, 2).map((u, i) => (
              <View key={i} style={styles.upcomingItem}>
                <SpeedSign limit={u.limit_kmh} size={42} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={styles.upcomingDist}>
                    {u.distance_m >= 1000 ? `${(u.distance_m / 1000).toFixed(0)} km` : `${u.distance_m} m`}
                  </Text>
                  <Text style={styles.upcomingLimit}>{u.limit_kmh} km/h</Text>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.bottomCard} testID="bottom-card">
          <View style={styles.bottomRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomHintLabel}>
                {tracking ? "Trajet en cours" : "Trajet"}
              </Text>
              <Text style={styles.bottomHint} numberOfLines={1}>
                {tracking ? `${tripStats.distance.toFixed(2)} km · ${tripStats.overspeed} dép.` : "Démarrez pour gagner des $FRE"}
              </Text>
            </View>
            <Pressable
              testID={tracking ? "stop-trip-btn" : "start-trip-btn"}
              onPress={tracking ? endTrip : startTrip}
              style={({ pressed }) => [styles.tripBtn, { backgroundColor: tracking ? colors.error : colors.brand }, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name={tracking ? "stop" : "play"} size={18} color="#fff" />
              <Text style={styles.tripBtnText}>{tracking ? "Arrêter" : "Démarrer"}</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>

      {/* DANGER SIGNAL MODAL */}
      <Modal visible={signalOpen} transparent animationType="fade" onRequestClose={() => setSignalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSignalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Signaler une zone</Text>
            <Text style={styles.modalSub}>Aidez la communauté Signo</Text>
            <View style={styles.optionsGrid}>
              {DANGER_OPTIONS.map((o) => (
                <Pressable
                  key={o.type}
                  testID={`signal-${o.type}`}
                  onPress={() => reportDanger(o.type)}
                  style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: colors.brandTertiary }]}
                >
                  <View style={styles.optionIconBox}>
                    <Ionicons name={o.icon as any} size={24} color={colors.brand} />
                  </View>
                  <Text style={styles.optionLabel}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setSignalOpen(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  topFloat: { position: "absolute", left: spacing.md, right: spacing.md },
  headerCard: { paddingVertical: 10, paddingHorizontal: spacing.md },
  headerInner: { flexDirection: "row", alignItems: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  headerSub: { color: colors.onSurfaceMuted, fontSize: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Speed number + status pill under header (horizontal row)
  speedDisplay: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "baseline",
    paddingLeft: 4,
  },
  speedNumber: {
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 56,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  speedUnit: {
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 4,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  statusPill: {
    marginLeft: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Speed sign (current limit) — floats on the left, anchored above À venir card
  signFloat: { position: "absolute", left: spacing.md },

  rightFloat: { position: "absolute", right: spacing.md, width: 116, alignItems: "flex-end" },
  sideCard: { padding: spacing.sm, alignSelf: "stretch" },
  sideCardTitle: {
    color: colors.brand, fontSize: 10, fontWeight: "800",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs,
  },
  weatherRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  weatherTemp: { color: colors.onSurface, fontSize: 18, fontWeight: "900", lineHeight: 20 },
  weatherLabel: { color: colors.onSurfaceMuted, fontSize: 9, maxWidth: 70 },

  signalBtn: {
    marginTop: spacing.sm, backgroundColor: colors.brand,
    paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    alignSelf: "stretch",
  },
  signalBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  iconBtn: {
    marginTop: spacing.sm,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoneBadge: {
    position: "absolute",
    top: -4, right: -4,
    backgroundColor: colors.error, borderRadius: radius.pill,
    paddingHorizontal: 5, minWidth: 18, height: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface,
  },
  zoneBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  recenterBtn: {
    marginTop: spacing.sm,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  driveBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.brandSecondary,
    paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    alignSelf: "stretch",
  },
  driveBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  bottomFloat: { position: "absolute", left: spacing.md, right: spacing.md },

  upcomingCard: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  upcomingRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  upcomingItem: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm },
  upcomingDist: { color: colors.onSurfaceMuted, fontSize: 11, fontWeight: "600" },
  upcomingLimit: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginTop: 1 },

  bottomCard: { padding: spacing.md },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bottomHintLabel: { color: colors.onSurfaceMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  bottomHint: { color: colors.onSurface, fontSize: 13, fontWeight: "600", marginTop: 2 },
  tripBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  tripBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  modalSub: { color: colors.onSurfaceMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.lg },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optionBtn: {
    width: "31%", alignItems: "center", padding: spacing.md,
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  optionIconBox: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  optionLabel: { color: colors.onSurface, fontSize: 11, fontWeight: "600", textAlign: "center" },
  modalCancel: { marginTop: spacing.lg, padding: spacing.md, alignItems: "center" },
  modalCancelText: { color: colors.brand, fontWeight: "700" },
});
