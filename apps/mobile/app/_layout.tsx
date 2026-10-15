import { brands } from "@krizaka/tokens/native";
import { ThemeProvider } from "@krizaka/ui/native";
import { Stack } from "expo-router";

/** The app's root: the Krizaka native theme in Kachizaka's colours (gold over cobalt), dark and light. */
export default function RootLayout() {
  return (
    <ThemeProvider overrides={brands.kachizaka}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
