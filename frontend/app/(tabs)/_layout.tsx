import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarContentHeight = 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceMuted,
        tabBarStyle: {
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(5,11,46,0.97)",
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarContentHeight + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          position: "absolute",
        },
        tabBarBackground:
          Platform.OS === "ios"
            ? () => (
                <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
              )
            : undefined,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" size={size} color={color} />,
          tabBarButtonTestID: "tab-accueil",
        }}
      />
      <Tabs.Screen
        name="trajets"
        options={{
          title: "Trajets",
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
          tabBarButtonTestID: "tab-trajets",
        }}
      />
      <Tabs.Screen
        name="alertes"
        options={{
          title: "Alertes",
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
          tabBarButtonTestID: "tab-alertes",
        }}
      />
      <Tabs.Screen
        name="recompenses"
        options={{
          title: "Récompenses",
          tabBarIcon: ({ color, size }) => <Ionicons name="gift" size={size} color={color} />,
          tabBarButtonTestID: "tab-recompenses",
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          tabBarButtonTestID: "tab-profil",
        }}
      />
      <Tabs.Screen
        name="parametres"
        options={{
          title: "Paramètres",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          tabBarButtonTestID: "tab-parametres",
        }}
      />
    </Tabs>
  );
}
