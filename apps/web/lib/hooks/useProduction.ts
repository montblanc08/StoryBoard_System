import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Production, Shot } from '@frameforge/types';

export function useProduction(productionId: string) {
  return useQuery({
    queryKey: ['production', productionId],
    queryFn: async () => {
      if (!productionId) return null;
      return apiClient<Production>(`/api/v1/productions/${productionId}`);
    },
    enabled: Boolean(productionId)
  });
}

export function useShots(productionId: string) {
  return useQuery({
    queryKey: ['shots', productionId],
    queryFn: async () => {
      if (!productionId) return [];
      const data = await apiClient<Shot[]>(`/api/v1/productions/${productionId}/shots`);
      return data || [];
    },
    enabled: Boolean(productionId)
  });
}

export function useUpdateShot(productionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      revision,
      changes
    }: {
      id: string;
      revision: number;
      changes: Partial<Shot>;
    }) => {
      return apiClient<Shot>(`/api/v1/shots/${id}`, {
        method: 'PATCH',
        json: {
          revision,
          changes
        }
      });
    },
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: ['shots', productionId] });
      const previousShots = queryClient.getQueryData<Shot[]>(['shots', productionId]);

      if (previousShots) {
        queryClient.setQueryData<Shot[]>(['shots', productionId], old => {
          if (!old) return [];
          return old.map(s => (s.id === id ? { ...s, ...changes, revision: s.revision + 1 } : s));
        });
      }

      return { previousShots };
    },
    onError: (err, _vars, context) => {
      if (context?.previousShots) {
        queryClient.setQueryData(['shots', productionId], context.previousShots);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
      queryClient.invalidateQueries({ queryKey: ['production', productionId] });
    }
  });
}

export function useCreateShot(productionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newShot: Partial<Shot>) => {
      return apiClient<Shot>(`/api/v1/productions/${productionId}/shots`, {
        method: 'POST',
        json: newShot
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
      queryClient.invalidateQueries({ queryKey: ['production', productionId] });
    }
  });
}

export function useDeleteShot(productionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shotId: string) => {
      return apiClient(`/api/v1/shots/${shotId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
      queryClient.invalidateQueries({ queryKey: ['production', productionId] });
    }
  });
}

export function useBulkUpdateShots(productionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shotIds,
      updates
    }: {
      shotIds: string[];
      updates: Record<string, unknown>;
    }) => {
      return apiClient(`/api/v1/shots/bulk-update`, {
        method: 'POST',
        json: {
          shot_ids: shotIds,
          updates
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
    }
  });
}

export function useReorderShots(productionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; sort_index: number }[]) => {
      return apiClient(`/api/v1/shots/reorder`, {
        method: 'POST',
        json: { items }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shots', productionId] });
    }
  });
}
