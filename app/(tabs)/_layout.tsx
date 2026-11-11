import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import { useTheme } from '../../src/viewmodels/theme';
import { useWorkouts } from '../../src/viewmodels/workout-provider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { savingTemplate } = useWorkouts();
  return (
    <Tabs
      backBehavior="history"
      screenListeners={{
        tabPress: (event) => {
          if (savingTemplate) event.preventDefault();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            disabled={savingTemplate}
            accessibilityState={{ ...props.accessibilityState, disabled: savingTemplate }}
            style={[props.style, { opacity: savingTemplate ? 0.5 : 1 }]}
          />
        ),
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
