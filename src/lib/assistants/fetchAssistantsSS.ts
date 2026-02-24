import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { fetchSS } from "../utilsSS";

export type FetchAssistantsResponse = [MinimalPersonaSnapshot[], string | null];

// export async function fetchAssistantsSS(): Promise<FetchAssistantsResponse> {
//   const response = await fetchSS("/persona");
//   if (response.ok) {
//     return [(await response.json()) as MinimalPersonaSnapshot[], null];
//   }
//   return [[], (await response.json()).detail || "Unknown Error"];
// }

export async function fetchAssistantsSS(): Promise<FetchAssistantsResponse> {
  try {
    const response = await fetchSS("/persona");

    if (response.ok) {
      return [(await response.json()) as MinimalPersonaSnapshot[], null];
    }

    const errorData = await response.json().catch(() => ({}));

    return [[], errorData.detail || "Unknown Error"];
  } catch (error) {
    console.warn("Mocking assistants because backend not available");

    // Return empty assistants safely
    return [[], null];
  }
}
