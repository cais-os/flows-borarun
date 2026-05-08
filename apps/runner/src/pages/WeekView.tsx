import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { DailyTrainingCard } from "@/components/DailyTrainingCard";
import { BottomNav } from "@/components/BottomNav";
import { useWeeklyTrainings } from "@/hooks/useWeeklyTrainings";
import { useTrainingPlan } from "@/hooks/useTrainingPlan";
import { metersToKm, secondsToTimeString } from "@/lib/utils";

const WeekView = () => {
  const { weekNumber } = useParams<{ weekNumber: string }>();
  const navigate = useNavigate();
  const [currentWeekNumber, setCurrentWeekNumber] = useState(
    weekNumber ? parseInt(weekNumber) : 1
  );
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFading, setIsFading] = useState(false);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Dialog state - rastrear se algum dialog está aberto
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogOpenCountRef = useRef(0);

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

  const { trainingPlan: plan } = useTrainingPlan();

  // Calcular a data da semana atual baseada no número da semana
  const currentWeekDate = useMemo(() => {
    if (!plan?.start_date) return startOfWeek(new Date(), { weekStartsOn: 1 });
    const planStart = new Date(plan.start_date + 'T12:00:00');
    return addWeeks(planStart, currentWeekNumber - 1);
  }, [plan?.start_date, currentWeekNumber]);

  // Calcular início e fim da semana baseado no número da semana
  const weekStart = useMemo(() => {
    return startOfWeek(currentWeekDate, { weekStartsOn: 1 });
  }, [currentWeekDate]);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const { data: trainings, isLoading } = useWeeklyTrainings(weekStart, weekEnd);

  const currentWeekData = useMemo(() => {
    if (!trainings || trainings.length === 0) return null;

    const totalTrainings = trainings.length;
    const completedTrainings = trainings.filter(t => t.completed).length;
    const totalDistance = trainings.reduce((sum, t) => sum + Number(t.distance ?? 0), 0);
    const completedDistance = trainings
      .filter(t => t.completed)
      .reduce((sum, t) => sum + Number(t.actual_distance ?? t.distance ?? 0), 0);

    // Calcular duração total e completada (segundos)
    let totalDuration = 0;
    let completedDuration = 0;

    trainings.forEach(training => {
      const plannedSeconds = training.elapsed_time ?? training.duration ?? 0;
      totalDuration += Number(plannedSeconds);
      if (training.completed) {
        const actualSeconds =
          training.actual_elapsed_time !== null && training.actual_elapsed_time !== undefined
            ? Number(training.actual_elapsed_time)
            : Number(plannedSeconds);
        completedDuration += actualSeconds;
      }
    });

    return {
      weekNumber: currentWeekNumber,
      startDate: trainings[0]?.date || '',
      endDate: trainings[trainings.length - 1]?.date || '',
      trainings: trainings.map(t => ({
        id: t.id,
        day: new Date(t.date).toLocaleDateString('pt-BR', { weekday: 'short' }),
        date: t.date,
        type: t.type as 'long' | 'recovery' | 'interval' | 'easy',
        name: t.name,
        title: t.title,
        description: t.description,
        distance: Number(t.distance ?? 0),
        elapsed_time: Number((t as any).elapsed_time ?? t.duration ?? 0),
        completed: t.completed,
        actual_distance: t.actual_distance !== null && t.actual_distance !== undefined ? Number(t.actual_distance) : null,
        actual_elapsed_time:
          (t as any).actual_elapsed_time !== null && (t as any).actual_elapsed_time !== undefined
            ? Number((t as any).actual_elapsed_time)
            : null,
        pace: t.pace !== null && t.pace !== undefined ? Number(t.pace) : null,
        actual_pace: t.actual_pace !== null && t.actual_pace !== undefined ? Number(t.actual_pace) : null,
        difficulty_level: t.difficulty_level ? Number(t.difficulty_level) : null,
        feedbacks: t.feedbacks || null,
      })),
      totalTrainings,
      completedTrainings,
      totalDistance,
      completedDistance,
      totalDuration,
      completedDuration,
    };
  }, [trainings, currentWeekNumber]);

  useEffect(() => {
    if (weekNumber) {
      setCurrentWeekNumber(parseInt(weekNumber));
    }
  }, [weekNumber]);

  // Limpa o estado de fade e timeouts quando sai da página
  useEffect(() => {
    return () => {
      setIsFading(false);
      // Limpa todos os timeouts pendentes
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  // Handle swipe navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEnd = () => {
    // Não processar swipe se algum dialog estiver aberto
    if (isDialogOpen) return;

    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;

    // Only trigger swipe if horizontal movement is greater than vertical movement
    if (Math.abs(distanceX) < Math.abs(distanceY)) return;

    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    if (isLeftSwipe) {
      if (plan && currentWeekNumber < plan.total_weeks) {
        // Swipe left - go to next week
        const nextWeek = currentWeekNumber + 1;
        // Limpa timeouts anteriores
        timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        timeoutRefs.current = [];

        // Inicia o fade out
        setIsFading(true);
        // Na metade do fade (100ms), navega para a nova semana
        const timeout1 = setTimeout(() => {
          navigate(`/week/${nextWeek}`, { replace: true });
          // Depois do fade completo (200ms), faz fade in
          const timeout2 = setTimeout(() => {
            setIsFading(false);
          }, 100);
          timeoutRefs.current.push(timeout2);
        }, 100);
        timeoutRefs.current.push(timeout1);
      }
      // Swipe left na última semana - bloqueado (não faz nada)
    }

    if (isRightSwipe) {
      if (currentWeekNumber > 1) {
        // Swipe right - go to previous week
        const prevWeek = currentWeekNumber - 1;
        // Limpa timeouts anteriores
        timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        timeoutRefs.current = [];

        // Inicia o fade out
        setIsFading(true);
        // Na metade do fade (100ms), navega para a nova semana
        const timeout1 = setTimeout(() => {
          navigate(`/week/${prevWeek}`, { replace: true });
          // Depois do fade completo (200ms), faz fade in
          const timeout2 = setTimeout(() => {
            setIsFading(false);
          }, 100);
          timeoutRefs.current.push(timeout2);
        }, 100);
        timeoutRefs.current.push(timeout1);
      }
      // Swipe right na primeira semana - bloqueado (não faz nada)
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando semana...</p>
        </div>
      </div>
    );
  }

  if (!currentWeekData || !currentWeekData.trainings.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground">Nenhum treino encontrado para esta semana</p>
      </div>
    );
  }

  const startDate = new Date(currentWeekData.startDate);
  const endDate = new Date(currentWeekData.endDate);
  const formattedPeriod = `${format(startDate, "d MMM", { locale: ptBR }).toUpperCase()} - ${format(endDate, "d MMM", { locale: ptBR }).toUpperCase()}`;

  return (
    <div
      className="min-h-screen bg-background pb-32"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <AppHeader
        title="Plano de Treino"
        showBackButton={true}
        onBack={() => navigate('/plan', { replace: true })}
      />

      <div
        ref={containerRef}
        className={`max-w-md mx-auto pt-6 px-4 transition-opacity duration-300 ${isFading ? 'opacity-0' : 'opacity-100'
          }`}
      >
        {/* Título da semana */}
        <div className="flex items-center gap-2 mb-3 px-2">
          <h2 className="text-2xl font-bold">Semana {currentWeekData.weekNumber}</h2>
          <div className="h-4 w-px bg-muted-foreground/30"></div>
          <p className="text-xs text-muted-foreground/70 font-medium">
            {formattedPeriod}
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="flex gap-2 mb-3 px-2">
          {Array.from({ length: currentWeekData.totalTrainings }).map((_, index) => (
            <div
              key={index}
              className={`flex-1 h-2 rounded-full ${index < currentWeekData.completedTrainings ? 'bg-primary' : 'bg-muted'
                }`}
            />
          ))}
        </div>

        {/* Métricas */}
        <div className="flex flex-col gap-2 mb-6 text-sm px-2">
          <p className="text-muted-foreground flex items-center whitespace-nowrap">
            <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="font-black text-foreground mr-1 font-brand-tertiary">
              {metersToKm(currentWeekData.completedDistance).toFixed(2).replace('.', ',')} km
            </span>
            /
            <span className="text-muted-foreground ml-1 mr-1 font-brand-tertiary">
              {metersToKm(currentWeekData.totalDistance).toFixed(2).replace('.', ',')}  km
            </span>
          </p>
          <p className="text-muted-foreground flex items-center whitespace-nowrap">
            <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
            <span className="font-black text-foreground mr-1 font-brand-tertiary">
              {secondsToTimeString(currentWeekData.completedDuration)}
            </span>
            /
            <span className="text-muted-foreground ml-1 mr-1 font-brand-tertiary">
              {secondsToTimeString(currentWeekData.totalDuration)}
            </span>
          </p>
        </div>

        {/* Lista de treinos da semana */}
        <div className="space-y-4 pb-4">
          {currentWeekData.trainings.map((training, index) => (
            <DailyTrainingCard
              key={index}
              trainingId={training.id}
              date={training.date}
              type={training.type}
              title={training.title}
              description={training.description}
              elapsed_time={training.elapsed_time}
              distance={training.distance}
              completed={training.completed}
              actual_distance={training.actual_distance}
              actual_elapsed_time={training.actual_elapsed_time ?? undefined}
              pace={training.pace ?? undefined}
              actual_pace={training.actual_pace ?? undefined}
              difficulty_level={training.difficulty_level ? Number(training.difficulty_level) : null}
              feedbacks={training.feedbacks || null}
              onDialogStateChange={handleDialogStateChange}
              currentWeekNumber={currentWeekNumber}
              showDate={true}
            />
          ))}
        </div>
      </div>


      <BottomNav activeTab="week" />
    </div>
  );
};

export default WeekView;
