import { useState } from "react";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { MapPin, Clock, Activity, Trash2, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { metersToKm, paceSecondsToFormatted, secondsToTimeString, cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { trainingConfig, trainingTypeColors } from "@/types/training";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";

export interface ManualTrainingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    training: {
        id: string;
        date: string;
        type: string;
        distance?: number | null;
        elapsed_time?: number | null;
        pace?: number | null;
        actual_distance?: number | null;
        actual_elapsed_time?: number | null;
        actual_pace?: number | null;
        difficulty_level?: number | null;
        feedbacks?: string | null;
    };
    onEdit?: (trainingId: string) => void;
    onDelete?: (trainingId: string) => void;
}

export const ManualTrainingDialog = ({
    open,
    onOpenChange,
    training,
    onEdit,
    onDelete,
}: ManualTrainingDialogProps) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { user } = useAuth();

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen && user?.id) {
            track("activity_closed_manual_training_card", user.id, {
                metadata: { trainingId: training.id, type: training.type },
            }).catch((error) => console.warn("Failed to track activity_closed_manual_training_card", error));
        }
        onOpenChange(isOpen);
    };

    const distance = training.actual_distance ?? training.distance ?? 0;
    const elapsedTime = training.actual_elapsed_time ?? training.elapsed_time ?? 0;
    const pace = training.actual_pace ?? training.pace ?? null;
    const displayTitle = trainingConfig[training.type as keyof typeof trainingConfig]?.label || "Corrida manual";
    const color = trainingTypeColors[training.type as keyof typeof trainingTypeColors] || '#f97316';

    return (
        <>
            <Drawer open={open} onOpenChange={handleOpenChange}>
                <DrawerContent className="max-h-[85vh] px-4 pb-6">
                    <DrawerHeader className="text-left">
                        <div className="flex items-center justify-between gap-2">
                            <DrawerTitle className="text-2xl font-bold tracking-wide">
                                {displayTitle}
                            </DrawerTitle>
                            <Badge
                                variant="secondary"
                                style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#e2e8f0' }}
                            >
                                Manual
                            </Badge>
                        </div>
                    </DrawerHeader>

                    <div className="overflow-y-auto px-4 pb-4 space-y-4">
                        <Card className="relative overflow-hidden border-none shadow-sm rounded-[20px]">
                            <div
                                className="absolute left-0 top-0 bottom-0 w-2"
                                style={{ backgroundColor: color }}
                            />
                            <div className="pl-6 pr-4 py-4">
                                <div className="flex flex-col gap-2 text-sm font-brand-tertiary">
                                    {distance !== null && distance !== undefined && (
                                        <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                            <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
                                            <span className="font-black text-foreground">
                                                {metersToKm(distance).toFixed(1).replace(".", ",")} km
                                            </span>
                                        </p>
                                    )}

                                    <p className="text-muted-foreground flex items-center whitespace-nowrap">
                                        <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
                                        <span className="font-black text-foreground">
                                            {secondsToTimeString(elapsedTime)}
                                        </span>
                                    </p>

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

                        {training.difficulty_level && (
                            <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-4">
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

                        {training.feedbacks && (
                            <Card className="relative overflow-visible border-none shadow-sm rounded-[20px] mb-4">
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

                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                className="w-full h-12 rounded-xl font-semibold font-brand-primary tracking-wide"
                                variant="secondary"
                                onClick={() => onEdit?.(training.id)}
                                style={{ backgroundColor: color, borderColor: color, color: '#0f172a' }}
                            >
                                MODIFICAR TREINO
                            </Button>
                            <Button
                                className="w-full h-12 rounded-xl font-semibold font-brand-primary tracking-wide"
                                variant="destructive"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                APAGAR TREINO
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deseja apagar este treino manual?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onDelete?.(training.id)}
                            className={cn(buttonVariants({ variant: "destructive" }))}
                        >
                            APAGAR TREINO
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

