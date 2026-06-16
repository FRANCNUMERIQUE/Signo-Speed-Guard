import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import TripMap from "../../src/components/TripMap";
import { api } from "../../src/utils/api";
import { colors, radius, spacing } from "../../src/theme";

interface Trip {
  id: string;
  started_at: string;
  ended_at: string;
  distance_km: number;
  duration_min: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  overspeed_count: number;
  safety_score: number;
  route_name?: string;
  route_points?: { lat: number; lon: number }[];
}

export default function TripDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getTrip(id as string).then((t: Trip) => { setTrip(t); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.root}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.onSurfaceMuted }}>Trajet introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const points = trip.route_points || [];
  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lon }));

  let region: any = undefined;
  if (coords.length > 0) {
    const lats = coords.map((c) => c.latitude);
    const lons = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.4),
    };
  }

  const started = new Date(trip.started_at);
  const scoreColor = trip.safety_score >= 90 ? colors.success : trip.safety_score >= 70 ? colors.warning : colors.error;

  return (
    <View style={styles.root}>
      <TripMap region={region} coords={coords} />

      <SafeAreaView edges={["top"]} style={styles.headerSafe} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{trip.route_name || "Trajet"}</Text>
            <Text style={styles.headerSub}>
              {started.toLocaleDateString("fr-FR")} · {started.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <View style={[styles.scorePill, { backgroundColor: scoreColor }]}>
            <Text style={styles.scoreText}>{trip.safety_score}%</Text>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <Stat icon="speedometer" color={colors.brand} label="Distance" value={`${trip.distance_km.toFixed(1)} km`} />
            <Stat icon="time" color={colors.info} label="Durée" value={`${Math.round(trip.duration_min)} min`} />
          </View>
          <View style={[styles.statsRow, { marginTop: spacing.md }]}>
            <Stat icon="trending-up" color={colors.success} label="Vit. moy." value={`${Math.round(trip.avg_speed_kmh)} km/h`} />
            <Stat icon="flash" color={colors.warning} label="Vit. max" value={`${Math.round(trip.max_speed_kmh)} km/h`} />
          </View>
          <View style={[styles.statsRow, { marginTop: spacing.md }]}>
            <Stat
              icon="warning"
              color={trip.overspeed_count > 0 ? colors.error : colors.success}
              label="Dépassements"
              value={String(trip.overspeed_count)}
            />
            <Stat icon="shield-checkmark" color={scoreColor} label="Score sécurité" value={`${trip.safety_score}%`} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerSafe: { position: "absolute", top: 0, left: 0, right: 0 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: "rgba(5,11,46,0.85)",
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  headerSub: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  scorePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, minWidth: 56, alignItems: "center" },
  scoreText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  bottomSafe: { position: "absolute", bottom: 0, left: 0, right: 0 },
  statsCard: {
    margin: spacing.md, padding: spacing.lg,
    backgroundColor: "rgba(10,18,68,0.92)", borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statLabel: { color: colors.onSurfaceMuted, fontSize: 11 },
  statValue: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginTop: 1 },

  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg },
  backText: { color: colors.onSurface, fontSize: 14 },
});
