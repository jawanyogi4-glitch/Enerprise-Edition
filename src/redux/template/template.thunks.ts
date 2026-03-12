import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  useTemplateAPI,
  runAIContractReviewAPI,
  acceptAutoFixAPI,
  downloadPDFAPI,
} from "./template.api";

export const useTemplateThunk = createAsyncThunk(
  "template/useTemplate",
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await useTemplateAPI(payload);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "API Error");
    }
  }
);

export const runAIContractReview = createAsyncThunk(
  "template/aiContractReview",
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await runAIContractReviewAPI(payload);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "API Error");
    }
  }
);

export const acceptAutoFixThunk = createAsyncThunk(
  "template/acceptAutoFix",
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await acceptAutoFixAPI(payload);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "API Error");
    }
  }
);

export const downloadPDFThunk = createAsyncThunk(
  "template/downloadPDF",
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await downloadPDFAPI(payload);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "API Error");
    }
  }
);