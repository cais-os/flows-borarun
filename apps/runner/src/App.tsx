import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import PublicPlan from "./pages/PublicPlan";

const queryClient = new QueryClient();
const AuthenticatedAppRoutes = lazy(() => import("./AuthenticatedAppRoutes"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/plano/:phone" element={<PublicPlan />} />
            <Route
              path="/*"
              element={
                <Suspense
                  fallback={
                    <main className="flex min-h-screen items-center justify-center bg-background" />
                  }
                >
                  <AuthenticatedAppRoutes />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </AppErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
