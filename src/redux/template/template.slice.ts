import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TemplateState } from "./template.types";
import {
  useTemplateThunk,
  runAIContractReview,
  acceptAutoFixThunk,
  downloadPDFThunk,
} from "./template.thunks";

const initialState: TemplateState = {
  formData: null,
  templates: null,
  usedTemplate: null,
  reviewResult: null,
  acceptAutoFix: null,
  loading: false,
  error: null,
};

const templateSlice = createSlice({
  name: "template",
  initialState,
  reducers: {
    setTemplateData: (
      state,
      action: PayloadAction<{ formData: any; templates: any }>
    ) => {
      state.formData = action.payload.formData;
      state.templates = action.payload.templates;
    },
    clearTemplateData: (state) => {
      state.formData = null;
      state.templates = null;
    },
  },
  extraReducers: (builder) => {
    builder

      // use template
      .addCase(useTemplateThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(useTemplateThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.usedTemplate = action.payload;
      })
      .addCase(useTemplateThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // AI review
      .addCase(runAIContractReview.pending, (state) => {
        state.loading = true;
      })
      .addCase(runAIContractReview.fulfilled, (state, action) => {
        state.loading = false;
        state.reviewResult = action.payload;
      })
      .addCase(runAIContractReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // accept autofix
      .addCase(acceptAutoFixThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(acceptAutoFixThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.acceptAutoFix = action.payload;
      })
      .addCase(acceptAutoFixThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // download pdf
      .addCase(downloadPDFThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(downloadPDFThunk.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(downloadPDFThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setTemplateData, clearTemplateData } =
  templateSlice.actions;

export default templateSlice.reducer;