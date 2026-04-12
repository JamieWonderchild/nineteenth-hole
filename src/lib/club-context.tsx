"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

interface ClubContextValue {
  selectedClubId: Id<"clubs"> | null;
  setSelectedClubId: (id: Id<"clubs">) => void;
}

const ClubContext = createContext<ClubContextValue>({
  selectedClubId: null,
  setSelectedClubId: () => {},
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const [selectedClubId, setSelectedClubIdState] = useState<Id<"clubs"> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("selectedClubId") as Id<"clubs"> | null;
    if (stored) setSelectedClubIdState(stored);
  }, []);

  function setSelectedClubId(id: Id<"clubs">) {
    setSelectedClubIdState(id);
    localStorage.setItem("selectedClubId", id);
  }

  return (
    <ClubContext.Provider value={{ selectedClubId, setSelectedClubId }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClubContext() {
  return useContext(ClubContext);
}

// Drop-in replacement for the old pattern:
//   const memberships = useQuery(api.clubMembers.listByUser, ...);
//   const activeMembership = memberships?.find(m => m.status === "active");
//   const club = useQuery(api.clubs.get, ...);
export function useActiveClub() {
  const { selectedClubId } = useClubContext();
  const myClubs = useQuery(api.clubMembers.myActiveClubs);

  const entry = (() => {
    if (!myClubs?.length) return undefined;
    if (selectedClubId) {
      const match = myClubs.find(c => c.club._id === selectedClubId);
      if (match) return match;
    }
    return myClubs[0];
  })();

  return {
    activeMembership: entry?.membership ?? undefined,
    club: entry?.club ?? null,
    myClubs: myClubs ?? [],
    selectedClubId,
  };
}
