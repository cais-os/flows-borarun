import { useEffect, useState, useRef } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarTrainingType, TrainingType, trainingTypeColors } from "@/types/training";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

interface CalendarStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onWeekChange?: (weekStart: Date) => void;
  trainingTypesByDate?: Record<string, CalendarTrainingType>;
  currentWeek?: Date;
  planStartDate?: Date;
  totalWeeks?: number;
}

interface DayData {
  label: string;
  day: number;
  date: Date;
}

interface WeekData {
  weekStart: Date;
  days: DayData[];
}

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const CalendarStrip = ({
  selectedDate,
  onDateSelect,
  onWeekChange,
  trainingTypesByDate,
  currentWeek,
  planStartDate,
  totalWeeks
}: CalendarStripProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const lastSelectedIndexRef = useRef<number | null>(null);
  const { user } = useAuth();

  // Gerar array de semanas completas (4 semanas atrás até 8 semanas à frente)
  const generateWeeks = (): { weeks: WeekData[], currentWeekIndex: number } => {
    // Se temos planStartDate, usar como referência; caso contrário, usar hoje
    const referenceDate = planStartDate || new Date();
    const currentWeekStart = startOfWeek(currentWeek || referenceDate, { weekStartsOn: 1 });
    const weeks: WeekData[] = [];
    let currentWeekIndex = 0;

    // Gerar 13 semanas no total (4 atrás + semana atual + 8 à frente)
    for (let i = -4; i <= 8; i++) {
      const weekStart = addWeeks(currentWeekStart, i);

      if (i === 0) {
        currentWeekIndex = weeks.length;
      }

      const days: DayData[] = [];
      // Gerar os 7 dias da semana (segunda a domingo)
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);

        days.push({
          label: dayLabels[dayOffset],
          day: date.getDate(),
          date: date,
        });
      }

      weeks.push({
        weekStart,
        days,
      });
    }

    return { weeks, currentWeekIndex };
  };

  const { weeks, currentWeekIndex } = generateWeeks();

  // Posicionar na semana atual ao montar
  useEffect(() => {
    if (api) {
      lastSelectedIndexRef.current = api.selectedScrollSnap();
      setTimeout(() => {
        api.scrollTo(currentWeekIndex, false);
      }, 100);
    }
  }, [api, currentWeekIndex]);

  // Sincronizar com mudanças externas (WeekSelector)
  useEffect(() => {
    if (api && currentWeek) {
      const targetWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekIndex = weeks.findIndex(week =>
        week.weekStart.getTime() === targetWeekStart.getTime()
      );

      if (weekIndex !== -1 && weekIndex !== api.selectedScrollSnap()) {
        api.scrollTo(weekIndex, true);
      }
    }
  }, [api, currentWeek, weeks]);

  // Detectar mudança de slide e notificar
  useEffect(() => {
    if (!api || !onWeekChange) return;

    const handleSelect = () => {
      const selectedIndex = api.selectedScrollSnap();
      // Only trigger if the index actually changed
      if (lastSelectedIndexRef.current === null || selectedIndex !== lastSelectedIndexRef.current) {
        lastSelectedIndexRef.current = selectedIndex;
        const selectedWeek = weeks[selectedIndex];
        if (selectedWeek) {
          onWeekChange(selectedWeek.weekStart);
        }
      }
    };

    api.on('select', handleSelect);
    return () => {
      api.off('select', handleSelect);
    };
  }, [api, onWeekChange, weeks]);

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const handleDateSelect = (date: Date) => {
    // Only track if the date actually changed
    if (!isSameDay(date, selectedDate) && user?.id) {
      track('activity_calendar_date_changed', user.id, {
        metadata: {
          date: format(date, 'dd-MM-yyyy'),
          weekday: format(date, 'EEE', { locale: ptBR }).toUpperCase().substring(0, 3),
        },
      });
    }
    onDateSelect(date);
  };

  // Verificar se uma data é hoje
  const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
  };

  // Verificar se uma data está fora do plano de treino
  const isOutsidePlan = (date: Date): boolean => {
    if (!planStartDate || !totalWeeks) return false;

    const planStart = startOfWeek(planStartDate, { weekStartsOn: 1 });
    const planEnd = addWeeks(planStart, totalWeeks);

    return date < planStart || date >= planEnd;
  };

  const getTrainingColor = (date: Date): string | null => {
    if (!trainingTypesByDate) {
      console.log('⚠️ trainingTypesByDate não fornecido');
      return null;
    }
    const dateKey = format(date, 'yyyy-MM-dd');
    const trainingType = trainingTypesByDate[dateKey];
    const color =
      trainingType === 'strava'
        ? '#e2e8f0'
        : trainingType
          ? trainingTypeColors[trainingType]
          : null;

    return color;
  };

  return (
    <div className="px-4 pb-4">
      <Carousel
        setApi={setApi}
        opts={{
          align: "center",
          loop: false,
          containScroll: "trimSnaps",
          watchDrag: false,
        }}
        className="w-full"
      >
        <CarouselContent className="pb-2 px-1">
          {weeks.map((week, weekIndex) => (
            <CarouselItem key={weekIndex} className="basis-full">
              <div className="grid grid-cols-7 gap-1">
                {week.days.map((dayData, dayIndex) => {
                  const isSelected = isSameDay(dayData.date, selectedDate);
                  const isTodayDate = isToday(dayData.date);
                  const trainingColor = getTrainingColor(dayData.date);
                  const outsidePlan = isOutsidePlan(dayData.date);
                  return (
                    <button
                      key={dayIndex}
                      onClick={() => handleDateSelect(dayData.date)}
                      className={`flex flex-col items-center gap-1.5 p-1 transition-all cursor-pointer ${isSelected ? "scale-110" : ""
                        }`}
                    >
                      <span className={`text-xs font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"
                        }`}>
                        {dayData.label}
                      </span>
                      <div
                        className={`rounded-full flex items-center justify-center text-sm font-semibold transition-all ${isTodayDate
                          ? isSelected
                            ? "w-10 h-10 bg-primary text-primary-foreground shadow-lg ring-2 ring-foreground ring-offset-2"
                            : "w-10 h-10 bg-primary text-primary-foreground"
                          : isSelected
                            ? "w-10 h-10 bg-card shadow-lg border-2 border-foreground text-foreground"
                            : outsidePlan
                              ? "w-10 h-10 border-2 border-dashed border-muted/40 text-muted-foreground/50 bg-muted/10 opacity-50"
                              : "w-10 h-10 border-2 border-black/20 bg-white text-foreground"
                          }`}
                      >
                        {dayData.day}
                      </div>
                      {trainingColor && (
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-0.5"
                          style={{ backgroundColor: trainingColor }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};
