import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '../../src/viewmodels/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Templates',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="barbell-outline" color={focused ? colors.text : colors.secondary} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="time-outline" color={focused ? colors.text : colors.secondary} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="person-outline" color={focused ? colors.text : colors.secondary} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
