export const colors = {
  surface: "#050B2E",
  surfaceSecondary: "#0A1244",
  surfaceTertiary: "#131B56",
  onSurface: "#FFFFFF",
  onSurfaceMuted: "#9BA3D9",
  brand: "#7A3CFF",
  brandSecondary: "#5C20D6",
  brandTertiary: "#261559",
  success: "#00CC66",
  warning: "#FF9900",
  error: "#FF3366",
  info: "#3366FF",
  border: "#1A235C",
  glass: "rgba(10, 18, 68, 0.65)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const speedStatus = (speed: number, limit: number) => {
  if (limit <= 0) return colors.success;
  if (speed > limit) return colors.error;
  if (speed >= limit - 5) return colors.warning;
  return colors.success;
};
