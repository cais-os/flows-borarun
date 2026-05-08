import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


interface Step6GoalProps {
    value?: 'start_running' | 'specific_distance';
    onChange: (value: 'start_running' | 'specific_distance') => void;
    selectedDistance?: number | null;
    onDistanceChange?: (distance: number | null) => void;
    goalHours?: number;
    goalMinutes?: number;
    onGoalTimeChange?: (hours: number, minutes: number) => void;
    selectedTime?: '8' | '10' | '12' | '16' | 'custom' | null;
    onTimeChange?: (time: '8' | '10' | '12' | '16' | 'custom' | null) => void;
    customWeeks?: number;
    onCustomWeeksChange?: (weeks: number) => void;
    targetDate?: Date | null;
    onTargetDateChange?: (date: Date | null) => void;
    startDate?: Date | null;
    onStartDateChange?: (date: Date | null) => void;
}

const calculateTargetDate = (startDate: Date | null, weeks: number): Date | null => {
    if (!startDate || weeks <= 0) return null;
    const targetDate = new Date(startDate);
    targetDate.setDate(targetDate.getDate() + (weeks * 7));
    return targetDate;
};

export const Step6Goal = ({ value, onChange, selectedDistance, onDistanceChange, goalHours, goalMinutes, onGoalTimeChange, selectedTime, onTimeChange, customWeeks, onCustomWeeksChange, targetDate, onTargetDateChange, startDate, onStartDateChange }: Step6GoalProps) => {
    const [displayMonth, setDisplayMonth] = React.useState<Date | undefined>(targetDate || undefined);

    const shortcuts = [
        { value: 5, label: '5km' },
        { value: 10, label: '10km' },
        { value: 21, label: '21km (Meia Maratona)' },
        { value: 42, label: '42km (Maratona)' }
    ];

    // Verifica se o valor atual corresponde a algum atalho
    const isShortcutSelected = (value: number) => {
        return selectedDistance !== null && selectedDistance !== undefined && selectedDistance === value;
    };

    // Verifica se o input tem um valor válido (qualquer número >= 0)
    const hasValidInput = selectedDistance !== null && selectedDistance !== undefined && selectedDistance >= 0;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            onDistanceChange?.(null);
        } else {
            // Normalizar vírgula para ponto
            const normalizedValue = value.replace(',', '.');
            const numValue = parseFloat(normalizedValue);
            if (!isNaN(numValue) && numValue >= 0) {
                onDistanceChange?.(numValue);
            }
        }
    };

    const handleShortcutClick = (value: number) => {
        onDistanceChange?.(value);
    };

    // Lógica para semanas
    const timeShortcuts = [
        { value: 8, label: '8 semanas' },
        { value: 10, label: '10 semanas' },
        { value: 12, label: '12 semanas' },
        { value: 16, label: '16 semanas' }
    ];

    // Obtém o valor atual de semanas
    const getCurrentWeeks = (): number | null => {
        if (selectedTime === 'custom' && customWeeks) {
            return customWeeks;
        } else if (selectedTime && selectedTime !== 'custom') {
            return parseInt(selectedTime);
        }
        return null;
    };

    const currentWeeks = getCurrentWeeks();

    // Verifica se o valor atual corresponde a algum atalho de tempo
    const isTimeShortcutSelected = (value: number) => {
        return currentWeeks !== null && currentWeeks === value;
    };

    // Verifica se o input tem um valor válido
    const hasValidWeeksInput = currentWeeks !== null && currentWeeks > 0;

    const handleWeeksInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            onTimeChange?.(null);
            onCustomWeeksChange?.(0);
        } else {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue) && numValue > 0 && numValue <= 52) {
                // Se for um dos atalhos, usar selectedTime correspondente
                if (numValue === 8) {
                    onTimeChange?.('8');
                } else if (numValue === 10) {
                    onTimeChange?.('10');
                } else if (numValue === 12) {
                    onTimeChange?.('12');
                } else if (numValue === 16) {
                    onTimeChange?.('16');
                } else {
                    // Caso contrário, usar custom
                    onTimeChange?.('custom');
                    onCustomWeeksChange?.(numValue);
                }
            }
        }
    };

    const handleTimeShortcutClick = (value: number) => {
        onTimeChange?.(value.toString() as '8' | '10' | '12' | '16');
        onCustomWeeksChange?.(0);
    };

    // Calcula a data da prova baseado na data de início
    React.useEffect(() => {
        if (!startDate) return;

        let weeksToAdd = 0;

        if (selectedTime === 'custom' && customWeeks) {
            weeksToAdd = customWeeks;
        } else if (selectedTime && selectedTime !== 'custom') {
            weeksToAdd = parseInt(selectedTime);
        }

        if (weeksToAdd > 0) {
            const calculatedDate = calculateTargetDate(startDate, weeksToAdd);
            if (calculatedDate && !targetDate) {
                onTargetDateChange?.(calculatedDate);
            }
        }
    }, [selectedTime, customWeeks, startDate]);

    // Atualiza o mês exibido quando targetDate mudar
    React.useEffect(() => {
        if (targetDate) {
            setDisplayMonth(targetDate);
        }
    }, [targetDate]);

    return (
        <div className="space-y-6 md:space-y-8 mb-8">
            <div className="text-center pt-2">
                <h2 className="text-lg font-bold tracking-wide">Qual a sua meta?</h2>
                {/* <p className="text-muted-foreground text-sm mt-2 font-brand-tertiary">
                    Vamos criar um plano personalizado para você
                </p> */}
            </div>

            {/* Seção 1: Tipo de meta */}
            <RadioGroup value={value} onValueChange={(newValue) => {
                onChange(newValue as 'start_running' | 'specific_distance');
                if (newValue === 'start_running') {
                    onDistanceChange?.(null);
                    onGoalTimeChange?.(0, 0);
                    onTimeChange?.(null);
                    onCustomWeeksChange?.(0);
                    onTargetDateChange?.(null);
                }
            }} className="space-y-1 md:space-y-3">
                <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'start_running' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
                    <div className="flex items-start space-x-2.5 md:space-x-3">
                        <RadioGroupItem value="start_running" id="start_running" className="mt-1" />
                        <Label htmlFor="start_running" className="cursor-pointer flex-1">
                            <div className="font-semibold text-sm md:text-base font-brand-tertiary">Começar a correr</div>
                            <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                                Quero criar o hábito de correr regularmente
                            </div>
                        </Label>
                    </div>
                </Card>

                <Card className={`p-3.5 md:p-4 cursor-pointer transition-all ${value === 'specific_distance' ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>
                    <div className="flex items-start space-x-2.5 md:space-x-3">
                        <RadioGroupItem value="specific_distance" id="specific_distance" className="mt-1" />
                        <Label htmlFor="specific_distance" className="cursor-pointer flex-1">
                            <div className="font-semibold text-sm md:text-base font-brand-tertiary">Correr uma distância específica</div>
                            <div className="text-xs md:text-sm text-muted-foreground leading-tight mt-0.5 font-brand-tertiary">
                                Tenho uma prova ou meta de distância
                            </div>
                        </Label>
                    </div>
                </Card>
            </RadioGroup>

            {value === 'specific_distance' && (
                <div className="space-y-3 md:space-y-4 mt-4">
                    <div className="text-center">
                        <h3 className="text-base md:text-lg font-semibold tracking-wide">Qual distância você quer correr?</h3>
                    </div>

                    <div className="space-y-2">
                        {/* Input numérico principal */}
                        <div className="flex justify-center">
                            <div className="flex items-center space-x-2">
                                <Input
                                    id="goal-distance-input"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={selectedDistance !== null && selectedDistance !== undefined ? selectedDistance : ''}
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
                                        className={`h-12 text-sm md:text-base font-brand-tertiary relative ${isShortcutSelected(shortcut.value)
                                            ? 'bg-primary text-primary-foreground border-primary border-2'
                                            : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        {shortcut.value === 5 && (
                                            <Badge className="absolute -top-3 -right-3 bg-black text-white text-xs px-2 py-1 pointer-events-none select-none" aria-hidden>
                                                Recomendado
                                            </Badge>
                                        )}
                                        {shortcut.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedDistance !== null && selectedDistance !== undefined && selectedDistance > 0 && (
                <>
                    {/* Seção de tempo desejado para a distância */}
                    <div className="space-y-3 md:space-y-4 mt-4">
                        <div className="text-center">
                            <h3 className="text-base md:text-lg font-semibold tracking-wide">Qual tempo desejado para essa distância?</h3>
                        </div>
                        <div className="flex items-center justify-center space-x-3">
                            <div className="flex items-center space-x-2">
                                <Input
                                    type="number"
                                    min="0"
                                    max="23"
                                    value={goalHours || ''}
                                    onChange={(e) => onGoalTimeChange?.(parseInt(e.target.value) || 0, goalMinutes || 0)}
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
                                    value={goalMinutes || ''}
                                    onChange={(e) => onGoalTimeChange?.(goalHours || 0, parseInt(e.target.value) || 0)}
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

                    {/* Seção de semanas */}
                    <div className="space-y-3 md:space-y-4 mt-4">
                        <div className="text-center">
                            <h3 className="text-base md:text-lg font-semibold tracking-wide">Em quanto tempo quer fazer esse percurso?</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Input numérico principal */}
                            <div className="flex justify-center">
                                <div className="flex items-center space-x-2">
                                    <Input
                                        id="weeks-input"
                                        type="number"
                                        step="1"
                                        min="1"
                                        max="52"
                                        value={currentWeeks !== null ? currentWeeks : ''}
                                        onChange={handleWeeksInputChange}
                                        placeholder="0"
                                        inputMode="numeric"
                                        className={`w-32 h-12 text-center border text-lg font-semibold ${hasValidWeeksInput
                                            ? 'border-primary border-2 bg-primary text-primary-foreground'
                                            : 'border-gray-300 bg-white'
                                            }`}
                                    />
                                    <span className="text-sm text-muted-foreground font-brand-tertiary min-w-[3rem]">semanas</span>
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
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {timeShortcuts.map((shortcut) => (
                                        <Button
                                            key={shortcut.value}
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleTimeShortcutClick(shortcut.value)}
                                            className={`h-12 text-sm md:text-base font-brand-tertiary ${isTimeShortcutSelected(shortcut.value)
                                                ? 'bg-primary text-primary-foreground border-primary border-2'
                                                : 'bg-white border-gray-300'
                                                }`}
                                        >
                                            {shortcut.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Seção 4: Quando quer iniciar? (aparece se start_running OU se specific_distance E selectedTime) */}
            {(value === 'start_running' || (value === 'specific_distance' && selectedTime)) && (
                <div className="space-y-4 md:space-y-4 mt-4">
                    <div className="text-center">
                        <h3 className="text-base md:text-lg font-semibold tracking-wide">Quando quer iniciar o seu plano?</h3>
                    </div>

                    {/* Calendário de data de início */}
                    <div className="border rounded-md py-6 px-3 bg-white flex justify-center">
                        <Calendar
                            mode="single"
                            selected={startDate || undefined}
                            onSelect={(date) => onStartDateChange?.(date || null)}
                            disabled={(date) => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const compareDate = new Date(date);
                                compareDate.setHours(0, 0, 0, 0);
                                return compareDate < today;
                            }}
                            locale={ptBR}
                            showOutsideDays={false}
                        // className="[&_.rdp-day_selected]:!bg-black [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected]:!rounded-full [&_.rdp-day_selected]:!border-0"
                        />
                    </div>
                </div>
            )}

            {/* Seção 5: Qual dia da meta? (só para specific_distance E selectedTime E startDate) */}
            {value === 'specific_distance' && selectedTime && startDate && (
                <div className="space-y-3 md:space-y-4 mt-4">
                    <div className="text-center">
                        <h3 className="text-base md:text-lg font-semibold tracking-wide">Qual dia quer escolher para ser sua meta?</h3>
                    </div>

                    <div className="border rounded-md py-6 px-3 bg-white flex justify-center">
                        <Calendar
                            mode="single"
                            selected={targetDate || undefined}
                            onSelect={(date) => onTargetDateChange?.(date || null)}
                            disabled={(date) => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const compareDate = new Date(date);
                                compareDate.setHours(0, 0, 0, 0);
                                
                                // Não pode ser anterior a hoje
                                if (compareDate < today) return true;
                                
                                // Não pode ser anterior ou igual à data de início
                                if (startDate) {
                                    const start = new Date(startDate);
                                    start.setHours(0, 0, 0, 0);
                                    if (compareDate <= start) return true;
                                }
                                
                                return false;
                            }}
                            locale={ptBR}
                            showOutsideDays={false}
                            month={displayMonth}
                            onMonthChange={setDisplayMonth}
                            className="[&_.rdp-day_selected]:!bg-black [&_.rdp-day_selected]:!text-white [&_.rdp-day_selected]:!rounded-full [&_.rdp-day_selected]:!border-0"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
