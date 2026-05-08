import { Button } from "@/components/ui/button";

interface Step2TargetProps {
  value: number;
  onChange: (value: number) => void;
}

export const Step2Target = ({ value, onChange }: Step2TargetProps) => {
  const days = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="space-y-3 md:space-y-6">
      <div className="text-center pt-2 pb-4">
        <h2 className="text-lg font-bold tracking-wide">Quantas vezes por semana você corre atualmente?</h2>
        {/* <p className="text-muted-foreground text-sm mt-2 font-brand-tertiary">
          Como você está começando, vamos criar um plano progressivo
        </p> */}
      </div>

      <div className="space-y-4">
        <div className="text-center mb-8">
          <div className="text-4xl md:text-6xl font-bold mb-2">
            {value === -1 ? '' : value}
          </div>
          <div className="text-sm text-muted-foreground font-brand-tertiary">
            {value === -1 ? 'Selecione uma opção' : value === 0 ? 'dias por semana' : value === 1 ? 'dia por semana' : 'dias por semana'}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-3 max-w-xs mx-auto">
          {days.map((day) => (
            <Button
              key={day}
              variant={value === day ? "default" : "outline"}
              size="lg"
              onClick={() => onChange(value === day ? -1 : day)}
              className={`h-12 md:h-14 text-lg font-semibold ${value !== day ? 'bg-white' : ''}`}
            >
              {day}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
