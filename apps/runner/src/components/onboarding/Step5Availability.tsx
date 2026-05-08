import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Step5AvailabilityProps {
    selectedDays: string[];
    onDaysChange: (days: string[]) => void;
    desiredDays: number;
    onDesiredDaysChange: (days: number) => void;
    longRunDays: string[];
    onLongRunDaysChange: (days: string[]) => void;
    runningLevel: 'never' | 'beginner' | 'intermediate' | 'advanced' | 'elite';
    currentRunningDays: number;
}

export const Step5Availability = ({ selectedDays, onDaysChange, desiredDays, onDesiredDaysChange, longRunDays, onLongRunDaysChange, runningLevel, currentRunningDays }: Step5AvailabilityProps) => {
    const daysOfWeek = [
        { value: 'monday', label: 'Segunda', initial: 'S' },
        { value: 'tuesday', label: 'Terça', initial: 'T' },
        { value: 'wednesday', label: 'Quarta', initial: 'Q' },
        { value: 'thursday', label: 'Quinta', initial: 'Q' },
        { value: 'friday', label: 'Sexta', initial: 'S' },
        { value: 'saturday', label: 'Sábado', initial: 'S' },
        { value: 'sunday', label: 'Domingo', initial: 'D' }
    ];

    const toggleDay = (dayValue: string) => {
        if (selectedDays.includes(dayValue)) {
            onDaysChange(selectedDays.filter(day => day !== dayValue));
        } else {
            onDaysChange([...selectedDays, dayValue]);
        }
    };

    const toggleLongRunDay = (dayValue: string) => {
        if (longRunDays.includes(dayValue)) {
            // Se clicar no dia já selecionado, deseleciona
            onLongRunDaysChange(longRunDays.filter(day => day !== dayValue));
        } else {
            // Se clicar em outro dia, substitui a seleção (sempre mantém 1 dia)
            onLongRunDaysChange([dayValue]);
        }
    };

    // Calcula sugestão baseada no perfil do usuário e dias disponíveis
    const getSuggestedDays = () => {
        const availableDays = selectedDays.length;

        // Determina o máximo recomendado por nível
        let maxRecommended: number;
        let startingSuggestion: number;

        // Ajusta por nível de experiência
        switch (runningLevel) {
            case 'never':
            case 'beginner':
                maxRecommended = 4; // Iniciantes: máximo 4 dias
                // Se não corre, começar com 2-3 dias
                startingSuggestion = currentRunningDays === 0 ? 2 : Math.min(currentRunningDays + 1, 3);
                break;

            case 'intermediate':
                maxRecommended = 5; // Intermediários: máximo 5 dias
                startingSuggestion = currentRunningDays === 0 ? 3 : Math.min(currentRunningDays + 1, 4);
                break;

            case 'advanced':
            case 'elite':
                maxRecommended = 6; // Avançados: podem fazer até 6 dias
                startingSuggestion = currentRunningDays === 0 ? 4 : Math.min(currentRunningDays + 1, 5);
                break;

            default:
                maxRecommended = 4;
                startingSuggestion = 3;
        }

        // Regra de progressão gradual: não aumentar mais de 2 dias
        const maxProgression = currentRunningDays + 2;

        // Calcula a sugestão final considerando todas as restrições
        let suggestion = Math.min(
            startingSuggestion,      // Sugestão base por nível
            maxRecommended,          // Máximo por nível
            maxProgression,          // Progressão gradual
            availableDays            // Não pode ser maior que dias disponíveis
        );

        // Garante pelo menos 2 dias (mínimo para progressão)
        if (availableDays >= 2 && suggestion < 2) {
            suggestion = 2;
        }

        // Se só tem 1 dia disponível, sugerir 1
        if (availableDays === 1) {
            suggestion = 1;
        }

        return suggestion;
    };

    const suggestedDays = getSuggestedDays();
    const showSecondQuestion = selectedDays.length > 0;

    return (
        <div className="space-y-4 md:space-y-6 mb-12">
            <div className="text-center pt-2 pb-4">
                <h2 className="text-lg font-bold tracking-wide">Quais dias da semana você tem disponibilidade para correr?</h2>
            </div>

            <div className="space-y-4">
                <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                    {daysOfWeek.map((day) => (
                        <Card
                            key={day.value}
                            className={`w-10 h-10 md:w-14 md:h-14 cursor-pointer transition-all flex items-center justify-center ${selectedDays.includes(day.value)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'hover:border-primary/50'
                                }`}
                            onClick={() => toggleDay(day.value)}
                        >
                            <div className="text-center">
                                <div className="text-sm md:text-base font-bold">
                                    {day.initial}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Segunda pergunta - só aparece depois de selecionar os dias */}
                {showSecondQuestion && (
                    <div className="space-y-4 mt-6 pt-6">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg md:text-xl font-bold">
                                Quantos dias você está disposto a correr?
                            </h3>
                        </div>

                        {/* Sugestão */}
                        <div className="bg-primary/30 border border-primary/20 rounded-lg p-3 text-center">
                            <p className="text-sm text-black">
                                Sugestão:{" "}
                                <button
                                    type="button"
                                    onClick={() => onDesiredDaysChange(suggestedDays)}
                                    className="font-semibold text-black hover:underline"
                                >
                                    {suggestedDays} {suggestedDays === 1 ? 'dia' : 'dias'} por semana
                                </button>
                            </p>
                        </div>

                        <div className="grid grid-cols-4 gap-2 md:gap-3 max-w-xs mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                <Button
                                    key={num}
                                    type="button"
                                    variant={desiredDays === num ? "default" : "outline"}
                                    size="lg"
                                    onClick={() => onDesiredDaysChange(num)}
                                    disabled={num > selectedDays.length}
                                    className={`h-12 md:h-14 text-lg font-semibold ${desiredDays !== num ? 'bg-white' : ''}`}
                                >
                                    {num}
                                </Button>
                            ))}
                        </div>

                    </div>
                )}

                {/* Terceira pergunta - só aparece depois de selecionar pelo menos 2 dias */}
                {showSecondQuestion && desiredDays >= 2 && (
                    <div className="space-y-3 mt-6 pt-6">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg md:text-xl font-bold">
                                Qual dia da semana você quer que seja seu treino longo? <span className="opacity-50 font-normal">(opcional)</span>
                            </h3>
                        </div>

                        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                            {daysOfWeek.map((day) => (
                                <Card
                                    key={`long-run-${day.value}`}
                                    className={`w-10 h-10 md:w-14 md:h-14 cursor-pointer transition-all flex items-center justify-center ${longRunDays.includes(day.value)
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : !selectedDays.includes(day.value)
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:border-primary/50'
                                        }`}
                                    onClick={() => {
                                        if (selectedDays.includes(day.value)) {
                                            toggleLongRunDay(day.value);
                                        }
                                    }}
                                >
                                    <div className="text-center">
                                        <div className="text-sm md:text-base font-bold">
                                            {day.initial}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
