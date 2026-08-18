import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { actorService } from '@/services';
import { useAppSelector } from '@/store';
import MovieCard from '@/components/movie/MovieCard';
import { PageSpinner, PageError } from '@/components/common/PageState';
import './ActorDetailPage.css';

export default function ActorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  const { data: actor, isLoading, isError, refetch } = useQuery({
    queryKey: ['actor', id],
    queryFn: () => actorService.getById(id!),
    enabled: !!id,
    retry: 1
  });

  const likeMutation = useMutation({
    mutationFn: () => actorService.toggleLike(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actor', id] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    }
  });

  if (isLoading) return <PageSpinner label={t('common.loading')} />;
  if (isError || !actor) return <PageError message={t('errors.actorDetailFailed')} onRetry={() => refetch()} />;

  return (
    <div className="container actor-page">
      <div className="actor-page__header">
        <img src={actor.photoUrl} alt={actor.fullName} className="actor-page__photo" />
        <div className="actor-page__header-info">
          <h1>{actor.fullName}</h1>
          {actor.birthDate && (
            <p className="text-muted">
              {t('actor.born')}: {new Date(actor.birthDate).toLocaleDateString()}
            </p>
          )}
          <p className="text-secondary actor-page__bio">{actor.biography || 'Biyografi bilgisi mevcut değil.'}</p>

          {isAuthenticated && (
            <button
              className={`btn-secondary actor-page__like-btn ${actor.isLikedByCurrentUser ? 'active' : ''}`}
              onClick={() => likeMutation.mutate()}
            >
              <Heart size={16} fill={actor.isLikedByCurrentUser ? '#4a90e2' : 'none'} />
              {actor.isLikedByCurrentUser ? t('actor.liked') : t('actor.like')}
              {actor.likeCount > 0 && <span className="actor-page__like-count">{actor.likeCount}</span>}
            </button>
          )}
        </div>
      </div>

      <h2 className="actor-page__section-title">{t('actor.filmography')}</h2>
      <div className="movie-grid">
        {actor.filmography.map((m) => <MovieCard key={m.id} movie={m} />)}
      </div>
    </div>
  );
}
