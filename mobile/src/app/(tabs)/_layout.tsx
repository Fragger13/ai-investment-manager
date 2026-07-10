import { Redirect, Tabs } from "expo-router";
import { Bot, Home, NotebookTabs, PieChart, Target } from "lucide-react-native";
import { colors } from "@/constants/theme";
import { useAuthStore } from "@/store/auth-store";

// Same five destinations and icon set as the web app's bottom bar, so moving
// between web and mobile feels like the same product.
export default function TabsLayout() {
  const { token, hasHydrated } = useAuthStore();
  if (hasHydrated && !token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: "Goals", tabBarIcon: ({ color, size }) => <Target color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: "Plan", tabBarIcon: ({ color, size }) => <NotebookTabs color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ title: "Portfolio", tabBarIcon: ({ color, size }) => <PieChart color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="papa"
        options={{ title: "Papa", tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }}
      />
    </Tabs>
  );
}
