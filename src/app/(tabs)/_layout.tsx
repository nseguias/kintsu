import { Tabs } from 'expo-router';
import React from 'react';

import { Header, Icon, type IconName } from '@/components/ui';
import { Colors } from '@/constants/theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Icon name={(focused ? icon : `${icon}-outline`) as IconName} color={color} />,
});

/** The always-there bottom menu. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => <Header title={options.title ?? ''} />,
        sceneStyle: { backgroundColor: Colors.background },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.inkSoft,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border, paddingTop: 6 },
      }}>
      <Tabs.Screen name="home" options={{ ...tab('Home', 'home'), headerShown: false }} />
      <Tabs.Screen name="activity" options={tab('Activity', 'time')} />
      <Tabs.Screen name="settings" options={tab('Settings', 'settings')} />
    </Tabs>
  );
}
