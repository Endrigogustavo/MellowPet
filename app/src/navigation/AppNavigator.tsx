import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { Colors } from '../theme';

export type RootStackParamList = {
  MainTabs: undefined;
  Chat: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Tools: undefined;
  Dashboard: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textTertiary,
      tabBarStyle: {
        height: 66,
        paddingTop: 8,
        paddingBottom: 8,
        borderTopWidth: 0,
        elevation: 12,
        shadowOpacity: 0.08,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
      tabBarIcon: ({ color, size }) => {
        const icons: Record<keyof MainTabParamList, string> = {
          Home: 'home-variant',
          Tools: 'toolbox-outline',
          Dashboard: 'chart-bar',
          Settings: 'tune-variant',
        };

        return <MaterialCommunityIcons name={icons[route.name as keyof MainTabParamList] as any} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Tools" component={ToolsScreen} />
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

export const AppNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false, gestureEnabled: true }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);
