import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCatalogExerciseDetailViewModel } from '../viewmodels/exercise-catalog';
import { CatalogExerciseImages } from './catalog-exercise-images';
import { CatalogExerciseFacts } from './catalog-exercise-facts';
import { Button, Copy, Screen } from './ui';

export function CatalogExerciseDetailScreen() {
  const { catalogId } = useLocalSearchParams<{ catalogId: string }>();
  const router = useRouter();
  const item = useCatalogExerciseDetailViewModel(catalogId);
  if (!item) return (
    <Screen>
      <Copy>Open the catalog to view this exercise</Copy>
      <Button label="Open catalog" onPress={() => router.replace('/templates/catalog')} />
    </Screen>
  );
  const { exercise } = item;
  const images = exercise.images;
  return (
    <Screen>
      <Copy kind="title">{exercise.name}</Copy>
      <CatalogExerciseImages key={exercise.catalogId} images={images} name={exercise.name} />
      <CatalogExerciseFacts item={item} />
      {exercise.instructions?.length ? <>
        <Copy kind="heading">Instructions</Copy>
        {exercise.instructions.map((step, index) => <Copy key={index}>{index + 1}. {step}</Copy>)}
      </> : null}
    </Screen>
  );
}
