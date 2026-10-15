import { KeyRound, Link2 } from "lucide-react";
import type { ViewField } from "@/lib/api";

const keyLabels: Record<NonNullable<ViewField["key"]>, string> = {
  primary: "Primary key",
  partition: "Partition key",
  sort: "Sort key",
  foreign: "Foreign key",
  unique: "Unique",
};

// The marker in front of a field: a key for primary, partition, and sort keys, a link for
// foreign keys, and a "U" for unique fields; blank for the rest, so names stay aligned.
export function FieldKey({ field }: { field: ViewField }) {
  const label = field.key && keyLabels[field.key];
  return (
    <span className={`field-key ${field.key ?? ""}`} title={label} aria-label={label}>
      {field.key === "foreign" ? (
        <Link2 size={9} />
      ) : field.key === "unique" ? (
        "U"
      ) : field.key ? (
        <KeyRound size={9} />
      ) : null}
    </span>
  );
}
