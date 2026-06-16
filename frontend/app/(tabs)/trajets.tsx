import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../src/utils/api";
import { colors, radius, spacing } from "../../src/theme";

interface Trip {
  id: string;
  started_at: string;
  distance_km: number;
  duration_min: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  overspeed_count: number;
  safety_score: number;
  route_name?: string;
}

export default function Trajets() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listTrips();
      setTrips(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
      " · " +
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const renderItem = ({ item }: { item: Trip }) => (
    <Pressable
      testID={`trip-${item.id}`}
      onPress={() => router.push(`/trip/${item.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.route_name || "Trajet"}</Text>
          <Text style={styles.cardDate}>{formatDate(item.started_at)}</Text>
        </View>
        <View
          style={[
            styles.scorePill,
            { backgroundColor: item.safety_score >= 90 ? colors.success : item.safety_score >= 70 ? colors.warning : colors.error },
          ]}
        >
          <Text style={styles.scoreText}>{item.safety_score}%</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} style={{ marginLeft: 6 }} />
      </View>
      <View style={styles.statsGrid}>
        <Stat label="Distance" value={`${item.distance_km.toFixed(1)} km`} />
        <Stat label="Durée" value={`${Math.round(item.duration_min)} min`} />
        <Stat label="Vit. moy." value={`${Math.round(item.avg_speed_kmh)} km/h`} />
        <Stat
          label="Dépassements"
          value={String(item.overspeed_count)}
          color={item.overspeed_count > 0 ? colors.error : colors.success}
        />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.title}>Historique</Text>
      <Text style={styles.subtitle}>Vos trajets enregistrés</Text>
      {loading && trips.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="map-outline" size={64} color={colors.brand} />
          <Text style={styles.emptyTitle}>Aucun trajet enregistré</Text>
          <Text style={styles.emptySub}>Démarrez votre premier trajet depuis l&apos;accueil</Text>
        </View>
      ) : (
        <FlatList
          testID="trips-list"
          data={trips}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", marginTop: spacing.sm },
  subtitle: { color: colors.onSurfaceMuted, fontSize: 13, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  cardDate: { color: colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  scorePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  scoreText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap" },
  stat: { width: "50%", marginVertical: 4 },
  statLabel: { color: colors.onSurfaceMuted, fontSize: 11 },
  statValue: { color: colors.onSurface, fontSize: 16, fontWeight: "700", marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: spacing.lg },
  emptySub: { color: colors.onSurfaceMuted, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },
});
