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
import { CheckinScreen } from '../screens/CheckinScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FairnessScreen } from '../screens/FairnessScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { LullabyScreen } from '../screens/LullabyScreen';
import { WardrobeScreen } from '../screens/WardrobeScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { HeatmapScreen } from '../screens/HeatmapScreen';
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
import { CrisisPlanScreen } from '../screens/CrisisPlanScreen';
import { SosScreen } from '../screens/SosScreen';
import { GroupsScreen } from '../screens/GroupsScreen';

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
  checkin: CheckinScreen,
  heatmap: HeatmapScreen,
  friends: FriendsScreen,
  fairness: FairnessScreen,
  lullaby: LullabyScreen,
  sos: SosScreen,
  groups: GroupsScreen,
  crisisplan: CrisisPlanScreen,
  wardrobe: WardrobeScreen,
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

/** Únicas telas acessíveis sem sessão. */
const PUBLIC_SCREENS: Screen[] = ['splash', 'login'];

/** Telas em que a barra de abas fica escondida. */
const NO_TABS: Screen[] = ['splash', 'onboarding', 'chat', 'login', 'caresignup', 'vision', 'spotifyplayer'];

export function RootNavigator() {
  const { state, actions } = useApp();
  const { T, isDark } = useTheme();

  const home: Screen = state.role === 'care' ? 'care' : 'home';
  // Guarda de rota: sem sessão só existem a abertura e o login. Antes o
  // "voltar" do login (ou um link de widget) abria a Home com userId nulo.
  const signedOut = !state.userId;
  const screen: Screen = signedOut && !PUBLIC_SCREENS.includes(state.screen) ? 'login' : state.screen;
  const atRoot = screen === home || screen === 'splash' || signedOut;

  // Botão físico de voltar no Android: cai para a tela inicial do perfil;
  // sem sessão (ou já na inicial), sai do app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (atRoot) return false;
      actions.go(home);
      return true;
    });
    return () => sub.remove();
  }, [atRoot, home, actions]);

  const Current = SCREENS[screen];
  const showTabs = !NO_TABS.includes(screen) && !signedOut;
  const showCoach = state.coach < COACH.length && screen === 'home';
  const onSplash = screen === 'splash';

  // Troca de tela até aqui era um corte seco (componente inteiro trocado no
  // mesmo frame). O fade não reanima a tela em si, só suaviza a entrada.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [screen, fade]);

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
