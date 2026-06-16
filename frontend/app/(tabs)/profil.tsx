import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/utils/api";
import { colors, radius, spacing } from "../../src/theme";

interface Profile {
  device_id: string;
  name: string;
  wallet_ton?: string;
  fre_balance: number;
  total_distance_km: number;
  total_trips: number;
  safety_score: number;
}

export default function Profil() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.getProfile();
      setProfile(p);
      setName(p.name || "");
      setWallet(p.wallet_ton || "");
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      await api.updateProfile({ name, wallet_ton: wallet });
      setToast("Profil mis à jour");
      setTimeout(() => setToast(null), 2500);
      load();
    } catch {
      setToast("Erreur");
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (loading && !profile) {
    return (
      <View style={[styles.root, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const scoreColor =
    (profile?.safety_score ?? 100) >= 90
      ? colors.success
      : (profile?.safety_score ?? 100) >= 70
      ? colors.warning
      : colors.error;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {/* Hero */}
        <LinearGradient
          colors={[colors.brandSecondary, colors.brand]}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={42} color={colors.brand} />
          </View>
          <Text style={styles.heroName}>{profile?.name || "Conducteur"}</Text>
          <Text style={styles.heroId}>ID · {profile?.device_id.slice(0, 8)}</Text>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat label="Trajets" value={String(profile?.total_trips || 0)} icon="map" color={colors.brand} />
          <Stat label="Distance" value={`${(profile?.total_distance_km || 0).toFixed(0)} km`} icon="speedometer" color={colors.info} />
          <Stat label="Score" value={`${profile?.safety_score || 0}%`} icon="shield" color={scoreColor} />
        </View>

        {/* FRE Balance card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="gift" size={22} color={colors.brand} />
            <Text style={styles.cardTitle}>Solde $FRE</Text>
            <Text style={[styles.cardValue, { marginLeft: "auto" }]}>
              {(profile?.fre_balance || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations</Text>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            testID="name-input"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Votre nom"
            placeholderTextColor={colors.onSurfaceMuted}
          />
          <Text style={styles.label}>Adresse Wallet TON</Text>
          <TextInput
            testID="profile-wallet-input"
            value={wallet}
            onChangeText={setWallet}
            style={styles.input}
            placeholder="EQAbc...xyz"
            placeholderTextColor={colors.onSurfaceMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable testID="save-profile-btn" onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          </Pressable>
        </View>
      </ScrollView>
      {toast && (
        <View testID="profile-toast" style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: "center",
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  heroName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroId: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 },
  statsRow: { flexDirection: "row", paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  statValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: spacing.sm },
  statLabel: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm, marginLeft: 8 },
  cardValue: { color: colors.brand, fontSize: 20, fontWeight: "900" },
  label: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: colors.brand,
    padding: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  saveBtnText: { color: "#fff", fontWeight: "800" },
  toast: {
    position: "absolute",
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.success,
  },
  toastText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
