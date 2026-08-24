import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Import por peso: o barril `@expo-google-fonts/nunito` empacotaria os 16
// arquivos da família, e o app usa cinco.
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';

import { MusicProvider } from './src/audio/MusicPlayer';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SpotifyProvider } from './src/spotify/spotifyClient';
import { AppProvider } from './src/state/AppContext';
import { LIGHT } from './src/theme/palette';

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // A Nunito carrega antes da primeira tela para não haver troca de fonte visível.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: LIGHT.splashBg }} />;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <MusicProvider>
          <SpotifyProvider>
            <RootNavigator />
          </SpotifyProvider>
        </MusicProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
