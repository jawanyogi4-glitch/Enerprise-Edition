import { configureStore } from "@reduxjs/toolkit";
import templateReducer from "./template/template.slice";

export const store = configureStore({
  reducer: {
    template: templateReducer,
    // other reducers...
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;