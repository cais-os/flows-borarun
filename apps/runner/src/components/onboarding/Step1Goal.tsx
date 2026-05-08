import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface Step1GoalProps {
  value?: 'never' | 'beginner' | 'intermediate' | 'advanced' | 'elite';
  onChange: (value: 'never' | 'beginner' | 'intermediate' | 'advanced' | 'elite') => void;
}

export const Step1Goal = ({ value, onChange }: Step1GoalProps) => {
  return (
    <div className="space-y-3 md:space-y-4">
      <div className="text-center pt-2 pb-4">
        <h2 className="text-lg font-bold tracking-wide">Você se considera em qual nível de corrida?</h2>
        {/* <p className="text-muted-foreground text-sm mt-2 font-brand-tertiary">
          Escolha o nível que melhor descreve sua experiência
        </p> */}
      </div>

      <RadioGroup value={value} onValueChange={onChange} className="space-y-1 md:space-y-3">
        <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'never' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
          <div className="flex items-start space-x-2.5 md:space-x-3">
            <RadioGroupItem value="never" id="never" className="mt-1" />
            <Label htmlFor="never" className="cursor-pointer flex-1">
              <div className="font-semibold text-sm md:text-base font-brand-tertiary">Nunca corri</div>
              <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                Estou começando do zero
              </div>
            </Label>
          </div>
        </Card>

        <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'beginner' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
          <div className="flex items-start space-x-2.5 md:space-x-3">
            <RadioGroupItem value="beginner" id="beginner" className="mt-1" />
            <Label htmlFor="beginner" className="cursor-pointer flex-1">
              <div className="font-semibold text-sm md:text-base font-brand-tertiary">Iniciante</div>
              <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                Corro há menos de 6 meses
              </div>
            </Label>
          </div>
        </Card>

        <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'intermediate' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
          <div className="flex items-start space-x-2.5 md:space-x-3">
            <RadioGroupItem value="intermediate" id="intermediate" className="mt-1" />
            <Label htmlFor="intermediate" className="cursor-pointer flex-1">
              <div className="font-semibold text-sm md:text-base font-brand-tertiary">Intermediário</div>
              <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                Corro regularmente há mais de 6 meses
              </div>
            </Label>
          </div>
        </Card>

        <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'advanced' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
          <div className="flex items-start space-x-2.5 md:space-x-3">
            <RadioGroupItem value="advanced" id="advanced" className="mt-1" />
            <Label htmlFor="advanced" className="cursor-pointer flex-1">
              <div className="font-semibold text-sm md:text-base font-brand-tertiary">Avançado</div>
              <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                Corro há anos e tenho treino estruturado
              </div>
            </Label>
          </div>
        </Card>

        <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'elite' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
          <div className="flex items-start space-x-2.5 md:space-x-3">
            <RadioGroupItem value="elite" id="elite" className="mt-1" />
            <Label htmlFor="elite" className="cursor-pointer flex-1">
              <div className="font-semibold text-sm md:text-base font-brand-tertiary">Elite</div>
              <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                Atleta competitivo com tempos de elite
              </div>
            </Label>
          </div>
        </Card>
      </RadioGroup>
    </div>
  );
};
