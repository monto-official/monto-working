import type { ChildProfile } from "@/types";

/** Renders the child's photo (when selected and set) or their emoji avatar.
 * Caller provides a sized, `overflow-hidden` container — this just fills it. */
export function ChildAvatar({ child }: { child: ChildProfile }) {
  if (child.avatar === "photo" && child.photo) {
    return <img src={child.photo} alt="" className="w-full h-full object-cover" />;
  }
  return <>{child.avatar || "👦"}</>;
}
