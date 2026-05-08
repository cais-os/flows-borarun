import { useEffect, useState } from "react";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { MapPin, Clock, Activity, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { metersToKm, paceSecondsToFormatted, secondsToTimeString } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CompleteTrainingDialog } from "@/components/CompleteTrainingDialog";
import { useUpdateTraining } from "@/hooks/useUpdateTraining";
import { useUnlinkStrava } from "@/hooks/useUnlinkStrava";
import { LinkStravaTrainingDialog } from "@/components/LinkStravaTrainingDialog";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export interface StravaActivityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activity: {
        activity_id: number;
        name?: string | null;
        distance?: number | null;
        elapsed_time?: number | null;
        moving_time?: number | null;
        average_speed?: number | null;
        total_elevation_gain?: number | null;
        start_date?: string | null;
        sport_type?: string | null;
        type?: string | null;
    };
    training?: {
        id: string;
        distance?: number | null;
        elapsed_time?: number | null;
        actual_distance?: number | null;
        actual_elapsed_time?: number | null;
        actual_pace?: number | null;
        difficulty_level?: number | null;
        feedbacks?: string | null;
        type?: string | null;
    } | null;
}

export const StravaActivityDialog = ({ open, onOpenChange, activity, training }: StravaActivityDialogProps) => {
    const updateTraining = useUpdateTraining();
    const unlinkStrava = useUnlinkStrava();
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const { user } = useAuth();

    const distance = activity.distance ?? null;
    const elapsed = activity.elapsed_time ?? activity.moving_time ?? null;
    const pace = activity.average_speed && activity.average_speed > 0
        ? Math.round(1000 / activity.average_speed)
        : null;
    const isLinked = Boolean(training?.id);
    const trainingDistance = training?.actual_distance ?? training?.distance ?? distance ?? 100;
    const trainingElapsed = training?.actual_elapsed_time ?? training?.elapsed_time ?? elapsed ?? 1;

    useEffect(() => {
        if (!open) {
            setShowEditDialog(false);
            setShowLinkDialog(false);
        }
    }, [open]);

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen && user?.id) {
            const metadata: Record<string, any> = { activity_id: activity.activity_id };
            if (training?.id) {
                metadata.trainingId = training.id;
            }
            track("activity_closed_strava_training_card", user.id, { metadata }).catch((error) =>
                console.warn("Failed to track activity_closed_strava_training_card", error),
            );
        }
        onOpenChange(isOpen);
        if (!isOpen) {
            setShowEditDialog(false);
            setShowLinkDialog(false);
        }
    };

    const handleConfirmEdit = (data: { distance: number; elapsedTime: number; difficultyLevel?: number | null; feedbacks?: string | null }) => {
        if (!training?.id) return;
        updateTraining.mutate(
            {
                trainingId: training.id,
                completed: true,
                actualDistance: data.distance / 1000,
                actualElapsedTime: data.elapsedTime,
                difficultyLevel: data.difficultyLevel ?? null,
                feedbacks: data.feedbacks ?? null,
            },
            {
                onSuccess: () => {
                    setShowEditDialog(false);
                    onOpenChange(false);
                },
            }
        );
    };

    const handleLinkClick = () => {
        if (user?.id) {
            track("activity_clicked_link_strava_to_plan", user.id, {
                metadata: {
                    activity_id: activity.activity_id,
                },
            }).catch((error) => console.warn("Failed to track activity_clicked_link_strava_to_plan", error));
        }
        setShowLinkDialog(true);
    };

    const handleUnlink = () => {
        if (!training?.id) return;
        unlinkStrava.mutate(training.id, {
            onSuccess: () => {
                onOpenChange(false);
            },
        });
    };

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerContent className="max-h-[85vh] px-4 pb-6">
                <DrawerHeader className="text-left">
                    <DrawerTitle className="text-2xl font-bold tracking-wide flex items-center gap-2">
                        {activity.name || "Atividade Strava"}
                        <Badge
                            variant="secondary"
                            className="flex items-center gap-1"
                            style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#e2e8f0' }}
                        >
                            <LinkIcon className="h-3 w-3" />
                            Strava
                        </Badge>
                    </DrawerTitle>
                </DrawerHeader>

                <div className="overflow-y-auto px-4 pb-4 space-y-4">
                    <Card className="relative overflow-hidden border-none shadow-sm rounded-[20px]">
                        <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: '#e2e8f0' }} />
                        <div className="pl-6 pr-4 py-4">
                            <div className="flex flex-col gap-2 text-sm font-brand-tertiary">
                                {distance !== null && (
                                    <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                        <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
                                        <span className="font-black text-foreground">
                                            {metersToKm(distance).toFixed(1).replace(".", ",")} km
                                        </span>
                                    </p>
                                )}

                                {elapsed !== null && (
                                    <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                        <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
                                        <span className="font-black text-foreground">
                                            {secondsToTimeString(elapsed)}
                                        </span>
                                    </p>
                                )}

                                {pace !== null && (
                                    <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                        <Activity className="w-5 h-5 mr-3 flex-shrink-0" />
                                        <span className="font-black text-foreground">
                                            {paceSecondsToFormatted(pace)}
                                        </span>
                                    </p>
                                )}

                            </div>
                        </div>
                    </Card>

                    {isLinked && training?.difficulty_level && (
                        <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-2">
                            <div className="px-5 py-4 space-y-2">
                                <h2 className="text-lg font-bold text-foreground tracking-wide">
                                    Dificuldade Registrada
                                </h2>
                                <p className="text-sm text-black leading-relaxed font-brand-tertiary">
                                    {{
                                        1: "Muito fácil",
                                        2: "Fácil",
                                        3: "Normal",
                                        4: "Difícil",
                                        5: "Muito difícil",
                                    }[training.difficulty_level] || training.difficulty_level}
                                </p>
                            </div>
                        </Card>
                    )}

                    {isLinked && training?.feedbacks && (
                        <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-2">
                            <div className="px-5 py-4 space-y-2">
                                <h2 className="text-lg font-bold text-foreground tracking-wide">
                                    Feedbacks para o Treinador
                                </h2>
                                <p className="text-sm text-black leading-relaxed font-brand-tertiary whitespace-pre-wrap">
                                    {training.feedbacks}
                                </p>
                            </div>
                        </Card>
                    )}

                    {!isLinked && (
                        <Button
                            className="w-full h-12 rounded-xl font-semibold uppercase tracking-wide"
                            onClick={handleLinkClick}
                        >
                            Vincular ao plano
                        </Button>
                    )}

                    {isLinked && (
                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                className="w-full h-12 rounded-xl font-semibold font-brand-primary tracking-wide"
                                variant="secondary"
                                onClick={() => setShowEditDialog(true)}
                                disabled={updateTraining.isPending}
                            >
                                MODIFICAR TREINO
                            </Button>
                            <Button
                                className="w-full h-12 rounded-xl font-semibold font-brand-primary tracking-wide"
                                variant="destructive"
                                onClick={handleUnlink}
                                disabled={unlinkStrava.isPending}
                            >
                                APAGAR TREINO
                            </Button>
                        </div>
                    )}
                </div>
            </DrawerContent>

            {isLinked && (
                <CompleteTrainingDialog
                    open={showEditDialog}
                    onOpenChange={setShowEditDialog}
                    training={{
                        distance: trainingDistance,
                        elapsed_time: trainingElapsed,
                    }}
                    onConfirm={handleConfirmEdit}
                    initialValues={{
                        distance: training?.actual_distance ?? activity.distance ?? undefined,
                        time: training?.actual_elapsed_time ?? activity.elapsed_time ?? activity.moving_time ?? undefined,
                        difficultyLevel: training?.difficulty_level ?? null,
                        feedbacks: training?.feedbacks ?? '',
                    }}
                />
            )}

            {!isLinked && (
                <LinkStravaTrainingDialog
                    open={showLinkDialog}
                    onOpenChange={setShowLinkDialog}
                    activityDate={activity.start_date ?? null}
                    stravaActivityId={activity.activity_id}
                    onLinked={() => onOpenChange(false)}
                />
            )}
        </Drawer>
    );
};

