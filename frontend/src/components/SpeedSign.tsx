import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  limit: number;
  size?: number;
}

export default function SpeedSign({ limit, size = 110 }: Props) {
  const borderWidth = Math.max(8, size * 0.11);
  return (
    <View
      testID="speed-sign"
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.45 }]}>{limit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E0152B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: {
    color: "#0A0A0A",
    fontWeight: "900",
    fontFamily: "System",
  },
});
