import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useAuthSession } from '@/components/auth-session-provider';
import { clearMyWatchlist, clearMyWatched, getMyWatchlist, getMyWatched, updateMyLibraryAction } from '@/services/library-api';
import type { LibraryListItem } from '@/types/library';

const PAGE_SIZE = 10;

function mediaLabel(type: 'movie' | 'tv'): string {
  return type === 'tv' ? 'TV' : 'Movie';
}

export default function LibraryScreen() {
  const { csrfToken } = useAuthSession();
  const [watchlist, setWatchlist] = useState<LibraryListItem[]>([]);
  const [watched, setWatched] = useState<LibraryListItem[]>([]);
  const [watchlistTotal, setWatchlistTotal] = useState(0);
  const [watchedTotal, setWatchedTotal] = useState(0);
  const [watchlistPage, setWatchlistPage] = useState(1);
  const [watchedPage, setWatchedPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        if (!active) return;
        const [watchlistResult, watchedResult] = await Promise.all([
          getMyWatchlist({ page: watchlistPage, pageSize: PAGE_SIZE }),
          getMyWatched({ page: watchedPage, pageSize: PAGE_SIZE }),
        ]);
        if (!active) return;
        setWatchlist(watchlistResult.items);
        setWatched(watchedResult.items);
        setWatchlistTotal(watchlistResult.total);
        setWatchedTotal(watchedResult.total);
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : 'Unable to load your library right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [watchlistPage, watchedPage, refreshToken]);

  const runAction = async (
    action: 'remove' | 'mark_watched' | 'mark_unwatched',
    item: LibraryListItem,
  ) => {
    if (!csrfToken) return;
    const key = `${item.mediaType}:${item.tmdbId}:${action}`;
    setBusyKey(key);
    setError(null);
    try {
      await updateMyLibraryAction(
        {
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          action,
        },
        csrfToken,
      );
      setLoading(true);
      setRefreshToken((current) => current + 1);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update this title right now.');
    } finally {
      setBusyKey(null);
    }
  };

  const confirmClear = (target: 'watchlist' | 'watched') => {
    if (!csrfToken) return;

    Alert.alert(
      target === 'watchlist' ? 'Clear watchlist?' : 'Clear watched history?',
      target === 'watchlist'
        ? 'This removes all watchlist items from your private library.'
        : 'This removes your watched history from your private library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setBusyKey(`clear:${target}`);
            void (target === 'watchlist' ? clearMyWatchlist(csrfToken) : clearMyWatched(csrfToken))
              .then(() => {
                if (target === 'watchlist') {
                  setWatchlistPage(1);
                } else {
                  setWatchedPage(1);
                }
                setLoading(true);
                setRefreshToken((current) => current + 1);
              })
              .catch((nextError) => {
                setError(nextError instanceof Error ? nextError.message : 'Unable to clear library items right now.');
              })
              .finally(() => setBusyKey(null));
          },
        },
      ],
    );
  };

  const renderList = (items: LibraryListItem[], kind: 'watchlist' | 'watched') => {
    if (items.length === 0) {
      return <ThemedText themeColor="textSecondary">No titles yet.</ThemedText>;
    }

    return (
      <View style={styles.listStack}>
        {items.map((item) => {
          const key = `${item.mediaType}:${item.tmdbId}`;
          return (
            <ThemedView key={key} type="backgroundElement" style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <ThemedText type="smallBold">{item.metadata.title}</ThemedText>
                <ThemedText themeColor="textSecondary">{mediaLabel(item.mediaType)} • TMDB {item.tmdbId}</ThemedText>
              </View>

              <View style={styles.chipRow}>
                <View style={styles.chip}><ThemedText style={styles.chipText}>{item.status}</ThemedText></View>
                {item.metadata.releaseYear ? <View style={styles.chip}><ThemedText style={styles.chipText}>{item.metadata.releaseYear}</ThemedText></View> : null}
              </View>

              <View style={styles.itemActions}>
                {kind === 'watchlist' ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void runAction('mark_watched', item)}
                    disabled={busyKey === `${key}:mark_watched`}
                  >
                    <ThemedText style={styles.secondaryButtonText}>Mark watched</ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void runAction('mark_unwatched', item)}
                    disabled={busyKey === `${key}:mark_unwatched`}
                  >
                    <ThemedText style={styles.secondaryButtonText}>Move to watchlist</ThemedText>
                  </Pressable>
                )}

                <Pressable
                  style={styles.removeButton}
                  onPress={() => void runAction('remove', item)}
                  disabled={busyKey === `${key}:remove`}
                >
                  <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          );
        })}
      </View>
    );
  };

  const watchlistPageCount = Math.max(1, Math.ceil(watchlistTotal / PAGE_SIZE));
  const watchedPageCount = Math.max(1, Math.ceil(watchedTotal / PAGE_SIZE));

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.pageHeader}>
            <ThemedText type="subtitle">Personal library</ThemedText>
            <ThemedText themeColor="textSecondary">
              Save titles privately, track watched status, and help Scouty avoid repeats unless you ask to rewatch.
            </ThemedText>
          </View>

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          {loading ? <ThemedText themeColor="textSecondary">Loading your library...</ThemedText> : null}

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold">Watchlist ({watchlistTotal})</ThemedText>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => confirmClear('watchlist')}
                disabled={busyKey === 'clear:watchlist'}
              >
                <ThemedText style={styles.secondaryButtonText}>Clear watchlist</ThemedText>
              </Pressable>
            </View>
            <View style={styles.paginationRow}>
              <Pressable
                style={styles.secondaryButton}
                disabled={watchlistPage <= 1 || loading}
                onPress={() => {
                  setLoading(true);
                  setWatchlistPage((page) => Math.max(1, page - 1));
                }}
              >
                <ThemedText style={styles.secondaryButtonText}>Previous</ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary">Page {watchlistPage} of {watchlistPageCount}</ThemedText>
              <Pressable
                style={styles.secondaryButton}
                disabled={watchlistPage >= watchlistPageCount || loading}
                onPress={() => {
                  setLoading(true);
                  setWatchlistPage((page) => Math.min(watchlistPageCount, page + 1));
                }}
              >
                <ThemedText style={styles.secondaryButtonText}>Next</ThemedText>
              </Pressable>
            </View>
            {renderList(watchlist, 'watchlist')}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold">Watched ({watchedTotal})</ThemedText>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => confirmClear('watched')}
                disabled={busyKey === 'clear:watched'}
              >
                <ThemedText style={styles.secondaryButtonText}>Clear watched</ThemedText>
              </Pressable>
            </View>
            <View style={styles.paginationRow}>
              <Pressable
                style={styles.secondaryButton}
                disabled={watchedPage <= 1 || loading}
                onPress={() => {
                  setLoading(true);
                  setWatchedPage((page) => Math.max(1, page - 1));
                }}
              >
                <ThemedText style={styles.secondaryButtonText}>Previous</ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary">Page {watchedPage} of {watchedPageCount}</ThemedText>
              <Pressable
                style={styles.secondaryButton}
                disabled={watchedPage >= watchedPageCount || loading}
                onPress={() => {
                  setLoading(true);
                  setWatchedPage((page) => Math.min(watchedPageCount, page + 1));
                }}
              >
                <ThemedText style={styles.secondaryButtonText}>Next</ThemedText>
              </Pressable>
            </View>
            {renderList(watched, 'watched')}
          </ThemedView>

          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  pageHeader: { gap: Spacing.one },
  sectionCard: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  listStack: { gap: Spacing.two },
  itemCard: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  itemHeader: { gap: Spacing.half },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    backgroundColor: '#eef3ff',
  },
  chipText: { fontSize: 12, color: BrandColors.midnight800 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: '#eef3ff',
  },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  removeButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: '#fee2e2',
  },
  removeButtonText: { color: '#b42318', fontWeight: '700' },
  errorText: { color: '#b42318' },
});
