export type Routine = {
  id: string;
  name: string;
  position: number;
  created_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_name: string;
  position: number;
  note: string;
  default_sets: number;
};

export type Workout = {
  id: string;
  routine_id: string | null;
  routine_name: string;
  started_at: string;
  finished_at: string | null;
  bodyweight: number | null;
};

export type WorkoutExercise = {
  id: string;
  workout_id: string;
  routine_exercise_id: string | null;
  exercise_name: string;
  position: number;
};

export type SetRow = {
  id: string;
  workout_exercise_id: string;
  set_index: number;
  weight: number | null;
  reps: number | null;
  completed_at: string | null;
};

export type Settings = {
  rest_seconds: number;
  rest_enabled: boolean;
  rest_sound_enabled: boolean;
  bar_weight: number;
};

export type HistorySession = {
  workout_id: string;
  started_at: string;
  sets: { set_index: number; weight: number; reps: number }[];
};

export type PR = { weight: number; reps: number };
