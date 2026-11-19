import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GTS_COLORS } from '../constants/theme';

interface GtsTabBarProps {
  state: any;
  descriptors?: any;
  navigation?: any;
  navigateToTab?: (routeKey: string) => void;
  emitter?: any;
}

export function GtsTabBar({ state, descriptors, navigation, navigateToTab, emitter }: GtsTabBarProps) {
  const currentRouteName = state.routes[state.index].name;

  const tabIcons: Record<string, { icon: any; label: string }> = {
    index: { icon: 'car-side', label: 'Vehicles' },
    home: { icon: 'home', label: 'Home' },
    map: { icon: 'map-marker', label: 'Map' },
    events: { icon: 'bell', label: 'Alerts' },
    settings: { icon: 'cog', label: 'Settings' },
  };

  return (
    <View style={styles.barContainer}>
      <View style={styles.backgroundBar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const config = tabIcons[route.name] || { icon: 'circle', label: route.name };

          const onPress = () => {
            if (navigation?.emit) {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event?.defaultPrevented) {
                navigation.navigate(route.name);
              }
            } else if (navigateToTab) {
              if (!isFocused) {
                navigateToTab(route.key);
              }
            }
          };

          if (isFocused) {
            return (
              <View key={route.key} style={styles.activeSlot}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onPress}
                  style={styles.floatingButton}
                >
                  <MaterialCommunityIcons name={config.icon} size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabSlot}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={config.icon}
                size={24}
                color="rgba(255, 255, 255, 0.85)"
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backgroundBar: {
    flexDirection: 'row',
    height: 58,
    backgroundColor: GTS_COLORS.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  floatingButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: GTS_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
});
