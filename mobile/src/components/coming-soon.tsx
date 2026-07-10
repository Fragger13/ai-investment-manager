import { Image, Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";

// Honest placeholder for tabs that are still being ported from the web app.
export function ComingSoon({ title, blurb, webPath }: { title: string; blurb: string; webPath: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.blurb}>{blurb}</Text>
      <View style={{ marginTop: spacing.xl, width: "100%" }}>
        <Button title="Open on askpapa.in" variant="ghost" onPress={() => Linking.openURL(`https://www.askpapa.in${webPath}`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, opacity: 0.9 },
  title: { marginTop: 16, fontSize: 20, fontWeight: "800", color: colors.foreground },
  blurb: { marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.mutedForeground, textAlign: "center" },
});
