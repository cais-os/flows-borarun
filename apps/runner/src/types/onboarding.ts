export interface OnboardingData {
  user_id?: string; // Opcional no frontend, obrigatório na edge function
  name: string;
  birthDate: string;
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  // Campos de corrida
  runningLevel: 'never' | 'beginner' | 'intermediate' | 'advanced' | 'elite';
  currentRunningDays: number;
  runningDistance: number | null;
  runningHours: number;
  runningMinutes: number;
  availableDays: string[];
  desiredWeeklyDays: number;
  longRunDays: string[];
  startDate: Date | null;
  runningGoal: 'start_running' | 'specific_distance';
  goalDistance: number | null;
  goalHours: number;
  goalMinutes: number;
  goalTime: '8' | '10' | '12' | '16' | 'custom' | null;
  customGoalWeeks: number;
  targetDate: Date | null;
  onboarding_channel?: 'app' | 'whatsapp';
}

// Interface removida - não calculamos mais metas calóricas

export interface UserProfile extends OnboardingData {
  id: string;
  userId?: string;
  onboardingCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}
