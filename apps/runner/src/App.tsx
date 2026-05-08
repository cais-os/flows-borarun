import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import WeekView from "./pages/WeekView";
import Plan from "./pages/Plan";
import Trainer from "./pages/Trainer";
import PublicPlan from "./pages/PublicPlan";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SubscriptionProvider>
        <Toaster />
        <Sonner />
        <AppErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/plano/:phone" element={<PublicPlan />} />
              <Route
                path="/subscription"
                element={
                  <ProtectedRoute requiresAuth={true}>
                    <Subscription />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/checkout-success"
                element={
                  <ProtectedRoute requiresAuth={true}>
                    <CheckoutSuccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requiresAuth={true}>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requiresAuth={true} requiresOnboarding={true}>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requiresAuth={true} requiresOnboarding={true}>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/week/:weekNumber?"
                element={
                  <ProtectedRoute requiresAuth={true} requiresOnboarding={true}>
                    <WeekView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plan"
                element={
                  <ProtectedRoute requiresAuth={true} requiresOnboarding={true}>
                    <Plan />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/treinador"
                element={
                  <ProtectedRoute requiresAuth={true} requiresOnboarding={true}>
                    <Trainer />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppErrorBoundary>
      </SubscriptionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
