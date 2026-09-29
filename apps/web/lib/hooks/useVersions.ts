import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ShotVersion {
  id: string;
  shot_id: string;
  version_number: number;
  name: string;
  status: string;
  branch_name: string;
  parent_version_id: string | null;
  merge_parent_id: string | null;
  is_accepted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useShotVersions(shotId: string) {
  return useQuery({
    queryKey: ['shot-versions', shotId],
    queryFn: () => apiClient<ShotVersion[]>(`/api/v1/shots/${shotId}/versions`),
    enabled: Boolean(shotId)
  });
}

export function useCreateShotVersion(shotId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name = '', branchName = 'main' }: { name?: string; branchName?: string } = {}) =>
      apiClient<ShotVersion>(`/api/v1/shots/${shotId}/versions`, {
        method: 'POST',
        json: {
          name,
          branch_name: branchName
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shot-versions', shotId] });
    }
  });
}

export function useCreateShotBranch(shotId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      branchName,
      parentVersionId,
      name = ''
    }: {
      branchName: string;
      parentVersionId?: string | null;
      name?: string;
    }) =>
      apiClient<ShotVersion>(`/api/v1/shots/${shotId}/branches`, {
        method: 'POST',
        json: {
          branch_name: branchName,
          parent_version_id: parentVersionId || null,
          name
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shot-versions', shotId] });
    }
  });
}

export function useAcceptShotVersion(shotId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) =>
      apiClient<ShotVersion>(`/api/v1/versions/${versionId}/accept`, {
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shot-versions', shotId] });
    }
  });
}

export function useRestoreShotVersion(productionId: string, shotId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ versionId, revision }: { versionId: string; revision: number }) =>
      apiClient<{
        changed: boolean;
        shot_id: string;
        revision: number;
        restored_version_id: string;
        backup_version_id: string | null;
      }>(`/api/v1/versions/${versionId}/restore`, {
        method: 'POST',
        json: { revision }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
      queryClient.invalidateQueries({ queryKey: ['production', productionId] });
      queryClient.invalidateQueries({ queryKey: ['shot-versions', shotId] });
    }
  });
}

export function useMergeShotVersion(productionId: string, shotId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      versionId,
      revision,
      branchName = 'main'
    }: {
      versionId: string;
      revision: number;
      branchName?: string;
    }) =>
      apiClient<{
        changed: boolean;
        shot_id: string;
        revision: number;
        merged_version_id: string;
        backup_version_id: string | null;
      }>(`/api/v1/versions/${versionId}/merge`, {
        method: 'POST',
        json: {
          revision,
          branch_name: branchName
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
      queryClient.invalidateQueries({ queryKey: ['production', productionId] });
      queryClient.invalidateQueries({ queryKey: ['shot-versions', shotId] });
    }
  });
}
