import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
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

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface DangerZone {
  id: string;
  lat: number;
  lon: number;
  type: string;
  label?: string;
  confirmations?: number;
}

interface Props {
  region: Region | undefined;
  route: { lat: number; lon: number }[];
  zones?: DangerZone[];
}

export interface MapHandle {
  recenter: (region: Region) => void;
}

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  police: { icon: "shield", color: "#3B82F6", label: "Police" },
  speed_camera: { icon: "camera", color: "#EF4444", label: "Radar" },
  accident: { icon: "warning", color: "#F59E0B", label: "Accident" },
  hazard: { icon: "alert-circle", color: "#F97316", label: "Obstacle" },
  construction: { icon: "construct", color: "#EAB308", label: "Travaux" },
};

const MapWrapper = forwardRef<MapHandle, Props>(function MapWrapper(
  { region, route, zones = [] },
  ref
) {
  const mapRef = useRef<MapView | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      recenter: (r: Region) => {
        mapRef.current?.animateToRegion(r, 600);
      },
    }),
    []
  );

  if (!region) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Text style={{ color: colors.onSurfaceMuted }}>Recherche du GPS...</Text>
      </View>
    );
  }
  return (
    <MapView
      ref={mapRef}
      testID="map-view"
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      customMapStyle={darkMapStyle}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      initialRegion={region}
    >
      {route.length > 1 && (
        <Polyline
          coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
          strokeColor={colors.brand}
          strokeWidth={6}
        />
      )}

      {zones.map((z) => {
        const meta = TYPE_META[z.type] || {
          icon: "alert-circle",
          color: "#F97316",
          label: "Danger",
        };
        return (
          <Marker
            key={z.id}
            identifier={z.id}
            testID={`zone-marker-${z.type}`}
            coordinate={{ latitude: z.lat, longitude: z.lon }}
            title={z.label || meta.label}
            description={
              z.confirmations && z.confirmations > 1
                ? `${z.confirmations} confirmations`
                : "Signalé par la communauté"
            }
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[markerStyles.wrap, { borderColor: meta.color }]}>
              <View style={[markerStyles.inner, { backgroundColor: meta.color }]}>
                <Ionicons name={meta.icon as any} size={16} color="#fff" />
              </View>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
});

const markerStyles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: "rgba(5,11,46,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  inner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MapWrapper;
