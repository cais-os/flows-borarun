import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, addDays, differenceInWeeks } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useSubscriptionContext } from "@/contexts/SubscriptionContext";
import { useTrainingByDate } from "@/hooks/useTrainingByDate";
import { useTrainingPlan } from "@/hooks/useTrainingPlan";
import { useWeeklyTrainings } from "@/hooks/useWeeklyTrainings";

import { AppHeader } from "@/components/AppHeader";
import { WeekSelector } from "@/components/WeekSelector";
import { CalendarStrip } from "@/components/CalendarStrip";
import { DailyTrainingCard } from "@/components/DailyTrainingCard";
import { WeeklyRunningCards } from "@/components/WeeklyRunningCards";
import { FatigueCard } from "@/components/FatigueCard";
import { CoachTipCard } from "@/components/CoachTipCard";
import { BottomNav } from "@/components/BottomNav";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TrainingGenerationBanner } from "@/components/TrainingGenerationBanner";
import { RegenerateTrainingPlanButton } from "@/components/RegenerateTrainingPlanButton";
import { useTrainingGenerationStatus } from "@/hooks/useTrainingGenerationStatus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Lock } from "lucide-react";
import { AddTrainingFAB } from "@/components/AddTrainingFAB";
import { CreateManualTrainingDialog } from "@/components/CreateManualTrainingDialog";
import { useManualTrainings } from "@/hooks/useManualTrainings";
import { useStravaActivities } from "@/hooks/useStravaActivities";
import { ManualTrainingDialog } from "@/components/ManualTrainingDialog";
import { StravaActivityDialog } from "@/components/StravaActivityDialog";

import { CalendarTrainingType, TrainingType, trainingTypeColors, trainingConfig } from "@/types/training";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteManualTraining } from "@/hooks/useDeleteManualTraining";
import { useWelcomeScreen } from "@/hooks/useWelcomeScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnedDate = (location.state as any)?.selectedDate;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { isOnboardingCompleted, isLoading: isCheckingOnboarding } = useOnboardingStatus();
  const { subscription, canAddEntries } = useSubscriptionContext();
  const { isGenerating } = useTrainingGenerationStatus();
  const { shouldShowWelcome, markAsSeen, isMarking } = useWelcomeScreen();
  const prevIsGeneratingRef = useRef<boolean | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return returnedDate ? new Date(returnedDate) : new Date();
  });

  const [currentWeek, setCurrentWeek] = useState<Date>(() => {
    if (returnedDate) {
      const date = new Date(returnedDate);
      return startOfWeek(date, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [isRestoringWeek, setIsRestoringWeek] = useState(false);

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Fade transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Manual training dialog
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualDialogMode, setManualDialogMode] = useState<'create' | 'edit'>('create');
  const [manualEditTraining, setManualEditTraining] = useState<any | null>(null);

  // Dialog state - rastrear se algum dialog está aberto
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogOpenCountRef = useRef(0);

  const [selectedManualTraining, setSelectedManualTraining] = useState<any | null>(null);
  const [selectedStravaActivity, setSelectedStravaActivity] = useState<any | null>(null);
  const [selectedStravaTraining, setSelectedStravaTraining] = useState<any | null>(null);
  const handleManualDialogChange = (open: boolean) => {
    const mode = manualDialogMode || 'create';
    if (user?.id) {
      const eventName = open
        ? "activity_opened_manual_training_dialog"
        : "activity_closed_manual_training_dialog";
      track(eventName, user.id, {
        metadata: { mode },
      }).catch((error) => console.warn(`Failed to track ${eventName}`, error));
    }
    setShowManualDialog(open);
    if (!open) {
      setManualDialogMode('create');
      setManualEditTraining(null);
    }
  };

  const handleFabClick = () => {
    if (user?.id) {
      track("activity_clicked_fab", user.id, {
        metadata: { source: "manual_training" },
      }).catch((error) => console.warn("Failed to track activity_clicked_fab", error));
      track("activity_opened_manual_training_dialog", user.id, {
        metadata: { mode: "create" },
      }).catch((error) => console.warn("Failed to track activity_opened_manual_training_dialog", error));
    }
    setManualDialogMode('create');
    setManualEditTraining(null);
    setShowManualDialog(true);
  };

  const handleDialogStateChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      dialogOpenCountRef.current += 1;
      setIsDialogOpen(true);
    } else {
      dialogOpenCountRef.current = Math.max(0, dialogOpenCountRef.current - 1);
      if (dialogOpenCountRef.current === 0) {
        setIsDialogOpen(false);
      }
    }
  }, []);

  // Buscar plano antes de usar nos useEffects
  const { trainingPlan: plan, isLoading: isPlanLoading } = useTrainingPlan();
  const totalWeeks = plan?.total_weeks;

  // Calcular currentWeekNumber de forma derivada
  const currentWeekNumber = useMemo(() => {
    if (!plan?.start_date) return 1;
    const planStart = startOfWeek(new Date(plan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
    const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekNumber = differenceInWeeks(currentWeekStart, planStart) + 1;
    return weekNumber;
  }, [currentWeek, plan?.start_date, totalWeeks]);

  // Calculate if content should be blurred for pre-trial users on weeks 3+
  const shouldBlurContent = useMemo(() => {
    const isPreTrial = subscription?.status === 'pre-trial';
    return isPreTrial && currentWeekNumber >= 3;
  }, [subscription?.status, currentWeekNumber]);

  // Detectar quando a geração de treino termina e invalidar queries
  useEffect(() => {
    const prevIsGenerating = prevIsGeneratingRef.current;
    const currentIsGenerating = isGenerating;

    // Se mudou de true para false (geração acabou de terminar)
    if (prevIsGenerating === true && currentIsGenerating === false) {
      console.log('✅ Geração de treino concluída na página Index! Invalidando queries...');
      // Invalidar todas as queries relacionadas a treinos para atualizar o datepicker
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['training-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['training-plan'] });
      queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
    }

    // Atualizar referência
    prevIsGeneratingRef.current = currentIsGenerating;
  }, [isGenerating, queryClient]);

  // Sincronizar com returnedDate quando voltar da página de treino
  useEffect(() => {
    if (isPlanLoading) {
      return;
    }

    if (returnedDate) {
      const date = new Date(returnedDate);
      setSelectedDate(date);

      const storedWeekNumber = sessionStorage.getItem('returnWeekNumber');
      const stateWeekNumber = (location.state as any)?.currentWeekNumber;

      if (storedWeekNumber || stateWeekNumber) {
        const weekNumber = parseInt(storedWeekNumber || stateWeekNumber);

        if (plan?.start_date) {
          setIsRestoringWeek(true);
          const planStart = startOfWeek(new Date(plan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
          const targetWeek = addWeeks(planStart, weekNumber - 1);
          setCurrentWeek(targetWeek);

          sessionStorage.removeItem('returnWeekNumber');

          setTimeout(() => {
            setIsRestoringWeek(false);
          }, 300);
        }
      } else {
        setCurrentWeek(startOfWeek(date, { weekStartsOn: 1 }));
      }

      queryClient.invalidateQueries({ queryKey: ['training-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-trainings'] });
      queryClient.invalidateQueries({ queryKey: ['strava-activities'] });
    }
  }, [returnedDate, queryClient, location.state, plan, isPlanLoading]);

  // Calcular início e fim da semana atual para buscar treinos por data
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // Expandir range para cobrir todas as semanas do carrossel (4 atrás, 8 à frente)
  const extendedWeekStart = startOfWeek(subWeeks(currentWeek, 4), { weekStartsOn: 1 });
  const extendedWeekEnd = endOfWeek(addWeeks(currentWeek, 8), { weekStartsOn: 1 });

  const { data: training, isLoading: loadingTraining } = useTrainingByDate(selectedDate);
  const { data: weeklyTrainings } = useWeeklyTrainings(extendedWeekStart, extendedWeekEnd);
  const { data: currentWeekTrainings } = useWeeklyTrainings(weekStart, weekEnd);
  const { data: manualTrainings } = useManualTrainings(extendedWeekStart, extendedWeekEnd);
  const { data: stravaActivities } = useStravaActivities(extendedWeekStart, extendedWeekEnd);
  const deleteManualTraining = useDeleteManualTraining();

  const manualTrainingsForSelectedDate = useMemo(() => {
    if (!manualTrainings) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return manualTrainings
      .filter((t) => t.date === key)
      .map((t) => ({
        ...t,
        title: trainingConfig[t.type as TrainingType]?.label || 'Corrida manual',
        completed: true,
        description: null,
        actual_distance: t.actual_distance ?? t.distance,
        actual_elapsed_time: t.actual_elapsed_time ?? t.elapsed_time,
        actual_pace: t.actual_pace ?? t.pace ?? (t.distance && t.elapsed_time ? Math.round(t.elapsed_time / (t.distance / 1000)) : null),
        source: 'manual',
      }));
  }, [manualTrainings, selectedDate]);

  const currentWeekManualTrainings = useMemo(() => {
    if (!manualTrainings) return [];
    return manualTrainings
      .filter((t) => {
        const d = new Date(t.date + 'T12:00:00');
        return d >= weekStart && d <= weekEnd;
      })
      .map((t) => ({
        ...t,
        title: trainingConfig[t.type as TrainingType]?.label || 'Corrida manual',
        completed: true,
        description: null,
        actual_distance: t.actual_distance ?? t.distance,
        actual_elapsed_time: t.actual_elapsed_time ?? t.elapsed_time,
        actual_pace: t.actual_pace ?? t.pace ?? (t.distance && t.elapsed_time ? Math.round(t.elapsed_time / (t.distance / 1000)) : null),
        source: 'manual',
      }));
  }, [manualTrainings, weekStart, weekEnd]);

  // Get linked Strava activity IDs from all plan trainings (within range) to avoid duplicates
  const linkedStravaActivityIds = useMemo(() => {
    const linkedIds = new Set<number>();
    if (weeklyTrainings) {
      weeklyTrainings.forEach((t: any) => {
        if (t.strava_activity_id) {
          linkedIds.add(t.strava_activity_id);
        }
      });
    }
    return linkedIds;
  }, [weeklyTrainings]);

  const stravaActivitiesMap = useMemo(() => {
    const map = new Map<number, any>();
    (stravaActivities || []).forEach((activity) => {
      map.set(activity.activity_id, activity);
    });
    return map;
  }, [stravaActivities]);

  // Filter Strava activities for selected date and exclude linked ones
  const stravaActivitiesForSelectedDate = useMemo(() => {
    if (!stravaActivities) return [];
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

    return stravaActivities
      .filter((activity) => {
        if (!activity.start_date) return false;
        const activityDate = format(new Date(activity.start_date), 'yyyy-MM-dd');
        return activityDate === selectedDateStr;
      })
      .filter((activity) => {
        // Only show activities that are NOT linked to a training
        return !linkedStravaActivityIds.has(activity.activity_id);
      })
      .filter((activity) => {
        // Only show Run activities or similar
        return activity.type === 'Run' || activity.sport_type === 'Run';
      });
  }, [stravaActivities, selectedDate, linkedStravaActivityIds]);

  const combinedTrainingsForDay = useMemo(() => {
    const plan = (training || []).map((t: any) => {
      const matchedActivity = t.strava_activity_id ? stravaActivitiesMap.get(t.strava_activity_id) : null;
      const trainingTitle = matchedActivity?.name || t.title;
      return { ...t, source: 'plan', title: trainingTitle };
    });
    const manual = manualTrainingsForSelectedDate || [];

    // Convert Strava activities to training card format
    const strava = stravaActivitiesForSelectedDate.map((activity) => {
      // Calculate pace from average_speed (m/s) to seconds per km
      let pace: number | null = null;
      if (activity.average_speed && activity.average_speed > 0) {
        // average_speed is in m/s, convert to seconds per km
        pace = 1000 / activity.average_speed;
      }

      return {
        id: `strava-${activity.activity_id}`,
        date: format(new Date(activity.start_date || activity.created_at), 'yyyy-MM-dd'),
        type: 'easy' as TrainingType, // Default type for Strava activities
        title: activity.name || 'Corrida do Strava',
        description: null,
        elapsed_time: activity.elapsed_time || activity.moving_time || 0,
        distance: activity.distance || 0,
        completed: true, // Strava activities are always completed
        actual_distance: activity.distance || null,
        actual_elapsed_time: activity.elapsed_time || activity.moving_time || null,
        pace: pace,
        actual_pace: pace,
        difficulty_level: null,
        feedbacks: null,
        training_plan_id: null,
        strava_activity_id: activity.activity_id,
        source: 'strava',
      };
    });

    return [...plan, ...manual, ...strava];
  }, [training, manualTrainingsForSelectedDate, stravaActivitiesForSelectedDate]);

  // Criar mapa de tipos de treino por data para o CalendarStrip
  const trainingTypesByDate: Record<string, CalendarTrainingType> = useMemo(() => {
    const map: Record<string, CalendarTrainingType> = {};

    const appendTraining = (dateValue: string, typeValue: string | null | undefined) => {
      if (!typeValue) return;
      const type = typeValue as TrainingType;
      if (['long', 'recovery', 'interval', 'easy'].includes(type)) {
        map[dateValue] = type;
      }
    };

    weeklyTrainings?.forEach(training => {
      const trainingDate = typeof training.date === 'string'
        ? training.date
        : format(training.date, 'yyyy-MM-dd');
      appendTraining(trainingDate, training.type);
    });

    manualTrainings?.forEach(training => {
      appendTraining(training.date, training.type as TrainingType);
    });

    // Add Strava activities to the map (only unlinked ones) if no plan/manual on that date
    stravaActivities?.forEach(activity => {
      if (!activity.start_date) return;
      const activityDate = format(new Date(activity.start_date), 'yyyy-MM-dd');
      // Only add if not already linked and if no plan/manual training registered for that date
      if (!linkedStravaActivityIds.has(activity.activity_id) && !map[activityDate]) {
        map[activityDate] = 'strava';
      }
    });

    return map;
  }, [weeklyTrainings, manualTrainings, stravaActivities, linkedStravaActivityIds]);

  // Get Strava activities for current week (unlinked only)
  const currentWeekStravaActivities = useMemo(() => {
    if (!stravaActivities) return [];
    return stravaActivities
      .filter((activity) => {
        if (!activity.start_date) return false;
        const activityDate = new Date(activity.start_date);
        return activityDate >= weekStart && activityDate <= weekEnd;
      })
      .filter((activity) => {
        // Only include activities that are NOT linked to a training
        return !linkedStravaActivityIds.has(activity.activity_id);
      })
      .filter((activity) => {
        // Only include Run activities
        return activity.type === 'Run' || activity.sport_type === 'Run';
      });
  }, [stravaActivities, weekStart, weekEnd, linkedStravaActivityIds]);

  // Calcular estatísticas da semana com dados reais
  const weeklyStats = useMemo(() => {
    // Totais devem vir APENAS do plano (não incluir manuais/Strava)
    const planTrainings = currentWeekTrainings || [];
    const totalRuns = planTrainings.length;
    const totalDistance = planTrainings.reduce((sum, t) => sum + Number(t.distance || 0), 0);

    // Completados podem vir do realizado (plano + manuais + Strava)
    const combined = [
      ...(currentWeekTrainings || []),
      ...(currentWeekManualTrainings || []),
    ];

    // Add Strava activities to stats
    const stravaStats = currentWeekStravaActivities.map((activity) => ({
      completed: true,
      distance: activity.distance || 0,
      actual_distance: activity.distance || 0,
    }));

    const allCombined = [...combined, ...stravaStats];

    const completedRuns = allCombined.filter(t => t.completed).length;
    const completedDistance = allCombined
      .filter(t => t.completed)
      .reduce((sum, t) => sum + Number(t.actual_distance || t.distance || 0), 0);

    return {
      totalRuns,
      completedRuns,
      totalDistance,
      completedDistance
    };
  }, [currentWeekTrainings, currentWeekManualTrainings, currentWeekStravaActivities]);

  // Verificar se a data selecionada está fora do plano de treino
  const isSelectedDateOutsidePlan = useMemo(() => {
    if (!plan?.start_date || !totalWeeks) return false;

    const planStart = startOfWeek(new Date(plan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
    const planEnd = addWeeks(planStart, totalWeeks);

    return selectedDate < planStart || selectedDate >= planEnd;
  }, [selectedDate, plan?.start_date, totalWeeks]);

  // Verificar se a data está depois do fim do plano
  const isAfterPlanEnd = useMemo(() => {
    if (!plan?.start_date || !totalWeeks) return false;

    const planStart = startOfWeek(new Date(plan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
    const planEnd = addWeeks(planStart, totalWeeks);

    return selectedDate >= planEnd;
  }, [selectedDate, plan?.start_date, totalWeeks]);

  // Calcular quantas semanas faltam para o início do plano
  const weeksUntilPlanStart = useMemo(() => {
    if (!plan?.start_date || !isSelectedDateOutsidePlan) return 0;

    const planStart = startOfWeek(new Date(plan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
    const selectedWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

    // Se a data selecionada é antes do início do plano
    if (selectedDate < planStart) {
      return differenceInWeeks(planStart, selectedWeekStart);
    }

    return 0;
  }, [selectedDate, plan?.start_date, isSelectedDateOutsidePlan]);



  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    console.log("Data selecionada:", date.toLocaleDateString("pt-BR"));
  };

  const handleWeekChange = (newWeek: Date) => {
    setCurrentWeek(newWeek);

    // Manter o mesmo dia da semana (0 = domingo, 1 = segunda, etc.)
    const currentDayOfWeek = selectedDate.getDay();
    const newWeekStart = startOfWeek(newWeek, { weekStartsOn: 1 });

    // Ajustar para o mesmo dia da semana na nova semana
    const daysToAdd = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const newSelectedDate = addDays(newWeekStart, daysToAdd);
    setSelectedDate(newSelectedDate);
  };


  const handleCarouselWeekChange = (newWeekStart: Date) => {
    setCurrentWeek(newWeekStart);

    // Ajustar selectedDate para a mesma posição relativa na nova semana
    const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const dayOffset = Math.floor((selectedDate.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24));
    const newSelectedDate = addDays(newWeekStart, Math.max(0, Math.min(dayOffset, 6)));
    setSelectedDate(newSelectedDate);
  };

  const handleWeekSwipe = (direction: 'prev' | 'next') => {
    // Ativar fade out
    setIsTransitioning(true);

    // Após fade out, mudar a semana
    setTimeout(() => {
      const newWeek = direction === 'prev'
        ? subWeeks(currentWeek, 1)
        : addWeeks(currentWeek, 1);

      // Sempre selecionar segunda-feira na troca por swipe
      setCurrentWeek(newWeek);
      const newWeekStart = startOfWeek(newWeek, { weekStartsOn: 1 });
      setSelectedDate(newWeekStart);

      // Desativar fade após mudança
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 100);
  };

  const handleOpenManualTraining = (training: any) => {
    // Find the actual manual training from the list to ensure we have the correct id
    const actualTraining = manualTrainings?.find((t) => t.id === training.trainingId || t.id === training.id);
    if (actualTraining) {
      if (user?.id) {
        track("activity_opened_manual_training_card", user.id, {
          metadata: { trainingId: actualTraining.id, type: actualTraining.type },
        }).catch((error) => console.warn("Failed to track activity_opened_manual_training_card", error));
      }
      setSelectedManualTraining({
        id: actualTraining.id,
        date: actualTraining.date,
        type: actualTraining.type,
        title: trainingConfig[actualTraining.type as TrainingType]?.label || 'Corrida manual',
        distance: actualTraining.distance,
        elapsed_time: actualTraining.elapsed_time,
        pace: actualTraining.pace,
        actual_distance: actualTraining.actual_distance ?? actualTraining.distance,
        actual_elapsed_time: actualTraining.actual_elapsed_time ?? actualTraining.elapsed_time,
        actual_pace: actualTraining.actual_pace ?? actualTraining.pace,
        difficulty_level: actualTraining.difficulty_level,
        feedbacks: actualTraining.feedbacks,
      });
    } else {
      // Fallback: use the training object passed, but ensure it has 'id' field
      setSelectedManualTraining({
        ...training,
        id: training.trainingId || training.id,
      });
      if (user?.id) {
        track("activity_opened_manual_training_card", user.id, {
          metadata: { trainingId: training.trainingId || training.id, type: training.type },
        }).catch((error) => console.warn("Failed to track activity_opened_manual_training_card", error));
      }
    }
  };

  const handleOpenStravaActivity = (trainingCard: any) => {
    const activity = stravaActivities?.find(
      (a) => a.activity_id === trainingCard.strava_activity_id || `strava-${a.activity_id}` === trainingCard.id
    );
    if (activity) {
      setSelectedStravaActivity(activity);
    }

    const linkedTraining = (training || []).find(
      (t: any) =>
        t.strava_activity_id === activity?.activity_id ||
        t.id === trainingCard.trainingId
    );

    if (linkedTraining) {
      setSelectedStravaTraining(linkedTraining);
    } else {
      setSelectedStravaTraining(null);
    }

    if (user?.id) {
      const activityId = activity?.activity_id ?? trainingCard.strava_activity_id ?? null;
      if (activityId) {
        const metadata: Record<string, any> = { activity_id: activityId };
        if (linkedTraining?.id) {
          metadata.trainingId = linkedTraining.id;
        }
        track("activity_opened_strava_training_card", user.id, { metadata }).catch((error) =>
          console.warn("Failed to track activity_opened_strava_training_card", error)
        );
      }
    }
  };

  const handleDeleteManualTraining = (trainingId: string) => {
    deleteManualTraining.mutate(trainingId, {
      onSuccess: () => {
        setSelectedManualTraining(null);
      },
    });
  };

  const handleEditManualTraining = (trainingId: string) => {
    const training = manualTrainings?.find((t) => t.id === trainingId);
    if (training) {
      setManualEditTraining({
        ...training,
        actual_distance: training.actual_distance ?? training.distance,
        actual_elapsed_time: training.actual_elapsed_time ?? training.elapsed_time,
        actual_pace: training.actual_pace ?? training.pace ?? (training.distance && training.elapsed_time ? Math.round(training.elapsed_time / (training.distance / 1000)) : null),
      });
      setManualDialogMode('edit');
      setShowManualDialog(true);
      setSelectedManualTraining(null);
    }
  };

  // Swipe detection handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    // Não processar swipe se algum dialog estiver aberto
    if (isDialogOpen) return;

    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleWeekSwipe('next');
    }
    if (isRightSwipe) {
      handleWeekSwipe('prev');
    }
  };


  // ❌ REMOVIDO: useEffect unificado acima para evitar race condition

  // Scroll to top on mount and reset zoom
  useEffect(() => {
    window.scrollTo(0, 0);
    // Garantir que o zoom está resetado
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    }

    // Track app opened - apenas uma vez por sessão
    if (user?.id) {
      const hasTrackedAppOpen = sessionStorage.getItem('activity_opened_app_tracked');
      if (!hasTrackedAppOpen) {
        track('activity_opened_app', user.id);
        sessionStorage.setItem('activity_opened_app_tracked', 'true');
      }
    }
  }, [user?.id]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!isCheckingOnboarding && !isOnboardingCompleted) {
      navigate('/onboarding');
    }
  }, [isCheckingOnboarding, isOnboardingCompleted, navigate]);

  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background pb-16 relative select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {subscription?.trialExpired && !subscription?.subscribed && <SubscriptionBanner />}
      <AppHeader />
      <div className={`max-w-md mx-auto relative ${subscription?.trialExpired && !subscription?.subscribed ? 'pt-14' : ''}`}>
        {/* Banner de geração de treino */}
        {isGenerating && (
          <div className="px-4 pt-4">
            <TrainingGenerationBanner isGenerating={isGenerating} />
          </div>
        )}

        {!isGenerating && <RegenerateTrainingPlanButton />}
        {!isGenerating && <WeekSelector
          currentWeek={currentWeek}
          onWeekChange={handleWeekChange}
          currentWeekNumber={currentWeekNumber}
          totalWeeks={totalWeeks}
          trainingTypesByDate={trainingTypesByDate}
          planStartDate={plan?.start_date ? new Date(plan.start_date + 'T12:00:00') : undefined}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />}
        {!isGenerating && <CalendarStrip
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onWeekChange={handleCarouselWeekChange}
          trainingTypesByDate={trainingTypesByDate}
          currentWeek={currentWeek}
          planStartDate={plan?.start_date ? new Date(plan.start_date + 'T12:00:00') : undefined}
          totalWeeks={totalWeeks}
        />}

        {/* Subscription card overlay on top of blurred content - outside blur wrapper */}
        {shouldBlurContent && (
          <div className="absolute left-0 right-0 z-50 px-4 mt-4">
            <Card className="border-none shadow-lg shadow-black/40 rounded-[20px] p-5 bg-white relative z-50">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="inline-flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-full">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-brand font-semibold">Desbloqueie seu plano!</span>
                </div>
                <p className="text-sm text-muted-foreground font-brand-tertiary">
                  Escolha um plano para ver todas as semanas do seu treino personalizado
                </p>
                <Button
                  onClick={() => {
                    if (user?.id) {
                      track('activity_clicked_see_plans', user.id, {
                        metadata: { source: 'calendar_view' }
                      });
                    }
                    navigate('/subscription');
                  }}
                  className="w-full bg-primary text-black hover:bg-primary/90 font-semibold"
                >
                  Escolher Plano
                </Button>
              </div>
              {/* Shadow below */}
              <div className="absolute -bottom-2 left-0 right-0 h-4 bg-gradient-to-b from-black/5 to-transparent blur-sm rounded-b-[20px] pointer-events-none"></div>
            </Card>
          </div>
        )}

        {/* Content wrapper with blur for pre-trial users on weeks 3+ */}
        <div className={`relative ${shouldBlurContent ? 'blur-sm opacity-40 pointer-events-none' : ''}`}>
          {!isGenerating && isSelectedDateOutsidePlan && (
            <div className="px-4 pb-4">
              <Card className={`border-none shadow-sm bg-muted/50 rounded-[20px] p-6 transition-opacity duration-100 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                <div className="text-center">
                  {isAfterPlanEnd ? (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        🎉 Parabéns!
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Você completou seu plano de treino!
                      </p>
                      <p className="text-sm text-foreground/80">
                        Agora defina seus próximos objetivos e vamos pra frente! 🚀
                      </p>
                    </>
                  ) : weeksUntilPlanStart > 0 ? (
                    <>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        Seu plano começa em breve!
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Faltam {weeksUntilPlanStart} {weeksUntilPlanStart === 1 ? 'semana' : 'semanas'} para o início do seu plano de treino.
                      </p>
                      <p className="text-sm text-foreground/80">
                        Enquanto isso, mantenha-se ativo e se aqueça! 🏃‍♂️
                      </p>
                    </>
                  ) : null}
                </div>
              </Card>
            </div>
          )}
          {!isGenerating && !loadingTraining && combinedTrainingsForDay && combinedTrainingsForDay.length > 0 && (
            <div className={`px-4 space-y-4 transition-opacity duration-100 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              {combinedTrainingsForDay.map((t: any) => {
                const isManualTraining = t.source === 'manual';
                const trainingType = (t.type as 'long' | 'recovery' | 'interval' | 'easy') || 'easy';

                return (
                  <DailyTrainingCard
                    key={t.id}
                    trainingId={t.id}
                    date={t.date}
                    type={trainingType}
                    title={t.title || t.name || 'Treino'}
                    description={t.description || null}
                    elapsed_time={Number(t.elapsed_time) || 0}
                    distance={Number(t.distance)}
                    completed={!!t.completed}
                    actual_distance={t.actual_distance ? Number(t.actual_distance) : undefined}
                    actual_elapsed_time={t.actual_elapsed_time || undefined}
                    pace={t.pace ? Number(t.pace) : undefined}
                    actual_pace={t.actual_pace ? Number(t.actual_pace) : undefined}
                    difficulty_level={t.difficulty_level ? Number(t.difficulty_level) : null}
                    feedbacks={t.feedbacks || null}
                    currentWeekNumber={currentWeekNumber}
                    showDate={false}
                    onDialogStateChange={handleDialogStateChange}
                    strava_activity_id={t.strava_activity_id || null}
                    source={t.source || (isManualTraining ? 'manual' : 'plan')}
                    onOpenManual={handleOpenManualTraining}
                    onOpenStrava={handleOpenStravaActivity}
                  />
                );
              })}
            </div>
          )}
          {!isGenerating && !loadingTraining && combinedTrainingsForDay && combinedTrainingsForDay.length > 0 && (
            <div className={`px-4 pt-1 pb-5 transition-opacity duration-100 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              <Separator className="bg-border/70" />
            </div>
          )}
          {!isGenerating && (
            <div className={`transition-opacity duration-100 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              <WeeklyRunningCards
                currentWeekNumber={currentWeekNumber}
                completedRuns={weeklyStats.completedRuns}
                totalRuns={weeklyStats.totalRuns}
                completedDistance={weeklyStats.completedDistance}
                totalDistance={weeklyStats.totalDistance}
              />
              <FatigueCard
                selectedDate={selectedDate}
              />
            </div>
          )}
        </div>

        <BottomNav activeTab="food" onTabChange={() => { }} />
      </div>

      {/* AddTrainingFAB with blur for pre-trial users on weeks 3+ */}
      <div className={shouldBlurContent ? 'blur-sm opacity-60 pointer-events-none' : ''}>
        <AddTrainingFAB onClick={handleFabClick} />
      </div>
      <CreateManualTrainingDialog
        open={showManualDialog}
        onOpenChange={handleManualDialogChange}
        date={selectedDate}
        mode={manualDialogMode}
        initialTraining={manualEditTraining}
      />

      {selectedManualTraining && (
        <ManualTrainingDialog
          open={!!selectedManualTraining}
          onOpenChange={(open) => {
            if (!open) setSelectedManualTraining(null);
          }}
          training={selectedManualTraining}
          onDelete={handleDeleteManualTraining}
          onEdit={handleEditManualTraining}
        />
      )}

      {selectedStravaActivity && (
        <StravaActivityDialog
          open={!!selectedStravaActivity}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedStravaActivity(null);
              setSelectedStravaTraining(null);
            }
          }}
          activity={selectedStravaActivity}
          training={selectedStravaTraining}
        />
      )}

      {shouldShowWelcome && (
        <WelcomeScreen
          open={shouldShowWelcome}
          onOpenChange={() => { }}
          onMarkSeen={markAsSeen}
          isMarking={isMarking}
        />
      )}

      {/* Overlay blur quando não há assinatura ativa */}
      {subscription?.trialExpired && !subscription?.subscribed && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-30 pointer-events-auto"
          style={{ top: '56px', bottom: '80px' }} // Deixar espaço para o SubscriptionBanner e BottomNav
        />
      )}
    </div>
  );
};

export default Index;
