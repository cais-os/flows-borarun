import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRecalculateTraining } from '@/hooks/useRecalculateTraining';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface RecalculateTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CurrentWeekTraining {
  id: string;
  date: string;
  day_of_week: string;
  title: string;
  completed: boolean;
}

const dayNameMap: Record<string, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const RecalculateTrainingDialog = ({ open, onOpenChange }: RecalculateTrainingDialogProps) => {
  const [trainings, setTrainings] = useState<CurrentWeekTraining[]>([]);
  const [selectedTrainings, setSelectedTrainings] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const { mutate: recalculate, isPending } = useRecalculateTraining();

  useEffect(() => {
    if (open) {
      loadCurrentWeekTrainings();
    }
  }, [open]);

  const loadCurrentWeekTrainings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-trainings');
      
      if (error) throw error;

      // Pegar treinos da semana atual
      const currentWeek = data.currentWeek;
      const currentWeekData = data.weeklyBreakdown.find((w: any) => w.weekNumber === currentWeek);
      
      if (currentWeekData) {
        setTrainings(currentWeekData.trainings);
        // Pré-selecionar treinos já completados
        const completedIds: string[] = currentWeekData.trainings
          .filter((t: CurrentWeekTraining) => t.completed)
          .map((t: CurrentWeekTraining) => t.id);
        setSelectedTrainings(new Set(completedIds));
      }
    } catch (error) {
      console.error('Erro ao carregar treinos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTraining = (trainingId: string) => {
    const newSelected = new Set(selectedTrainings);
    if (newSelected.has(trainingId)) {
      newSelected.delete(trainingId);
    } else {
      newSelected.add(trainingId);
    }
    setSelectedTrainings(newSelected);
  };

  const handleRecalculate = () => {
    recalculate({
      completedTrainings: Array.from(selectedTrainings),
      userFeedback: feedback,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFeedback('');
        setSelectedTrainings(new Set());
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recalcular Plano de Treino</DialogTitle>
          <DialogDescription>
            Ajuste seu plano baseado no seu progresso real e feedback
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Quais treinos você realizou essa semana?
                </Label>
                {trainings.length > 0 ? (
                  <div className="space-y-2">
                    {trainings.map((training) => (
                      <div key={training.id} className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                        <Checkbox
                          id={training.id}
                          checked={selectedTrainings.has(training.id)}
                          onCheckedChange={() => handleToggleTraining(training.id)}
                        />
                        <Label
                          htmlFor={training.id}
                          className="flex-1 cursor-pointer font-normal"
                        >
                          <span className="font-medium">{dayNameMap[training.day_of_week]}</span>
                          {' - '}
                          {training.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum treino encontrado para esta semana
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback" className="text-sm font-medium">
                  Alguma observação para te ajudar?
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Ex: Me senti muito cansado essa semana, quero reduzir o ritmo..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Compartilhe como você se sentiu, seu nível de fadiga ou se quer ajustar algo
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleRecalculate}
            disabled={isPending || loading || trainings.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Recalculando...
              </>
            ) : (
              'Recalcular Plano'
            )}
          </Button>
        </DialogFooter>

        {isPending && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg text-sm text-center">
            <p className="font-medium">Gerando plano personalizado...</p>
            <p className="text-muted-foreground mt-1">Isso pode levar até 30 segundos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
