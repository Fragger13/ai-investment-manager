import { Redirect, Tabs } from "expo-router";
import { Image, View } from "react-native";
import { CircleUserRound, Home } from "lucide-react-native";
import { colors } from "@/constants/theme";
import { useAuthStore } from "@/store/auth-store";

// Three real destinations, mobile-first: Home, Papa (the product's heart, so
// his face is the icon), and You. No dead placeholder tabs.
function IconPill({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: focused ? colors.accent : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

export default function TabsLayout() {
  const { token, hasHydrated, onboardingComplete } = useAuthStore();
  if (hasHydrated && !token) return <Redirect href="/login" />;
  // A half-done onboarding leaves partial profile drafts on the server, so
  // "a profile exists" is NOT the same as "onboarded". Gate the tabs on the
  // real flag or users see a dashboard computed from an empty profile.
  if (hasHydrated && token && !onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accentForeground,
        tabBarInactiveTintColor: "hsl(222, 12%, 60%)",
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: "hsl(160, 40%, 20%)",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          height: 64,
          paddingTop: 8,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <IconPill focused={focused}>
              <Home color={color} size={24} strokeWidth={focused ? 2.4 : 2} />
            </IconPill>
          ),
        }}
      />
      <Tabs.Screen
        name="papa"
        options={{
          title: "Papa",
          tabBarIcon: ({ focused }) => (
            <IconPill focused={focused}>
              <Image
                source={require("@/assets/images/papa-avatar.png")}
                style={{ width: 27, height: 27, borderRadius: 14, opacity: focused ? 1 : 0.5 }}
              />
            </IconPill>
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <IconPill focused={focused}>
              <CircleUserRound color={color} size={24} strokeWidth={focused ? 2.4 : 2} />
            </IconPill>
          ),
        }}
      />
    </Tabs>
  );
}
