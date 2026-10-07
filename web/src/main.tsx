import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import Layout from "./components/Layout";
import ApplyPage from "./pages/ApplyPage";
import CalendarPage from "./pages/CalendarPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProgrammePage from "./pages/ProgrammePage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CalendarPage />} />
            <Route path="programmes/:slug" element={<ProgrammePage />} />
            <Route path="apply/:intakeId" element={<ApplyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);