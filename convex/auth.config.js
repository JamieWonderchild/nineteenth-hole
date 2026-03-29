// convex/auth.config.js
export default {
    providers: [
      {
        domain: "outgoing-hermit-86.clerk.accounts.dev", // Development
        applicationID: "convex",
      },
      {
        domain: "clerk.lamina.vet", // Production
        applicationID: "convex",
      }
    ]
  };