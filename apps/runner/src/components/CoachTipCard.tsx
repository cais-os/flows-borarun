import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";

interface CoachTipCardProps {
  coachName: string;
  coachAvatar?: string;
  tip: string;
}

export const CoachTipCard = ({ coachName, coachAvatar, tip }: CoachTipCardProps) => {
  return (
    <div className="px-4 pb-6">
      <Card className="border-none shadow-sm bg-muted/50">
        <div className="p-4">
          {/* Header com avatar e nome */}
          <button className="flex items-center gap-3 w-full mb-3 hover:opacity-80 transition-opacity">
            <Avatar className="h-10 w-10">
              <AvatarImage src={coachAvatar} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {coachName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-foreground flex-1 text-left">
              Treinador(a) {coachName}
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          
          {/* Dica do treinador */}
          <p className="text-sm text-foreground/80 leading-relaxed">
            "{tip}"
          </p>
        </div>
      </Card>
    </div>
  );
};
