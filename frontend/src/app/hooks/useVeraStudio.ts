import { useCallback, useEffect, useRef, useState } from 'react';
import { studioService } from '@vera/services';
import type { PhotoAsset, StageState, StudioAnalysis } from '@vera/types';

const STAGE_DURATION_MS = 900;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface StudioStageView {
  id: string;
  label: string;
  state: StageState;
}

/**
 * useVeraStudio — orchestrates the SIMULATED photo pipeline.
 * Stage definitions/analysis come from StudioService; this hook drives the timing/UI state.
 */
export function useVeraStudio() {
  const stageDefs = useRef(studioService.getStages()).current;
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [stageStates, setStageStates] = useState<Record<string, StageState>>({});
  const [processing, setProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<StudioAnalysis | null>(null);
  const runId = useRef(0);
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current = photos.length;
  }, [photos]);

  const runProcessing = useCallback(async () => {
    const myRun = ++runId.current;
    setProcessing(true);
    setAnalysis(null);
    setPhotos((prev) => prev.map((p) => ({ ...p, status: 'processing', isCover: false })));
    setStageStates(Object.fromEntries(stageDefs.map((s) => [s.id, 'pending'])));

    for (const stage of stageDefs) {
      if (runId.current !== myRun) return;
      setStageStates((prev) => ({ ...prev, [stage.id]: 'running' }));
      await delay(STAGE_DURATION_MS);
      if (runId.current !== myRun) return;
      setStageStates((prev) => ({ ...prev, [stage.id]: 'done' }));
    }

    const result = studioService.analyze(countRef.current);
    setPhotos((prev) =>
      prev.map((p, i) => ({ ...p, status: 'ready', isCover: i === result.suggestedCoverIndex })),
    );
    setAnalysis(result);
    setProcessing(false);
  }, [stageDefs]);

  const addFiles = useCallback(
    (files: File[]) => {
      const incoming: PhotoAsset[] = files
        .filter((f) => f.type.startsWith('image/'))
        .map((f, i) => ({
          id: `${Date.now()}-${i}-${f.name}`,
          name: f.name,
          url: URL.createObjectURL(f),
          status: 'uploading',
          isCover: false,
        }));
      if (!incoming.length) return;
      setPhotos((prev) => [...prev, ...incoming]);
      void runProcessing();
    },
    [runProcessing],
  );

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const stages: StudioStageView[] = stageDefs.map((s) => ({
    ...s,
    state: stageStates[s.id] ?? 'pending',
  }));

  return {
    photos,
    addFiles,
    removePhoto,
    stages,
    processing,
    detectedRooms: analysis?.detectedRooms ?? [],
    duplicatesRemoved: analysis?.duplicatesRemoved ?? 0,
  };
}
