import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddTrainingFABProps {
  onClick: () => void;
}

export const AddTrainingFAB = ({ onClick }: AddTrainingFABProps) => {
  return (
    <Button
      className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:scale-105 transition-transform z-30"
      onClick={onClick}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
};

