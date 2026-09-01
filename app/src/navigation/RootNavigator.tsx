import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { CoachOverlay } from '../components/CoachOverlay';
import { DockInsetProvider } from '../components/DockInset';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { TabBar } from '../components/TabBar';
import { COACH } from '../data/content';
import { AgendaScreen } from '../screens/AgendaScreen';
import { CareScreen } from '../screens/CareScreen';
import { CareDataScreen } from '../screens/CareDataScreen';
import { CareAlertsScreen } from '../screens/CareAlertsScreen';
import { CareAuditScreen } from '../screens/CareAuditScreen';
import { CarePlanScreen } from '../screens/CarePlanScreen';
import { CareGuideScreen } from '../screens/CareGuideScreen';
import { CareSignupScreen } from '../screens/CareSignupScreen';
import { CareToolsScreen } from '../screens/CareToolsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MusicScreen } from '../screens/MusicScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { PlaylistDetailScreen } from '../screens/PlaylistDetailScreen';
import { PlaylistEditorScreen } from '../screens/PlaylistEditorScreen';
import { RoutineScreen } from '../screens/RoutineScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { SpotifyImportScreen } from '../screens/SpotifyImportScreen';
import { SpotifyPlayerScreen } from '../screens/SpotifyPlayerScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { VisionScreen } from '../screens/VisionScreen';
import { useApp, useTheme, type Screen } from '../state/AppContext';
import { VisionEngine } from '../vision/VisionEngine';

const SCREENS: Record<Screen, React.ComponentType> = {
  splash: SplashScreen,
  onboarding: OnboardingScreen,
  login: LoginScreen,
  caresignup: CareSignupScreen,
  home: HomeScreen,
  tools: ToolsScreen,
  routine: RoutineScreen,
  music: MusicScreen,
  playlisteditor: PlaylistEditorScreen,
  playlistdetail: PlaylistDetailScreen,
  spotifyimport: SpotifyImportScreen,
  spotifyplayer: SpotifyPlayerScreen,
  dashboard: DashboardEntry,
  care: CareScreen,
  carealerts: CareAlertsScreen,
  careaudit: CareAuditScreen,
  careplan: CarePlanScreen,
  careguide: CareGuideScreen,
  agenda: AgendaScreen,
  caretools: CareToolsScreen,
  chat: ChatScreen,
  guide: GuideScreen,
  plans: PlansScreen,
  settings: SettingsScreen,
  vision: VisionScreen,
};

function DashboardEntry() {
  const { state } = useApp();
  return state.role === 'care' ? <CareDataScreen /> : <DashboardScreen />;
}

/** Telas em que a barra de abas fica escondida. */
const NO_TABS: Screen[] = ['splash', 'onboarding', 'chat', 'login', 'caresignup', 'vision', 'spotifyplayer'];

export function RootNavigator() {
  const { state, actions } = useApp();
  const { T, isDark } = useTheme();

  const home: Screen = state.role === 'care' ? 'care' : 'home';
  const atRoot = state.screen === home || state.screen === 'splash';

  // Botão físico de voltar no Android: cai para a tela inicial do perfil.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (atRoot) return false;
      actions.go(home);
      return true;
    });
    return () => sub.remove();
  }, [atRoot, home, actions]);

  const Current = SCREENS[state.screen];
  const showTabs = !NO_TABS.includes(state.screen);
  const showCoach = state.coach < COACH.length && state.screen === 'home';
  const onSplash = state.screen === 'splash';

  // Troca de tela até aqui era um corte seco (componente inteiro trocado no
  // mesmo frame). O fade não reanima a tela em si, só suaviza a entrada.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [state.screen, fade]);

  return (
    <DockInsetProvider>
      <View style={{ flex: 1, backgroundColor: onSplash ? T.splashBg : T.bg }}>
        <StatusBar style={isDark || onSplash ? 'light' : 'dark'} />
        <VisionEngine />
        <Animated.View style={{ flex: 1, opacity: fade }}>
          <Current />
        </Animated.View>
        {showTabs ? <NowPlayingBar /> : null}
        {showTabs ? <TabBar /> : null}
        {showCoach ? <CoachOverlay /> : null}
      </View>
    </DockInsetProvider>
  );
}
