import React from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius } from "../theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  testID?: string;
}

export default function GlassCard({ children, style, intensity = 40, testID }: Props) {
  if (Platform.OS === "android") {
    return (
      <View testID={testID} style={[styles.fallback, style]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView testID={testID} intensity={intensity} tint="dark" style={[styles.blur, style]}>
      <View style={styles.inner}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(10,18,68,0.45)",
  },
  inner: { flex: 1 },
  fallback: {
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
