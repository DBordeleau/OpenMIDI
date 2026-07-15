export type CreditRole =
  "creator" | "derivation" | "performer" | "producer" | "engineer" | "other";

export type CreditSnapshot = {
  creditName: string;
  role: CreditRole;
  position: number;
  profileUsername: string | null;
};

export type RevisionAttribution = {
  creditName: string;
  profileUsername: string | null;
};

export const creditRoleLabels: Record<CreditRole, string> = {
  creator: "Creator",
  derivation: "Derived from",
  performer: "Performer",
  producer: "Producer",
  engineer: "Engineer",
  other: "Other",
};

export function aggregateCredits(
  tracks: readonly { credits: readonly CreditSnapshot[] }[],
): CreditSnapshot[] {
  const seen = new Set<string>();
  return tracks.flatMap(({ credits }) =>
    credits.filter((credit) => {
      const identity =
        credit.profileUsername?.toLowerCase() ??
        credit.creditName.toLowerCase();
      const key = `${identity}\u0000${credit.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}
