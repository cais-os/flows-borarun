import { useState, useEffect, useRef } from "react";
import { ChevronDown, Clock, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, addDays, differenceInWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RingProgress } from "@/components/RingProgress";
import { CalendarTrainingType, TrainingType, trainingTypeColors } from "@/types/training";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

interface WeekSelectorProps {
  currentWeek: Date;
  onWeekChange: (newWeek: Date) => void;
  currentWeekNumber: number;
  totalWeeks?: number;
  trainingTypesByDate?: Record<string, CalendarTrainingType>;
  planStartDate?: Date;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export const WeekSelector = ({
  currentWeek,
  onWeekChange,
  currentWeekNumber,
  totalWeeks,
  trainingTypesByDate,
  planStartDate,
  selectedDate,
  onDateSelect,
}: WeekSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(currentWeek));
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { user } = useAuth();
  const prevOpenRef = useRef<boolean | null>(null);
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const progressPercentage = totalWeeks ? Math.round((currentWeekNumber / totalWeeks) * 100) : 0;

  // Calcular status da semana
  const getWeekStatus = () => {
    if (!totalWeeks) {
      return {
        type: 'active' as const,
        text: `Semana ${currentWeekNumber}`,
        icon: null,
        color: 'text-foreground'
      };
    }

    if (currentWeekNumber < 1) {
      const weeksUntilStart = 1 - currentWeekNumber;
      return {
        type: 'before' as const,
        text: `${weeksUntilStart} ${weeksUntilStart === 1 ? 'semana faltando' : 'semanas faltando'}`,
        icon: Lock,
        color: 'text-muted-foreground'
      };
    } else if (currentWeekNumber > totalWeeks) {
      const weeksAfterEnd = currentWeekNumber - totalWeeks;
      return {
        type: 'after' as const,
        text: `${weeksAfterEnd} ${weeksAfterEnd === 1 ? 'semana atrás' : 'semanas atrás'}`,
        icon: Clock,
        color: 'text-muted-foreground'
      };
    } else {
      return {
        type: 'active' as const,
        text: `Semana ${currentWeekNumber}/${totalWeeks}`,
        icon: null,
        color: 'text-foreground'
      };
    }
  };

  const weekStatus = getWeekStatus();
  const StatusIcon = weekStatus.icon;

  const handlePrevWeek = () => {
    onWeekChange(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    onWeekChange(addWeeks(currentWeek, 1));
  };

  const handleDayClick = (date: Date) => {
    // Ao clicar em um dia, selecionar a semana correspondente
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    onWeekChange(weekStart);

    // Selecionar o dia específico no Date Picker
    if (onDateSelect) {
      onDateSelect(date);
    }

    // Track date selection
    if (user?.id) {
      track('activity_week_selector_date_selected', user.id, {
        metadata: {
          date: format(date, 'dd-MM-yyyy'),
          weekday: format(date, 'EEE', { locale: ptBR }).toUpperCase().substring(0, 3),
        },
      });
    }

    setOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setIsAnimating(true);
      setTimeout(() => {
        handleNextMonth();
        setIsAnimating(false);
      }, 200);
    }
    if (isRightSwipe) {
      setIsAnimating(true);
      setTimeout(() => {
        handlePrevMonth();
        setIsAnimating(false);
      }, 200);
    }
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
  };

  const isOutsidePlan = (date: Date): boolean => {
    if (!planStartDate || !totalWeeks) return false;
    const planStart = startOfWeek(planStartDate, { weekStartsOn: 1 });
    const planEnd = addWeeks(planStart, totalWeeks);
    return date < planStart || date >= planEnd;
  };

  const getTrainingColor = (date: Date): string | null => {
    if (!trainingTypesByDate) return null;
    const dateKey = format(date, 'yyyy-MM-dd');
    const trainingType = trainingTypesByDate[dateKey];
    if (!trainingType) return null;
    if (trainingType === 'strava') return '#e2e8f0';
    return trainingTypeColors[trainingType];
  };

  const getWeekNumber = (date: Date): number | null => {
    if (!planStartDate || !totalWeeks) return null;
    const planStart = startOfWeek(planStartDate, { weekStartsOn: 1 });
    const dateWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekNumber = differenceInWeeks(dateWeekStart, planStart) + 1;

    // Retornar null se estiver fora do plano
    if (weekNumber < 1 || weekNumber > totalWeeks) return null;
    return weekNumber;
  };

  // Gerar os dias do calendário
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // Sincronizar o mês do calendário com a semana atual quando o dialog abre ou quando a semana muda
  useEffect(() => {
    if (open) {
      setCurrentMonth(startOfMonth(currentWeek));
    }
  }, [open, currentWeek]);

  // Track dialog open/close - apenas quando houver transição real
  useEffect(() => {
    // Ignorar na primeira renderização (quando prevOpenRef.current é null)
    if (prevOpenRef.current === null) {
      prevOpenRef.current = open;
      return;
    }

    // Só rastrear se houver mudança real de estado
    if (user?.id && prevOpenRef.current !== open) {
      if (open) {
        // Dialog acabou de abrir (transição de false para true)
        track('activity_week_selector_opened', user.id);
      } else {
        // Dialog acabou de fechar (transição de true para false)
        track('activity_week_selector_closed', user.id);
      }
      prevOpenRef.current = open;
    }
  }, [open, user?.id]);

  return (
    <div className="px-4 pb-2 mt-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity">
            {weekStatus.type === 'active' ? (
              <RingProgress
                percentage={progressPercentage}
                size={24}
                strokeWidth={3}
                showIcon={false}
              />
            ) : StatusIcon && (
              <StatusIcon className="w-5 h-5 text-muted-foreground" />
            )}
            <span className={`text-sm font-semibold ${weekStatus.color}`}>
              {weekStatus.text}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </DialogTrigger>

        <DialogContent className="max-w-sm rounded-lg">
          <div className="space-y-4 pt-2">
            {/* Controles de navegação do mês */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </Button>
              <span className="text-base font-semibold text-foreground">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </Button>
            </div>

            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-8 gap-1">
              <div className="text-center text-[10px] font-medium text-muted-foreground py-1 border-r border-border">Sem</div>
              {dayLabels.map((label) => (
                <div key={label} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {label}
                </div>
              ))}
            </div>

            {/* Calendário */}
            <div
              className={`space-y-1 transition-opacity duration-200 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIndex) => {
                const weekDays = calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7);
                const weekNumber = getWeekNumber(weekDays[0]);

                return (
                  <div key={weekIndex} className="grid grid-cols-8 gap-1">
                    {/* Número da semana */}
                    <div className="flex items-center justify-center border-r border-border px-1">
                      {weekNumber ? (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {weekNumber}{totalWeeks ? `/${totalWeeks}` : ''}
                        </span>
                      ) : null}
                    </div>

                    {/* Dias da semana */}
                    {weekDays.map((day, dayIndex) => {
                      const isDayInMonth = isSameMonth(day, currentMonth);
                      const isTodayDate = isToday(day);
                      const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                      const trainingColor = getTrainingColor(day);
                      const outsidePlan = isOutsidePlan(day);

                      return (
                        <button
                          key={dayIndex}
                          onClick={() => handleDayClick(day)}
                          className="flex flex-col items-center gap-1 p-1 transition-all cursor-pointer rounded-md"
                        >
                          <div
                            className={`rounded-full flex items-center justify-center text-sm font-semibold transition-all ${isTodayDate
                              ? "w-8 h-8 bg-primary text-primary-foreground"
                              : isSelected
                                ? "w-8 h-8 bg-card shadow-lg border-2 border-foreground text-foreground"
                                : outsidePlan
                                  ? "w-8 h-8 border-2 border-dashed border-muted/40 text-muted-foreground/50 bg-muted/10 opacity-50"
                                  : "w-8 h-8 border-2 border-black/20 bg-white text-foreground"
                              } ${!isDayInMonth ? "opacity-30" : ""}`}
                          >
                            {day.getDate()}
                          </div>
                          {trainingColor && (
                            <div
                              className="w-1 h-1 rounded-full"
                              style={{ backgroundColor: trainingColor }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
