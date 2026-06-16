import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/utils/api";
import { colors, radius, spacing } from "../../src/theme";

interface Claim {
  id: string;
  amount: number;
  wallet_ton: string;
  status: "pending" | "paid" | "refused";
  tx_hash?: string;
  requested_at: string;
  paid_at?: string;
  refused_reason?: string;
}

interface RewardsData {
  fre_balance: number;
  threshold: number;
  wallet_ton?: string;
  events: { id: string; amount: number; reason: string; created_at: string }[];
  claims: Claim[];
}

export default function Recompenses() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; color: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getRewards();
      setData(d);
      setWallet(d.wallet_ton || "");
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (text: string, color = colors.success) => {
    setToast({ text, color });
    setTimeout(() => setToast(null), 4500);
  };

  const saveWallet = async () => {
    if (!wallet.trim()) return;
    try {
      await api.updateProfile({ wallet_ton: wallet.trim() });
      showToast("Adresse wallet TON enregistrée");
      load();
    } catch {
      showToast("Erreur lors de la sauvegarde", colors.error);
    }
  };

  const pendingClaim = data?.claims.find((c) => c.status === "pending");

  const onClaimPress = () => {
    if (!data?.wallet_ton) {
      showToast(
        "Aucune adresse TON n'est enregistrée. Veuillez renseigner votre adresse de réception dans votre profil avant d'effectuer une réclamation.",
        colors.error
      );
      return;
    }
    if (pendingClaim) {
      showToast("Une réclamation est déjà en attente de paiement.", colors.warning);
      return;
    }
    if ((data?.fre_balance || 0) < 1000) return;
    setConfirmOpen(true);
  };

  const confirmClaim = async () => {
    setSubmitting(true);
    try {
      const res: any = await api.claimRewards(1000);
      setConfirmOpen(false);
      showToast(
        res?.message || "Votre demande de paiement a bien été prise en compte. Le transfert sera effectué prochainement.",
        colors.success
      );
      load();
    } catch (e: any) {
      let msg = "Erreur de réclamation";
      try { msg = JSON.parse(e.message).detail || msg; } catch { msg = e.message || msg; }
      setConfirmOpen(false);
      showToast(msg, colors.error);
    }
    setSubmitting(false);
  };

  const balance = data?.fre_balance ?? 0;
  const threshold = data?.threshold ?? 1000;
  const pct = Math.min(100, (balance / threshold) * 100);
  const canClaim = balance >= threshold && !!data?.wallet_ton && !pendingClaim;

  if (loading && !data) {
    return (
      <View style={[styles.root, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const pendingClaims = data?.claims.filter((c) => c.status === "pending") || [];
  const paidClaims = data?.claims.filter((c) => c.status === "paid") || [];
  const refusedClaims = data?.claims.filter((c) => c.status === "refused") || [];

  const claimBtnLabel = pendingClaim
    ? "Réclamation en attente"
    : !data?.wallet_ton
    ? "Renseigner wallet TON ↓"
    : balance < threshold
    ? `Encore ${(threshold - balance).toFixed(0)} FRE`
    : "Réclamer 1000 $FRE";

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: spacing.lg }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <Text style={styles.title}>Récompenses</Text>
        <Text style={styles.subtitle}>Gagnez des $FRE en conduisant</Text>

        <LinearGradient
          colors={[colors.brandSecondary, colors.brand, "#A270FF"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>SOLDE</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text testID="fre-balance" style={styles.balance}>{balance.toFixed(2)}</Text>
            <Text style={styles.tokenName}>$FRE</Text>
          </View>
          <Text style={styles.heroSub}>1 FRE pour 10 km parcourus · Seuil 1000 FRE</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {balance.toFixed(0)} / {threshold} FRE ({pct.toFixed(0)}%)
          </Text>
        </LinearGradient>

        {/* Pending banner */}
        {pendingClaim && (
          <View testID="pending-banner" style={styles.pendingBanner}>
            <Ionicons name="time" size={22} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.pendingTitle}>{pendingClaim.amount} FRE en attente de paiement</Text>
              <Text style={styles.pendingSub}>
                Demandé le {new Date(pendingClaim.requested_at).toLocaleString("fr-FR")}
              </Text>
            </View>
          </View>
        )}

        <Pressable
          testID="claim-btn"
          onPress={onClaimPress}
          disabled={!canClaim}
          style={[styles.claimBtn, { backgroundColor: canClaim ? colors.brand : colors.surfaceTertiary }]}
        >
          <Ionicons name={pendingClaim ? "hourglass" : "cash"} size={20} color="#fff" />
          <Text style={styles.claimText}>{claimBtnLabel}</Text>
        </Pressable>

        {/* Wallet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse Wallet TON</Text>
          <View style={styles.walletRow}>
            <TextInput
              testID="wallet-input"
              value={wallet}
              onChangeText={setWallet}
              placeholder="EQAbc...xyz (votre adresse TON)"
              placeholderTextColor={colors.onSurfaceMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable testID="save-wallet-btn" onPress={saveWallet} style={styles.saveBtn}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </Pressable>
          </View>
          {data?.wallet_ton && (
            <Text style={styles.walletOk}>
              <Ionicons name="shield-checkmark" size={12} color={colors.success} /> Wallet identifié
            </Text>
          )}
        </View>

        {/* Payments history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des paiements</Text>

          {pendingClaims.length === 0 && paidClaims.length === 0 && refusedClaims.length === 0 && (
            <Text style={styles.empty}>Aucune réclamation pour l&apos;instant</Text>
          )}

          {pendingClaims.length > 0 && (
            <>
              <Text style={styles.histGroupTitle}>En attente ({pendingClaims.length})</Text>
              {pendingClaims.map((c) => <ClaimRow key={c.id} claim={c} />)}
            </>
          )}
          {paidClaims.length > 0 && (
            <>
              <Text style={styles.histGroupTitle}>Payées ({paidClaims.length})</Text>
              {paidClaims.map((c) => <ClaimRow key={c.id} claim={c} />)}
            </>
          )}
          {refusedClaims.length > 0 && (
            <>
              <Text style={styles.histGroupTitle}>Refusées ({refusedClaims.length})</Text>
              {refusedClaims.map((c) => <ClaimRow key={c.id} claim={c} />)}
            </>
          )}
        </View>

        {/* Gain events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des gains</Text>
          {(data?.events || []).length === 0 ? (
            <Text style={styles.empty}>Aucun gain pour l&apos;instant</Text>
          ) : (
            (data?.events || []).slice(0, 12).map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <Ionicons name="add-circle" size={20} color={colors.success} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.eventReason}>{e.reason}</Text>
                  <Text style={styles.eventDate}>{new Date(e.created_at).toLocaleDateString("fr-FR")}</Text>
                </View>
                <Text style={styles.eventAmount}>+{e.amount.toFixed(2)} FRE</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Confirm modal */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="cash" size={32} color={colors.brand} />
            </View>
            <Text style={styles.modalTitle}>Confirmer la réclamation</Text>
            <Text style={styles.modalBody}>
              Vous êtes sur le point de réclamer <Text style={{ fontWeight: "800", color: colors.brand }}>1000 $FRE</Text> vers votre wallet TON :
            </Text>
            <Text style={styles.modalWallet} numberOfLines={1}>{data?.wallet_ton}</Text>
            <Text style={styles.modalNote}>
              Une fois confirmée, votre solde sera mis à zéro et le paiement sera traité par notre équipe sous quelques heures.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                testID="confirm-cancel"
                onPress={() => setConfirmOpen(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.onSurface }]}>Annuler</Text>
              </Pressable>
              <Pressable
                testID="confirm-claim"
                onPress={confirmClaim}
                disabled={submitting}
                style={[styles.modalBtn, { backgroundColor: colors.brand }]}
              >
                <Text style={styles.modalBtnText}>
                  {submitting ? "Envoi..." : "Confirmer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toast && (
        <View testID="toast" style={[styles.toast, { backgroundColor: toast.color }]}>
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  const statusMeta: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "En attente", color: colors.warning, icon: "time" },
    paid: { label: "Payée", color: colors.success, icon: "checkmark-circle" },
    refused: { label: "Refusée", color: colors.error, icon: "close-circle" },
  };
  const m = statusMeta[claim.status];
  return (
    <View style={styles.claimRow} testID={`claim-${claim.id}`}>
      <View style={[styles.statusDot, { backgroundColor: m.color + "22", borderColor: m.color }]}>
        <Ionicons name={m.icon} size={16} color={m.color} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={styles.claimAmount}>{claim.amount} FRE</Text>
        <Text style={styles.claimDate}>
          Demandée : {new Date(claim.requested_at).toLocaleString("fr-FR")}
        </Text>
        {claim.paid_at && (
          <Text style={styles.claimDate}>Payée : {new Date(claim.paid_at).toLocaleString("fr-FR")}</Text>
        )}
        {claim.tx_hash && (
          <Text style={styles.claimTx} numberOfLines={1}>tx : {claim.tx_hash}</Text>
        )}
        {claim.refused_reason && (
          <Text style={[styles.claimTx, { color: colors.error }]}>{claim.refused_reason}</Text>
        )}
      </View>
      <View style={[styles.statusPill, { backgroundColor: m.color }]}>
        <Text style={styles.statusPillText}>{m.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", marginTop: spacing.sm },
  subtitle: { color: colors.onSurfaceMuted, fontSize: 13, marginBottom: spacing.lg },
  hero: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  heroLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  balance: { color: "#fff", fontSize: 56, fontWeight: "900" },
  tokenName: { color: "#fff", fontSize: 20, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: spacing.xs },
  progressTrack: { height: 10, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: radius.pill, overflow: "hidden", marginTop: spacing.md },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: radius.pill },
  progressText: { color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 6, fontWeight: "700" },

  pendingBanner: {
    flexDirection: "row", alignItems: "center",
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.warning + "22",
    borderWidth: 1, borderColor: colors.warning,
    marginBottom: spacing.md,
  },
  pendingTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  pendingSub: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },

  claimBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: spacing.lg, borderRadius: radius.pill, marginBottom: spacing.lg,
  },
  claimText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  section: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginBottom: spacing.md },
  histGroupTitle: { color: colors.brand, fontSize: 11, fontWeight: "800", marginTop: spacing.sm, marginBottom: spacing.xs, letterSpacing: 1 },
  walletRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surfaceTertiary, color: colors.onSurface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, fontSize: 13,
  },
  saveBtn: { backgroundColor: colors.brand, width: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  walletOk: { color: colors.success, fontSize: 11, marginTop: spacing.sm, fontWeight: "600" },
  empty: { color: colors.onSurfaceMuted, fontSize: 13, textAlign: "center", paddingVertical: spacing.md },

  claimRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  claimAmount: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  claimDate: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  claimTx: { color: colors.onSurfaceMuted, fontSize: 10, marginTop: 2, opacity: 0.7 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusPillText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  eventRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  eventReason: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  eventDate: { color: colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  eventAmount: { color: colors.success, fontSize: 13, fontWeight: "800" },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center", padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
  },
  modalIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center", marginBottom: spacing.md,
  },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", textAlign: "center" },
  modalBody: { color: colors.onSurface, fontSize: 13, marginTop: spacing.md, lineHeight: 18 },
  modalWallet: {
    color: colors.brand, fontSize: 12, marginTop: 6, fontWeight: "700",
    backgroundColor: colors.surfaceTertiary,
    padding: spacing.sm, borderRadius: radius.md,
  },
  modalNote: { color: colors.onSurfaceMuted, fontSize: 12, marginTop: spacing.md, lineHeight: 17 },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  modalBtn: { flex: 1, padding: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  toast: {
    position: "absolute", bottom: 100, left: spacing.lg, right: spacing.lg,
    padding: spacing.md, borderRadius: radius.md,
  },
  toastText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
