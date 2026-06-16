import React from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import { colors } from "../theme";

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#050B2E" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9BA3D9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#050B2E" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0A1244" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#131B56" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1A235C" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#030720" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

interface Props {
  region: any;
  coords: { latitude: number; longitude: number }[];
}

export default function TripMap({ region, coords }: Props) {
  if (!region) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.onSurfaceMuted }}>Aucun tracé enregistré</Text>
      </View>
    );
  }
  return (
    <MapView
      testID="trip-map"
      style={StyleSheet.absoluteFill}
      customMapStyle={darkMapStyle}
      initialRegion={region}
    >
      {coords.length > 1 && (
        <Polyline coordinates={coords} strokeColor={colors.brand} strokeWidth={6} />
      )}
      {coords.length > 0 && (
        <>
          <Marker coordinate={coords[0]} pinColor="green" title="Départ" />
          <Marker coordinate={coords[coords.length - 1]} pinColor="red" title="Arrivée" />
        </>
      )}
    </MapView>
  );
}
