export type TrainingWithDate = {
  date?: string | null;
};

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isIsoDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isVisibleTrainingFromDate(
  training: TrainingWithDate,
  todayKey = getLocalDateKey()
) {
  const trainingDate = training.date || "";

  if (!isIsoDateKey(trainingDate)) return true;
  return trainingDate >= todayKey;
}

export function filterVisibleTrainingsFromDate<T extends TrainingWithDate>(
  trainings: T[],
  todayKey = getLocalDateKey()
) {
  return trainings.filter((training) =>
    isVisibleTrainingFromDate(training, todayKey)
  );
}
