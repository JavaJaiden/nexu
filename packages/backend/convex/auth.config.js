// Clerk authentication configuration for Convex
// See: https://docs.convex.dev/auth/clerk

export default {
  providers: [
    {
      // The domain from your Clerk JWT template issuer URL
      // Format: https://your-domain.clerk.accounts.dev
      domain: process.env.CLERK_ISSUER_URL,
      // The application ID - must match the "aud" claim in your Clerk JWT
      applicationID: "convex",
    },
  ],
};
