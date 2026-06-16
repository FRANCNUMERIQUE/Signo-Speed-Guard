import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingActive,
} from "../../src/utils/backgroundLocation";
import { colors, radius, spacing } from "../../src/theme";

export default function Parametres() {
  const router = useRouter();
  const [audio, setAudio] = useState(true);
  const [voice, setVoice] = useState(true);
  const [haptic, setHaptic] = useState(true);
  const [offline, setOffline] = useState(false);
  const [community, setCommunity] = useState(true);
  const [bgTracking, setBgTracking] = useState(false);
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null);

  useEffect(() => {
    isBackgroundTrackingActive().then(setBgTracking);
  }, []);

  const showToast = (text: string, color = colors.success) => {
    setToast({ text, color });
    setTimeout(() => setToast(null), 3500);
  };

  const handleBgTracking = async (next: boolean) => {
    if (next) {
      const res = await startBackgroundTracking();
      if (res.ok) {
        setBgTracking(true);
        showToast("Suivi GPS arrière-plan activé", colors.success);
      } else {
        setBgTracking(false);
        showToast(res.reason || "Activation impossible", colors.error);
      }
    } else {
      await stopBackgroundTracking();
      setBgTracking(false);
      showToast("Suivi GPS arrière-plan désactivé", colors.warning);
    }
  };

  const Row = ({
    icon, label, desc, value, onChange, color = colors.brand,
  }: {
    icon: any; label: string; desc?: string;
    value: boolean; onChange: (v: boolean) => void; color?: string;
  }) => (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc && <Text style={styles.rowDesc}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? colors.brand : "#888"}
        trackColor={{ false: colors.surfaceTertiary, true: colors.brandTertiary }}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.lg }}>
        <Text style={styles.title}>Paramètres</Text>
        <Text style={styles.subtitle}>Personnalisez votre expérience</Text>

        <Section title="MODE CONDUITE">
          <Pressable testID="drive-link" onPress={() => router.push("/drive")} style={styles.linkRow}>
            <Ionicons name="car-sport" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkText}>Lancer le mode conduite</Text>
              <Text style={styles.linkDesc}>Plein écran paysage, gros chiffres</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} />
          </Pressable>
        </Section>

        <Section title="SUIVI">
          <Row
            icon="navigate-circle"
            label="Suivi GPS en arrière-plan"
            desc="Continue à enregistrer même app fermée"
            value={bgTracking}
            onChange={handleBgTracking}
            color={colors.brand}
          />
        </Section>

        <Section title="ALERTES">
          <Row icon="volume-high" label="Alertes sonores" desc="Bip court en cas de dépassement" value={audio} onChange={setAudio} />
          <Row icon="mic" label="Alertes vocales" desc="Notification vocale en français" value={voice} onChange={setVoice} color={colors.info} />
          <Row icon="phone-portrait" label="Vibrations" desc="Retour haptique" value={haptic} onChange={setHaptic} color={colors.warning} />
        </Section>

        <Section title="AUTRES">
          <Row icon="cloud-offline" label="Mode hors ligne" desc="Utilisation sans connexion" value={offline} onChange={setOffline} color={colors.info} />
          <Row icon="people" label="Signalements communautaires" desc="Recevoir les alertes des autres conducteurs" value={community} onChange={setCommunity} color={colors.success} />
        </Section>

        <Section title="À PROPOS">
          <View style={styles.linkRow}>
            <Ionicons name="information-circle" size={20} color={colors.brand} />
            <Text style={styles.linkText}>Signo · Version 1.0.0</Text>
          </View>
        </Section>

        <Text style={styles.footer}>
          Données fournies par OpenStreetMap & Open-Meteo.{"\n"}Roulez en sécurité avec Signo.
        </Text>
      </ScrollView>
      {toast && (
        <View testID="settings-toast" style={[styles.toast, { backgroundColor: toast.color }]}>
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBox}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", marginTop: spacing.sm },
  subtitle: { color: colors.onSurfaceMuted, fontSize: 13, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.brand, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.sm },
  sectionBox: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
  },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  rowDesc: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  linkRow: {
    flexDirection: "row", alignItems: "center", padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
  },
  linkText: { color: colors.onSurface, fontSize: 14, flex: 1 },
  linkDesc: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  footer: { color: colors.onSurfaceMuted, fontSize: 11, textAlign: "center", marginTop: spacing.lg, lineHeight: 18 },
  toast: {
    position: "absolute", bottom: 100, left: spacing.lg, right: spacing.lg,
    padding: spacing.md, borderRadius: radius.md,
  },
  toastText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
