import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import NotFound from "./pages/NotFound";

export default function AuthenticatedAppRoutes() {
  return (
    <SubscriptionProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SubscriptionProvider>
  );
}
