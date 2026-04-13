import "../global.css";
import "react-native-url-polyfill/auto";

import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  async deleteToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <StatusBar style="auto" />
        <Slot />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
