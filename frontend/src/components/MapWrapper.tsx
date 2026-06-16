import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Props {
  region: Region | undefined;
  route: { lat: number; lon: number }[];
  zones?: { id: string; lat: number; lon: number; type: string }[];
}

export interface MapHandle {
  recenter: (region: Region) => void;
}

const MapWrapper = forwardRef<MapHandle, Props>(function MapWrapper(_props, _ref) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.fallback]}>
      <Text style={styles.text}>Carte GPS</Text>
      <Text style={styles.hint}>(Aperçu web — la carte interactive est disponible sur mobile)</Text>
    </View>
  );
});

export default MapWrapper;

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  text: { color: colors.onSurface, fontSize: 18, fontWeight: "700", opacity: 0.8 },
  hint: { color: colors.onSurfaceMuted, fontSize: 12, marginTop: 4, opacity: 0.6, paddingHorizontal: 24, textAlign: "center" },
});
