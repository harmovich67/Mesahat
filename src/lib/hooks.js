import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../store/languageStore';

/** Public catalog lookups — cached for minutes because they change rarely. */
export const useSpaceTypes = () =>
  useQuery({ queryKey: ['space-types'], queryFn: () => api.get('/space-types'), staleTime: 5 * 60_000 });
export const useLocations = () =>
  useQuery({ queryKey: ['locations'], queryFn: () => api.get('/locations'), staleTime: 5 * 60_000 });
export const usePublicSettings = () =>
  useQuery({ queryKey: ['public-settings'], queryFn: () => api.get('/settings/public'), staleTime: 5 * 60_000 });

/** Favourite spaces for the signed-in customer (empty set for visitors). */
export function useFavorites() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isStaff = useAuthStore((s) => s.isStaff);
  const ar = useLanguageStore((s) => s.lang) === 'ar';
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get('/favorites'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const ids = new Set(data?.space_ids || []);

  const toggle = useMutation({
    mutationFn: (spaceId) => api.post(`/favorites/${spaceId}`),
    onMutate: async (spaceId) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const prev = qc.getQueryData(['favorites']);
      const next = new Set(prev?.space_ids || []);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      qc.setQueryData(['favorites'], { space_ids: [...next] });
      return { prev };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(['favorites'], ctx?.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  return {
    has: (id) => ids.has(id),
    toggle: (id) => {
      if (!isAuthenticated) {
        toast.info(ar ? 'سجّل الدخول لحفظ المساحات المفضلة' : 'Sign in to save favourites');
        return;
      }
      if (isStaff) return;
      toggle.mutate(id);
    },
  };
}
