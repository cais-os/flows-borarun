import { useState } from 'react';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CompleteTrainingDialog } from '@/components/CompleteTrainingDialog';
import { useUpdateTraining } from '@/hooks/useUpdateTraining';
import { trainingTypeColors } from '@/types/training';
import { Card } from '@/components/ui/card';
import { MapPin, Clock, Activity } from 'lucide-react';
import { metersToKm, paceSecondsToFormatted, secondsToMinutes, secondsToTimeString } from '@/lib/utils';
import { TrainingCheckbox } from '@/components/TrainingCheckbox';
import { useUnlinkStrava } from '@/hooks/useUnlinkStrava';
import { UnlinkStravaDialog } from '@/components/UnlinkStravaDialog';
import { LinkStravaActivityDialog } from '@/components/LinkStravaActivityDialog';
import { track } from '@/lib/analytics';
import { useAuth } from '@/hooks/useAuth';
import {
    MdSentimentVerySatisfied,
    MdSentimentSatisfied,
    MdSentimentNeutral,
    MdSentimentDissatisfied,
    MdSentimentVeryDissatisfied
} from 'react-icons/md';

interface TrainingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    training: {
        id: string;
        date: string;
        type: 'long' | 'recovery' | 'interval' | 'easy';
        title: string;
        description: string | null;
        distance: number; // meters
        elapsed_time: number; // seconds
        pace?: number | null; // seconds per km
        completed?: boolean;
        actual_distance?: number | null; // meters
        actual_elapsed_time?: number | null; // seconds
        actual_pace?: number | null; // seconds per km
        difficulty_level?: number | null;
        feedbacks?: string | null;
        strava_activity_id?: number | null;
    };
}

const formatDuration = (seconds: number): string => {
    const timeStr = secondsToTimeString(seconds);
    if (!timeStr) return '';
    if (timeStr.includes(':')) return timeStr;
    const minutes = Math.round(secondsToMinutes(seconds));
    return `${minutes} min`;
};

const difficultyConfig = [
    { level: 1, color: "#7acc16", label: "Muito fácil", Icon: MdSentimentVerySatisfied },
    { level: 2, color: "#d1d016", label: "Fácil", Icon: MdSentimentSatisfied },
    { level: 3, color: "#f59e0b", label: "Normal", Icon: MdSentimentNeutral },
    { level: 4, color: "#f97316", label: "Difícil", Icon: MdSentimentDissatisfied },
    { level: 5, color: "#ef4444", label: "Muito difícil", Icon: MdSentimentVeryDissatisfied }
];

export const TrainingDialog = ({ open, onOpenChange, training }: TrainingDialogProps) => {
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const updateTraining = useUpdateTraining();
    const unlinkStrava = useUnlinkStrava();
    const { user } = useAuth();
    const color = trainingTypeColors[training.type];

    const handleToggleComplete = () => {
        // Sempre abre o dialog (para registrar ou editar)
        setShowCompleteDialog(true);
    };

    const handleCheckboxChange = (checked: boolean) => {
        if (!checked && training.completed) {
            // Se desmarcar um treino concluído, desmarcar diretamente
            updateTraining.mutate({
                trainingId: training.id,
                completed: false,
            });
        } else if (checked && !training.completed) {
            // Se marcar um treino não concluído, abrir dialog
            setShowCompleteDialog(true);
        }
    };

    const handleConfirmComplete = (data: {
        distance: number;
        elapsedTime: number;
        difficultyLevel?: number | null;
        feedbacks?: string | null;
    }) => {
        const distanceKm = data.distance / 1000;
        updateTraining.mutate({
            trainingId: training.id,
            completed: true,
            actualDistance: distanceKm,
            actualElapsedTime: data.elapsedTime,
            difficultyLevel: data.difficultyLevel,
            feedbacks: data.feedbacks,
        });
        setShowCompleteDialog(false);
    };

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className="max-h-[85vh] px-4 pb-6">
                    <DrawerHeader className="text-left">
                        <DrawerTitle className="text-2xl font-bold tracking-wide flex items-center justify-between gap-2">
                            {training.title}
                            {training.completed && (
                                <div onClick={(e) => e.stopPropagation()} className="ml-auto">
                                    <TrainingCheckbox
                                        checked={training.completed || false}
                                        onCheckedChange={handleCheckboxChange}
                                        color={color}
                                    />
                                </div>
                            )}
                        </DrawerTitle>
                    </DrawerHeader>

                    <div className="overflow-y-auto px-4 pb-4 space-y-4">
                        {/* Card de Métricas - Layout exato do DailyTrainingCard */}
                        <Card className="relative overflow-hidden border-none shadow-sm rounded-[20px]">
                            {/* Barra colorida vertical esquerda */}
                            <div
                                className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg"
                                style={{ backgroundColor: color }}
                            />

                            <div className="pl-6 pr-4 py-4">
                                {/* Dados do treino */}
                                <div className="flex flex-col gap-2 text-sm font-brand-tertiary">
                                    {/* Distância */}
                                    {training.distance && (
                                        <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                            <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
                                            {training.completed && training.actual_distance ? (
                                                <>
                                                    <span className="font-semibold text-foreground mr-1">
                                                        {metersToKm(training.actual_distance).toFixed(1).replace('.', ',')} km
                                                    </span>
                                                    <span>/</span>
                                                    <span className="text-muted-foreground ml-1">
                                                        {metersToKm(training.distance).toFixed(1).replace('.', ',')} km
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-muted-foreground">
                                                        {metersToKm(training.distance).toFixed(1).replace('.', ',')} km
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    )}

                                    {/* Duração */}
                                    <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                        <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
                                        {training.completed && training.actual_elapsed_time ? (
                                            <>
                                                <span className="font-semibold text-foreground mr-1">
                                                    {secondsToTimeString(training.actual_elapsed_time)}
                                                </span>
                                                <span>/</span>
                                                <span className="text-muted-foreground ml-1">{formatDuration(training.elapsed_time)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-muted-foreground">{formatDuration(training.elapsed_time)}</span>
                                            </>
                                        )}
                                    </p>

                                    {/* Pace */}
                                    {training.pace !== undefined && training.pace !== null && (
                                        <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                            <Activity className="w-5 h-5 mr-3 flex-shrink-0" />
                                            {training.completed && training.actual_pace ? (
                                                <>
                                                    <span className="font-semibold text-foreground mr-1">
                                                        {paceSecondsToFormatted(training.actual_pace)}
                                                    </span>
                                                    <span>/</span>
                                                    <span className="text-muted-foreground ml-1">
                                                        {paceSecondsToFormatted(training.pace)}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {paceSecondsToFormatted(training.pace)}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Card de Descrição */}
                        {training.description && (
                            <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-4">
                                <div className="px-5 py-4">
                                    <h2 className="text-lg font-bold mb-3 text-foreground tracking-wide">
                                        Descrição do Treino
                                    </h2>
                                    <div className="space-y-2">
                                        {training.description.split('\n').map((line, i) => {
                                            const trimmedLine = line.trim();
                                            if (!trimmedLine) return null;

                                            if (trimmedLine.startsWith('•')) {
                                                return (
                                                    <div key={i} className="flex gap-2 items-start">
                                                        <span className="text-black mt-0.5">•</span>
                                                        <span className="text-sm text-black font-normal leading-relaxed flex-1 font-brand-tertiary">
                                                            {trimmedLine.replace('•', '').trim()}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <p key={i} className="text-sm text-black leading-relaxed font-brand-tertiary font-semibold">
                                                    {trimmedLine}
                                                </p>
                                            );
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Card de Dificuldade - aparece apenas quando treino está concluído */}
                        {training.completed && training.difficulty_level && (
                            <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-4">
                                <div className="px-5 py-4">
                                    <h2 className="text-lg font-bold mb-3 text-foreground tracking-wide">
                                        Dificuldade Registrada
                                    </h2>
                                    <div className="flex gap-2">
                                        {difficultyConfig.map(({ level, label }) => {
                                            if (level === training.difficulty_level) {
                                                return (
                                                    <span key={level} className="text-sm text-black leading-relaxed font-brand-tertiary">
                                                        {label}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Card de Feedbacks - aparece apenas quando treino está concluído */}
                        {training.completed && training.feedbacks && (
                            <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-4">
                                <div className="px-5 py-4">
                                    <h2 className="text-lg font-bold mb-3 text-foreground tracking-wide">
                                        Feedbacks para o Treinador
                                    </h2>
                                    <div className="space-y-2">
                                        <p className="text-sm text-black leading-relaxed font-brand-tertiary whitespace-pre-wrap">
                                            {training.feedbacks}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Ações */}
                        <div className="pt-2 flex flex-col gap-2">
                            <Button
                                onClick={handleToggleComplete}
                                disabled={updateTraining.isPending}
                                className="w-full h-12 rounded-xl font-brand-primary tracking-wide font-semibold uppercase transition-all text-black hover:opacity-90"
                                style={{ backgroundColor: color }}
                            >
                                {training.completed ? 'EDITAR TREINO' : 'REGISTRAR TREINO'}
                            </Button>
                            {!training.strava_activity_id && (
                                <Button
                                    variant="outline"
                                    className="w-full h-11 rounded-xl font-brand-primary tracking-wide font-semibold uppercase"
                                    onClick={() => {
                                        if (user?.id) {
                                            track("activity_clicked_link_plan_to_strava", user.id, {
                                                metadata: {
                                                    trainingId: training.id,
                                                    type: training.type,
                                                },
                                            }).catch((error) => console.warn("Failed to track activity_clicked_link_plan_to_strava", error));
                                        }
                                        setShowLinkDialog(true);
                                    }}
                                    disabled={unlinkStrava.isPending}
                                >
                                    Vincular atividade
                                </Button>
                            )}
                            {training.strava_activity_id && (
                                <Button
                                    variant="outline"
                                    className="w-full h-11 rounded-xl font-brand-primary tracking-wide font-semibold uppercase"
                                    onClick={() => setShowUnlinkDialog(true)}
                                    disabled={unlinkStrava.isPending}
                                >
                                    {unlinkStrava.isPending ? 'Desvinculando...' : 'Desvincular atividade'}
                                </Button>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <CompleteTrainingDialog
                open={showCompleteDialog}
                onOpenChange={setShowCompleteDialog}
                training={{
                    distance: training.distance,
                    elapsed_time: training.elapsed_time
                }}
                onConfirm={handleConfirmComplete}
                initialValues={training.completed ? {
                    distance: training.actual_distance ? Number(training.actual_distance) : undefined,
                    time: training.actual_elapsed_time ?? undefined,
                    difficultyLevel: training.difficulty_level ?? null,
                    feedbacks: training.feedbacks ?? null,
                } : undefined}
            />
            <UnlinkStravaDialog
                open={showUnlinkDialog}
                onOpenChange={setShowUnlinkDialog}
                trainingId={training.id}
            />
            <LinkStravaActivityDialog
                open={showLinkDialog}
                onOpenChange={setShowLinkDialog}
                trainingDate={training.date}
                trainingId={training.id}
                onLinked={() => setShowLinkDialog(false)}
            />
        </>
    );
};

