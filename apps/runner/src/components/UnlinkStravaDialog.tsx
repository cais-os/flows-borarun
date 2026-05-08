import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUnlinkStrava } from "@/hooks/useUnlinkStrava";

interface UnlinkStravaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingId: string;
}

export const UnlinkStravaDialog = ({ open, onOpenChange, trainingId }: UnlinkStravaDialogProps) => {
  const unlinkStrava = useUnlinkStrava();

  const handleConfirm = () => {
    unlinkStrava.mutate(trainingId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100%-2rem)] rounded-[18px]">
        <DialogHeader>
          <DialogTitle>Desvincular do Strava</DialogTitle>
          <DialogDescription>
            Remover o vínculo apagará os dados importados (distância e tempo) e marcará o treino como não concluído.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="font-brand-primary font-bold uppercase tracking-wide"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="font-brand-primary font-bold uppercase tracking-wide"
            onClick={handleConfirm}
            disabled={unlinkStrava.isPending}
          >
            {unlinkStrava.isPending ? "Removendo..." : "Desvincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

