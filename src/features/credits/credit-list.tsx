import Link from "next/link";
import { creditRoleLabels, type CreditSnapshot } from "./types";

export function CreditList({
  credits,
}: {
  credits: readonly CreditSnapshot[];
}) {
  return (
    <ul className="space-y-1">
      {credits.map((credit) => (
        <li key={`${credit.position}-${credit.creditName}-${credit.role}`}>
          <span className="text-muted">{creditRoleLabels[credit.role]}:</span>{" "}
          {credit.profileUsername ? (
            <Link className="underline" href={`/@${credit.profileUsername}`}>
              {credit.creditName}
            </Link>
          ) : (
            credit.creditName
          )}
        </li>
      ))}
    </ul>
  );
}
