import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface RestartOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const RestartOnboardingDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: RestartOnboardingDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-brand tracking-wide">Refazer Onboarding?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 font-brand-tertiary">
            <p>
              <strong>Atenção:</strong> Ao refazer o onboarding, você perderá todo o seu plano de treino atual e todos os treinos registrados.
            </p>
            <p>
              Um novo plano será gerado do zero baseado nas suas novas respostas.
            </p>
            <p className="text-destructive font-semibold">
              Esta ação não pode ser desfeita.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} className="font-brand tracking-wide font-semibold uppercase">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-brand tracking-wide font-semibold uppercase"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetando...
              </>
            ) : (
              'Sim, Refazer Onboarding'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
