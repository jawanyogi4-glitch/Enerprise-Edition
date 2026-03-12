import axios from "axios";

export const useTemplateAPI = (payload: any) =>
  axios.post("/api/use-template", payload);

export const runAIContractReviewAPI = (payload: any) =>
  axios.post("/api/ai-contract-review", payload);

export const acceptAutoFixAPI = (payload: any) =>
  axios.post("/api/accept-auto-fix", payload);

export const downloadPDFAPI = (payload: any) =>
  axios.post("/api/download-pdf", payload);