"use client";

import React, { createContext, useContext } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import type { Id, Doc } from "convex/_generated/dataModel";

interface ClubContextValue {
  club: Doc<"clubs"> | null | undefined;  // undefined = loading
  membership: Doc<"clubMembers"> | null | undefined;
  isAdmin: boolean;
  isLoading: boolean;
}

const ClubCtx = createContext<ClubContextValue>({
  club: undefined,
  membership: undefined,
  isAdmin: false,
  isLoading: true,
});

export function ClubContextProvider({
  clubSlug,
  children,
}: {
  clubSlug: string;
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const club = useQuery(api.clubs.getBySlug, { slug: clubSlug });
  const membership = useQuery(
    api.clubMembers.getByClubAndUser,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );

  const isLoading = club === undefined || (!!user && membership === undefined);
  const isAdmin = membership?.role === "admin";

  return (
    <ClubCtx.Provider value={{ club: club ?? null, membership: membership ?? null, isAdmin, isLoading }}>
      {children}
    </ClubCtx.Provider>
  );
}

export function useClubCtx() {
  return useContext(ClubCtx);
}
