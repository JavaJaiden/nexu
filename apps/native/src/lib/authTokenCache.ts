import * as SecureStore from "expo-secure-store";

// Token cache interface matching Clerk's requirements
interface TokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
}

// Secure token cache for Clerk authentication
// This persists the auth token securely on the device using expo-secure-store

const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        const item = await SecureStore.getItemAsync(key);
        if (item) {
          console.log(`Retrieved token for key: ${key}`);
        }
        return item;
      } catch (error) {
        console.error(`Error getting token for key ${key}:`, error);
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        await SecureStore.setItemAsync(key, token);
        console.log(`Saved token for key: ${key}`);
      } catch (error) {
        console.error(`Error saving token for key ${key}:`, error);
      }
    },
  };
};

// Export the token cache instance
export const authTokenCache = createTokenCache();

// Helper function to clear auth tokens (useful for sign out)
export const clearAuthTokens = async () => {
  try {
    await SecureStore.deleteItemAsync("clerk-token");
    console.log("Cleared auth tokens");
  } catch (error) {
    console.error("Error clearing auth tokens:", error);
  }
};
