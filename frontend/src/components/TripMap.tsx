import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme";

interface Props {
  region: any;
  coords: { latitude: number; longitude: number }[];
}

export default function TripMap(_props: Props) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }]}>
      <Ionicons name="map" size={64} color={colors.brand} />
      <Text style={{ color: colors.onSurfaceMuted, marginTop: spacing.md }}>
        Tracé visible sur mobile
      </Text>
    </View>
  );
}
