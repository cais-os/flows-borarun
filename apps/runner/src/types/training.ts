export type TrainingType = 'long' | 'recovery' | 'interval' | 'easy';
export type CalendarTrainingType = TrainingType | 'strava';

export interface Training {
  type: TrainingType;
  title: string;
  description: string;
  duration: number; // em minutos
}

// Cores padrão para cada tipo de treino
export const trainingTypeColors: Record<TrainingType, string> = {
  long: '#7acc16',      // Verde "Muito Bem" do FatigueCard
  recovery: '#7dd3fc',  // Azul pastel
  interval: '#a78bfa',  // Roxo médio
  easy: '#f97316'       // Laranja vibrante
};

export const trainingConfig = {
  long: {
    label: 'Longão'
  },
  recovery: {
    label: 'Corrida Regenerativa'
  },
  interval: {
    label: 'Tiros'
  },
  easy: {
    label: 'Corrida de Ritmo'
  }
};

export interface FatigueLog {
  id: string;
  user_id: string;
  date: string;
  level: number; // 1-5
  created_at: string;
}

export interface TrainingPlan {
  id: string;
  user_id: string;
  goal_type: 'start_running' | 'half_marathon' | 'marathon' | '10k' | '5k';
  goal_distance: number; // em km (21, 42.2, 10, 5)
  race_date: string;
  start_date: string;
  total_weeks: number;
  total_distance: number; // distância total do plano em km
  completed_weeks: number;
  completed_distance: number;
  created_at: string;
}

export const goalTypeLabels = {
  'start_running': 'iniciante',
  'half_marathon': 'meia maratona',
  'marathon': 'maratona',
  '10k': '10k',
  '5k': '5k'
};

export interface WeeklyTraining {
  id: string;
  day: string;
  date: string;
  type: TrainingType;
  name: string;
  title: string;
  description: string;
  distance: number;
  duration: number; // em minutos
  completed: boolean;
  actual_distance?: number;
  actual_time?: string;
  actual_elapsed_time?: number;
  actual_pace?: number | string;
  strava_activity_id?: number | null;
  source?: 'plan' | 'manual' | 'strava' | string;
  warmupInstructions?: string;
  steps?: Array<{
    stepNumber: number;
    instruction: string;
    activityType: 'running' | 'walking';
  }>;
  coachTip?: string;
  coachName?: string;
  coachAvatar?: string;
}

export interface ManualTraining {
  id: string;
  date: string;
  type: TrainingType | string;
  distance: number;
  elapsed_time: number;
  pace?: number | null;
  completed: boolean;
  completed_at?: string | null;
  actual_distance?: number | null;
  actual_elapsed_time?: number | null;
  actual_pace?: number | null;
  difficulty_level?: number | null;
  feedbacks?: string | null;
  source?: 'manual' | string | null;
}

export interface TrainingWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  trainings: WeeklyTraining[];
  totalTrainings: number;
  totalDistance: number;
  completedTrainings: number;
  completedDistance: number;
  totalDuration: number;
  completedDuration: number;
}
