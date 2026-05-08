import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useFatigueLog } from "@/hooks/useFatigueLog";
import { Check } from "lucide-react";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  MdSentimentVerySatisfied,
  MdSentimentSatisfied,
  MdSentimentNeutral,
  MdSentimentDissatisfied,
  MdSentimentVeryDissatisfied
} from "react-icons/md";

interface FatigueCardProps {
  selectedDate: Date;
}

export const FatigueCard = ({ selectedDate }: FatigueCardProps) => {
  const { fatigueLog, isLoading, upsertFatigueLog, deleteFatigueLog, isUpserting, isDeleting } = useFatigueLog(selectedDate);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [feedbackSaved, setFeedbackSaved] = useState<boolean>(false);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const previousFeedbackRef = useRef<string>("");

  const fatigueConfig = [
    { level: 1, color: "#7acc16", label: "Muito bem", Icon: MdSentimentVerySatisfied }, // Strong lime green
    { level: 2, color: "#d1d016", label: "Bem", Icon: MdSentimentSatisfied }, // Middle between green and amber
    { level: 3, color: "#f59e0b", label: "Normal", Icon: MdSentimentNeutral }, // Warning/amber
    { level: 4, color: "#f97316", label: "Cansado", Icon: MdSentimentDissatisfied }, // Orange brand color
    { level: 5, color: "#ef4444", label: "Exausto", Icon: MdSentimentVeryDissatisfied } // Danger/red
  ];

  // Sincronizar estado local com dados do banco quando mudar data ou carregar dados
  useEffect(() => {
    if (fatigueLog) {
      setSelectedLevel(fatigueLog.level);
      setFeedback(fatigueLog.feedback || "");
      setFeedbackSaved(true); // Se existe no banco, está salvo
      previousFeedbackRef.current = fatigueLog.feedback || "";
    } else {
      setSelectedLevel(null);
      setFeedback("");
      setFeedbackSaved(false);
      previousFeedbackRef.current = "";
    }
  }, [fatigueLog, selectedDate]);

  const handleLevelSelect = async (level: number) => {
    // Se clicar no mesmo nível, deselecionar
    if (selectedLevel === level) {
      const currentFeedbackText = feedback || null;
      setSelectedLevel(null);
      setFeedback("");
      setFeedbackSaved(false);
      try {
        await deleteFatigueLog();
        // Track fatigue unlogged
        if (user?.id) {
          track('activity_fatigue_unlogged', user.id, {
            metadata: {
              date: format(selectedDate, 'dd-MM-yyyy'),
              feedback: currentFeedbackText,
            },
          });
        }
      } catch (error) {
        // Erro já tratado no hook
        console.error("Erro ao deletar fadiga:", error);
      }
      return;
    }

    // Selecionar novo nível
    setSelectedLevel(level);
    const currentFeedback = feedback || null;
    try {
      await upsertFatigueLog({ level, feedback: currentFeedback });
      // Track fatigue logged
      if (user?.id) {
        track('activity_fatigue_logged', user.id, {
          metadata: {
            level,
            date: format(selectedDate, 'dd-MM-yyyy'),
            feedback: currentFeedback,
          },
        });
      }
      // Se tinha feedback, marca como salvo
      if (currentFeedback) {
        setFeedbackSaved(true);
      }
    } catch (error) {
      // Erro já tratado no hook
      console.error("Erro ao salvar fadiga:", error);
      // Reverter estado se falhar
      setSelectedLevel(fatigueLog?.level || null);
      setFeedbackSaved(false);
    }
  };

  const handleFeedbackChange = (value: string) => {
    setFeedback(value);
    setFeedbackSaved(false); // Feedback mudou, ainda não está salvo

    // Limpar timeout anterior
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // Salvar feedback após 1 segundo sem digitação (debounce)
    feedbackTimeoutRef.current = setTimeout(async () => {
      if (selectedLevel !== null) {
        try {
          await upsertFatigueLog({ level: selectedLevel, feedback: value || null });
          setFeedbackSaved(true); // Marcar como salvo após sucesso

          // Track feedback added if it changed from empty to non-empty or vice versa
          if (user?.id && value && value.trim() !== previousFeedbackRef.current.trim()) {
            track('activity_fatigue_commentary_added', user.id, {
              metadata: { date: format(selectedDate, 'dd-MM-yyyy'), feedback: value || null },
            });
            previousFeedbackRef.current = value;
          }
        } catch (error) {
          console.error("Erro ao salvar feedback:", error);
          setFeedbackSaved(false); // Manter como não salvo em caso de erro
        }
      }
    }, 1000);
  };

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const isProcessing = isUpserting || isDeleting || isLoading;

  return (
    <div className="px-4 pb-12">
      <Card className="border-none shadow-sm rounded-[20px]">
        <div className="p-5">
          <h3 className="text-sm font-brand-tertiary text-foreground mb-4 ">
            Como está sua fadiga hoje?
          </h3>

          <div className="flex items-center justify-between gap-2">
            {fatigueConfig.map(({ level, color, label, Icon }) => (
              <div key={level} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleLevelSelect(level)}
                  disabled={isProcessing}
                  className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center
                    ${selectedLevel === level
                      ? 'scale-110 shadow-lg'
                      : 'hover:scale-105 opacity-70 hover:opacity-100'
                    }
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={{
                    backgroundColor: color,
                    ...(selectedLevel === level && {
                      boxShadow: `0 0 0 2px white, 0 0 0 4px ${color}`
                    })
                  }}
                >
                  <Icon className="w-6 h-6 text-black" />
                </button>

                <span className="text-[10px] font-brand-tertiary text-muted-foreground text-center font-semibold leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Campo de feedback - aparece apenas quando um nível está selecionado */}
          {selectedLevel !== null && (
            <div className="mt-6 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <label className="text-sm font-brand-tertiary text-foreground">
                  Deseja adicionar um comentário para seu treinador? <span className="text-muted-foreground">(opcional)</span>
                </label>
                {feedbackSaved && feedback && (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </div>
              <Textarea
                value={feedback}
                onChange={(e) => handleFeedbackChange(e.target.value)}
                placeholder="Ex: Dormi mal ontem, perna esquerda doendo..."
                className="min-h-[80px] resize-none font-brand-tertiary text-base"
                disabled={isProcessing}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
