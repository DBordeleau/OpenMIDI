import { redirect } from "next/navigation";

export default function SavedMidiPatternsRedirect() {
  redirect("/library/collection?source=saved");
}
