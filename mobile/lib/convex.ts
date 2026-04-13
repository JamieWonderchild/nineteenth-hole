// Re-export Convex generated API so all mobile screens import from one place.
// The root tsconfig paths map @convex/* → ../convex/* and Metro watchFolders
// ensures the parent directory is resolved by the bundler.
export { api } from "@convex/_generated/api";
export type { Id } from "@convex/_generated/dataModel";
