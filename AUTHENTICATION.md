# Authentication Setup

This project uses **Clerk** for authentication with **Convex** as the backend.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web App   │     │  Native App │     │   Backend   │
│  (Next.js)  │     │   (Expo)    │     │   (Convex)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │    ┌──────────────┘                   │
       │    │                                  │
       ▼    ▼                                  ▼
   ┌─────────────────────────────────────────────────┐
   │                   Clerk                          │
   │         (Authentication Provider)                │
   └─────────────────────────────────────────────────┘
```

## Environment Variables

### Web App (`apps/web/.env.local`)

```env
# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER_URL=https://your-domain.clerk.accounts.dev

# OpenRouter
OR_API_KEY=or-...
OR_MANAGEMENT_KEY=or-...
```

### Native App (`apps/native/.env`)

```env
# Convex Configuration
EXPO_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud

# Clerk Authentication
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Convex Backend (`packages/backend/.env.local`)

```env
# Clerk Issuer URL (configured in Convex dashboard)
CLERK_ISSUER_URL=https://your-domain.clerk.accounts.dev

# Optional (required for Convex AI note summaries)
OR_API_KEY=or-...
```

## Setup Instructions

### 1. Clerk Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.dev)
2. Create a new application
3. Configure OAuth providers (Google, Apple) if needed
4. Get your Publishable Key and Secret Key
5. Configure the JWT template for Convex:
   - Go to JWT Templates
   - Create a new template for Convex
   - Set the "aud" claim to "convex"

### 2. Convex Setup

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Set up the environment variable:
   ```
   CLERK_ISSUER_URL=https://your-domain.clerk.accounts.dev
   ```
3. Deploy the backend:
   ```bash
   cd packages/backend
   npx convex dev
   ```

### 3. Web App Setup

1. Copy `.example.env` to `.env.local`
2. Fill in all environment variables
3. The web app uses:
   - `/sign-in` route for authentication
   - `/sign-up` route for registration
   - Middleware for route protection

### 4. Native App Setup

1. Copy `.example.env` to `.env`
2. Fill in all environment variables
3. The native app uses:
   - Secure token storage via `expo-secure-store`
   - OAuth flow for Google/Apple sign-in
   - Automatic navigation based on auth state

## Protected Routes

### Web

Protected routes are defined in `apps/web/src/middleware.ts`:
- Public routes: `/`, `/sign-in`, `/sign-up`
- All other routes require authentication

### Native

Protected routes are handled in `apps/native/src/navigation/Navigation.tsx`:
- Initial route is determined by auth state
- Signed in users see `NotesDashboardScreen`
- Signed out users see `LoginScreen`

## Usage

### Web - Using Auth in Components

```tsx
import { useUser, useAuth } from "@clerk/nextjs";

function MyComponent() {
  const { user, isLoaded } = useUser();
  const { isSignedIn } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;

  return isSignedIn ? <div>Hello {user.firstName}</div> : <div>Please sign in</div>;
}
```

### Native - Using Auth in Components

```tsx
import { useUser, useAuth } from "@clerk/clerk-expo";

function MyComponent() {
  const user = useUser();
  const { isSignedIn, signOut } = useAuth();

  return isSignedIn ? (
    <View>
      <Text>Hello {user.user?.firstName}</Text>
      <Button onPress={signOut}>Sign Out</Button>
    </View>
  ) : (
    <Text>Please sign in</Text>
  );
}
```

### Backend - Protecting Convex Functions

```typescript
import { query } from "./_generated/server";
import { getUserId } from "./notes";

export const myQuery = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Your protected logic here
  },
});
```

## Troubleshooting

### Web App

- **"Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"**: Check your `.env.local` file
- **"ClerkProvider not found"**: Ensure `ConvexClientProvider` is wrapping your app
- **Middleware not working**: Check `src/middleware.ts` is in the correct location

### Native App

- **"Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"**: Check your `.env` file
- **Auth not persisting**: Ensure `expo-secure-store` is installed and token cache is configured
- **OAuth flow fails**: Check OAuth redirect URLs in Clerk dashboard

### Backend

- **"User not found"**: Check `CLERK_ISSUER_URL` is set correctly in Convex dashboard
- **JWT verification fails**: Ensure JWT template "aud" claim matches "convex"
