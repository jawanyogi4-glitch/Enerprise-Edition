import { redirect } from "next/navigation";

export default async function Page() {
  // Completely bypass authentication
  redirect("/chat");
}
