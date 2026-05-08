import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { PlanGoalCard } from "@/components/PlanGoalCard";
import { WeekCard } from "@/components/WeekCard";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { TrainingGenerationBanner } from "@/components/TrainingGenerationBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrainingPlan } from "@/hooks/useTrainingPlan";
import { useWeeklyTrainings } from "@/hooks/useWeeklyTrainings";
import { useSubscriptionContext } from "@/contexts/SubscriptionContext";
import { useTrainingGenerationStatus } from "@/hooks/useTrainingGenerationStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { TrainingWeek, WeeklyTraining } from "@/types/training";
import { startOfWeek, endOfWeek, parseISO, differenceInWeeks } from "date-fns";
import { Lock } from "lucide-react";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

const Plan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trainingPlan, isLoading: isPlanLoading } = useTrainingPlan();
  const { data: allTrainings, isLoading: isTrainingsLoading } = useWeeklyTrainings();
  const { subscription } = useSubscriptionContext();
  const { isGenerating } = useTrainingGenerationStatus();

  const weeklyData = useMemo(() => {
    if (!allTrainings || !trainingPlan) return [];

    const grouped = new Map<number, TrainingWeek>();

    allTrainings.forEach((training) => {
      const weekNum = training.week_number;

      if (!grouped.has(weekNum)) {
        // Para calcular as datas da semana, usa a data do primeiro treino
        const trainingDate = new Date(training.date + 'T12:00:00');
        const weekStart = startOfWeek(trainingDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(trainingDate, { weekStartsOn: 1 });

        grouped.set(weekNum, {
          weekNumber: weekNum,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
          trainings: [],
          totalTrainings: 0,
          totalDistance: 0,
          completedTrainings: 0,
          completedDistance: 0,
          totalDuration: 0,
          completedDuration: 0,
        });
      }

      const week = grouped.get(weekNum)!;

      // Converte o treino para o formato WeeklyTraining
      const elapsedTimeSeconds = (training as any).elapsed_time ?? 0;
      const formattedTraining: WeeklyTraining = {
        id: training.id,
        day: training.day_of_week,
        date: training.date,
        type: training.type as any,
        name: training.name,
        title: training.title,
        description: training.description || '',
        distance: Number(training.distance),
        duration: elapsedTimeSeconds / 60, // Converter segundos para minutos
        completed: training.completed || false,
        actual_distance: training.actual_distance ? Number(training.actual_distance) : undefined,
        actual_time: (training as any).actual_elapsed_time ? String((training as any).actual_elapsed_time) : undefined,
      };

      week.trainings.push(formattedTraining);
      week.totalTrainings++;
      week.totalDistance += Number(training.distance);
      const elapsedTime = (training as any).elapsed_time ?? 0;
      week.totalDuration += Number(elapsedTime);
      if (training.completed) {
        week.completedTrainings++;
        week.completedDistance += training.actual_distance ? Number(training.actual_distance) : Number(training.distance);
        // Para tempo realizado, usar actual_elapsed_time se disponível (já está em segundos), senão usar elapsed_time
        const actualElapsedTime = (training as any).actual_elapsed_time;
        if (actualElapsedTime !== null && actualElapsedTime !== undefined) {
          // actual_elapsed_time já está em segundos
          week.completedDuration += Number(actualElapsedTime);
        } else {
          // Fallback para elapsed_time (também em segundos)
          week.completedDuration += Number(elapsedTime);
        }
      }
    });

    // Ordena as semanas
    return Array.from(grouped.values()).sort((a, b) => a.weekNumber - b.weekNumber);
  }, [allTrainings, trainingPlan]);

  // Calcular semana atual baseada na data (não em conclusão)
  const currentWeekNumber = useMemo(() => {
    if (!trainingPlan?.start_date) return 1;
    const planStart = startOfWeek(new Date(trainingPlan.start_date + 'T12:00:00'), { weekStartsOn: 1 });
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekNumber = differenceInWeeks(currentWeekStart, planStart) + 1;
    // Limitar ao número total de semanas do plano
    return Math.min(Math.max(1, weekNumber), trainingPlan.total_weeks || 1);
  }, [trainingPlan?.start_date, trainingPlan?.total_weeks]);

  const planStats = useMemo(() => {
    if (!allTrainings) {
      return {
        totalTrainings: 0,
        completedTrainings: 0,
        totalDistance: 0,
        completedDistance: 0,
        totalDuration: 0,
        completedDuration: 0,
      };
    }

    // Calcular duração total e completada
    let totalDuration = 0;
    let completedDuration = 0;

    allTrainings.forEach(training => {
      const elapsedTime = (training as any).elapsed_time ?? 0;
      // elapsed_time está em segundos
      totalDuration += Number(elapsedTime);

      if (training.completed) {
        const actualElapsedTime = (training as any).actual_elapsed_time;
        if (actualElapsedTime !== null && actualElapsedTime !== undefined) {
          // actual_elapsed_time já está em segundos
          completedDuration += Number(actualElapsedTime);
        } else {
          // Fallback para elapsed_time (também em segundos)
          completedDuration += Number(elapsedTime);
        }
      }
    });

    return {
      totalTrainings: allTrainings.length,
      completedTrainings: allTrainings.filter(t => t.completed).length,
      totalDistance: allTrainings.reduce((sum, t) => sum + Number(t.distance), 0),
      completedDistance: allTrainings
        .filter(t => t.completed)
        .reduce((sum, t) => sum + Number(t.actual_distance || t.distance), 0),
      totalDuration,
      completedDuration,
    };
  }, [allTrainings]);

  const isLoading = isPlanLoading || isTrainingsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="max-w-md mx-auto px-4 py-6">
          <Skeleton className="w-full h-64 mb-6 rounded-[20px]" />
          <Skeleton className="w-full h-48 mb-4 rounded-[20px]" />
          <Skeleton className="w-full h-48 mb-4 rounded-[20px]" />
        </div>
        <BottomNav activeTab="week" />
      </div>
    );
  }

  if (!trainingPlan) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="max-w-md mx-auto px-4 py-6">
          <p className="text-center text-muted-foreground">
            Nenhum plano de treino encontrado
          </p>
        </div>
        <BottomNav activeTab="week" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav relative">
      {subscription?.trialExpired && !subscription?.subscribed && <SubscriptionBanner />}
      <AppHeader />

      <div className={`max-w-md mx-auto px-4 py-6 ${subscription?.trialExpired && !subscription?.subscribed ? 'pt-14' : ''}`}>
        {/* Banner de geração de treino */}
        {isGenerating && (
          <TrainingGenerationBanner isGenerating={isGenerating} />
        )}

        {/* Card do Objetivo */}
        {!isGenerating && (
          <PlanGoalCard
            goalType={trainingPlan.goal_type as any}
            goalDistance={Number(trainingPlan.goal_distance)}
            raceDate={trainingPlan.race_date}
            totalWeeks={trainingPlan.total_weeks}
            completedWeeks={currentWeekNumber}
            totalDistance={planStats.totalDistance}
            completedDistance={planStats.completedDistance}
            totalDuration={planStats.totalDuration}
            completedDuration={planStats.completedDuration}
            totalTrainings={planStats.totalTrainings}
            completedTrainings={planStats.completedTrainings}
          />
        )}

        {/* Espaço entre cards */}
        {!isGenerating && (
          <div className="my-6" />
        )}

        {/* Cards Semanais */}
        {!isGenerating && (() => {
          const isPreTrial = subscription?.status === 'pre-trial';
          const hasBlurredWeeks = isPreTrial && weeklyData.some(w => w.weekNumber > 2);
          const firstBlurredWeekIndex = weeklyData.findIndex(w => w.weekNumber > 2);

          return (
            <div className="relative">
              {/* Render all weeks */}
              {weeklyData.map((week, index) => {
                const shouldDisable = isPreTrial && week.weekNumber > 2;
                const shouldBlur = isPreTrial && week.weekNumber > 2;
                const isFirstBlurredWeek = isPreTrial && index === firstBlurredWeekIndex;

                return (
                  <div key={week.weekNumber} className="relative">
                    <WeekCard
                      week={week}
                      isDisabled={shouldDisable}
                      shouldBlur={shouldBlur}
                    />
                    {/* Banner overlay on top of first blurred week */}
                    {isFirstBlurredWeek && (
                      <div className="absolute -top-4 left-0 right-0 z-30 mt-16">
                        <Card className="border-none shadow-lg shadow-black/40 rounded-[20px] p-5 bg-white mx-4">
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
                                    metadata: { source: 'plan_view' }
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
                  </div>
                );
              })}
            </div>
          );
        })()}

        {!isGenerating && weeklyData.length === 0 && (
          <p className="text-center text-muted-foreground">
            Nenhum treino encontrado no plano
          </p>
        )}
      </div>

      <BottomNav activeTab="week" />

      {/* Overlay blur quando não há assinatura ativa */}
      {subscription?.trialExpired && !subscription?.subscribed && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-30 pointer-events-auto"
          style={{ top: '56px', bottom: '80px' }} // Deixar espaço para o SubscriptionBanner e BottomNav
        />
      )}
    </div>
  );
};

export default Plan;
