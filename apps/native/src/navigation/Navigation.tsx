import { useAuth } from "@clerk/clerk-expo";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text } from "tamagui";
import CreateNoteScreen from "../screens/CreateNoteScreen";
import InsideNoteScreen from "../screens/InsideNoteScreen";
import LoginScreen from "../screens/LoginScreen";
import NotesDashboardScreen from "../screens/NotesDashboardScreen";

const Stack = createNativeStackNavigator();

// Loading screen while auth state is being determined
const AuthLoadingScreen = () => (
  <View flex={1} backgroundColor="$background" alignItems="center" justifyContent="center">
    <Text color="$color" fontSize={16}>
      Loading...
    </Text>
  </View>
);

const Navigation = () => {
  const { isSignedIn, isLoaded } = useAuth();

  // Show loading screen while Clerk is initializing
  if (!isLoaded) {
    return <AuthLoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        id={undefined}
        // If signed in, start at NotesDashboard, otherwise start at Login
        initialRouteName={isSignedIn ? "NotesDashboardScreen" : "LoginScreen"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen
          name="NotesDashboardScreen"
          component={NotesDashboardScreen}
        />
        <Stack.Screen name="InsideNoteScreen" component={InsideNoteScreen} />
        <Stack.Screen name="CreateNoteScreen" component={CreateNoteScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
