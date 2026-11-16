const muscleGroups: Readonly<Record<string, string>> = {
  pectoralis_major: 'Chest',
  latissimus_dorsi: 'Upper back',
  rhomboids: 'Upper back',
  trapezius: 'Upper back',
  infraspinatus_teres_minor: 'Upper back',
  erector_spinae: 'Lower back',
  quadratus_lumborum: 'Lower back',
  anterior_deltoid: 'Shoulders',
  lateral_deltoid: 'Shoulders',
  posterior_deltoid: 'Shoulders',
  biceps_brachii: 'Biceps',
  brachialis: 'Biceps',
  triceps_brachii: 'Triceps',
  brachioradialis: 'Forearms',
  forearm_extensors: 'Forearms',
  forearm_flexors: 'Forearms',
  rectus_abdominis: 'Abs',
  transverse_abdominis: 'Abs',
  obliques: 'Abs',
  gluteus_maximus: 'Glutes',
  gluteus_medius: 'Glutes',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Inner thighs',
  abductors: 'Outer hips',
  hip_flexors: 'Hip flexors',
  gastrocnemius: 'Calves',
  soleus: 'Calves',
  tibialis_anterior: 'Shins',
};

const secondaryMuscleGroups: Readonly<Record<string, string>> = {
  ...muscleGroups,
  forearms: 'Forearms',
  serratus_anterior: 'Chest',
  supraspinatus: 'Shoulders',
};

export function groupMuscles(muscles: readonly string[], target: 'primary' | 'secondary'): readonly string[] {
  const mapping = target === 'primary' ? muscleGroups : secondaryMuscleGroups;
  const groups = new Set<string>();
  for (const muscle of muscles) {
    if (Object.hasOwn(mapping, muscle)) {
      groups.add(mapping[muscle]);
    }
  }
  return [...groups];
}
