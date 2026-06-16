import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/utils/api";
import { colors, radius, spacing } from "../../src/theme";

interface Alert {
  id: string;
  created_at: string;
  speed_kmh: number;
  limit_kmh: number;
  excess_kmh: number;
  route_name?: string;
  severity: string;
}

export default function Alertes() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listAlerts();
      setAlerts(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: Alert }) => {
    const danger = item.severity === "danger";
    const color = danger ? colors.error : colors.warning;
    const d = new Date(item.created_at);
    return (
      <View style={styles.card} testID={`alert-${item.id}`}>
        <View style={[styles.iconBox, { backgroundColor: color + "22", borderColor: color }]}>
          <Ionicons name="warning" size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            Dépassement de {Math.round(item.excess_kmh)} km/h
          </Text>
          <Text style={styles.sub}>
            {item.speed_kmh} / {item.limit_kmh} km/h · {item.route_name || "Route"}
          </Text>
          <Text style={styles.date}>{d.toLocaleString("fr-FR")}</Text>
        </View>
        <View style={[styles.severityPill, { backgroundColor: color }]}>
          <Text style={styles.severityText}>{danger ? "Danger" : "Avertis."}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.heading}>Alertes</Text>
      <Text style={styles.headingSub}>Vos dépassements de vitesse</Text>
      {loading && alerts.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : alerts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shield-checkmark" size={64} color={colors.success} />
          <Text style={styles.emptyTitle}>Aucune infraction.</Text>
          <Text style={styles.emptySub}>Parfait ! Continuez ainsi.</Text>
        </View>
      ) : (
        <FlatList
          testID="alerts-list"
          data={alerts}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  heading: { color: colors.onSurface, fontSize: 28, fontWeight: "900", marginTop: spacing.sm },
  headingSub: { color: colors.onSurfaceMuted, fontSize: 13, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  sub: { color: colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  date: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 4, opacity: 0.7 },
  severityPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  severityText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: spacing.lg },
  emptySub: { color: colors.onSurfaceMuted, fontSize: 13, marginTop: spacing.sm },
});
