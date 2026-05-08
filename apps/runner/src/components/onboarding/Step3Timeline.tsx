import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Step3TimelineProps {
  distance: number | null;
  onDistanceChange: (distance: number | null) => void;
  hours: number;
  minutes: number;
  onTimeChange: (hours: number, minutes: number) => void;
}

export const Step3Timeline = ({ distance, onDistanceChange, hours, minutes, onTimeChange }: Step3TimelineProps) => {
  const shortcuts = [
    { value: 0, label: '0km' },
    { value: 5, label: '5km' },
    { value: 10, label: '10km' },
    { value: 21, label: '21km (Meia Maratona)' },
    { value: 42, label: '42km (Maratona)' }
  ];

  // Verifica se o valor atual corresponde a algum atalho
  const isShortcutSelected = (value: number) => {
    return distance !== null && distance === value;
  };

  // Verifica se o input tem um valor válido (qualquer número >= 0)
  const hasValidInput = distance !== null && distance >= 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onDistanceChange(null);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        onDistanceChange(numValue);
      }
    }
  };

  const handleShortcutClick = (value: number) => {
    onDistanceChange(value);
    // Se selecionar 0km, automaticamente definir tempo como 0
    if (value === 0) {
      onTimeChange(0, 0);
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="text-center pt-2 pb-4">
        <h2 className="text-lg font-bold tracking-wide">Qual sua distância atual?</h2>
      </div>

      <div className="space-y-4">
        {/* Input numérico principal */}
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <Input
              id="distance-input"
              type="number"
              step="0.1"
              min="0"
              value={distance !== null ? distance : ''}
              onChange={handleInputChange}
              placeholder="0"
              inputMode="decimal"
              className={`w-32 h-12 text-center border text-lg font-semibold ${hasValidInput
                  ? 'border-primary border-2 bg-primary text-primary-foreground'
                  : 'border-gray-300 bg-white'
                }`}
            />
            <span className="text-sm text-muted-foreground font-brand-tertiary min-w-[2rem]">km</span>
          </div>
        </div>

        {/* Divisor horizontal */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
        </div>

        {/* Atalhos rápidos */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {shortcuts.map((shortcut) => (
              <Button
                key={shortcut.value}
                type="button"
                variant="outline"
                onClick={() => handleShortcutClick(shortcut.value)}
                className={`h-12 text-sm md:text-base font-brand-tertiary ${isShortcutSelected(shortcut.value)
                  ? 'bg-primary text-primary-foreground border-primary border-2'
                  : 'bg-white border-gray-300'
                  }`}
              >
                {shortcut.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Campo de tempo - aparece quando distância > 0 */}
        {distance !== null && distance > 0 && (
          <div className="space-y-4">
            <Label className="text-lg font-brand font-bold block text-center">E o seu melhor tempo?</Label>
            <div className="flex items-center justify-center space-x-3">
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={hours || ''}
                  onChange={(e) => onTimeChange(parseInt(e.target.value) || 0, minutes)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-20 h-12 text-center border border-gray-300 bg-white text-lg font-semibold"
                />
                <span className="text-sm text-muted-foreground font-brand-tertiary">h</span>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes || ''}
                  onChange={(e) => onTimeChange(hours, parseInt(e.target.value) || 0)}
                  placeholder="00"
                  inputMode="numeric"
                  className="w-20 h-12 text-center border border-gray-300 bg-white text-lg font-semibold"
                />
                <span className="text-sm text-muted-foreground font-brand-tertiary">min</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center font-brand-tertiary">
              Deixe em branco se não souber
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
