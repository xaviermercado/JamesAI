import type {
    MovieRecommendation,
    ParsedMovieCriteria,
    RecommendationRequest,
    RecommendationResponse,
} from '@/types/recommendations';

const defaultCatalog: MovieRecommendation[] = [
  {
    tmdbMovieId: 10494,
    title: 'Perfect Blue',
    posterUrl: 'https://image.tmdb.org/t/p/w500/3m7Krt5B30eR6ysCIm7h6WfC6vF.jpg',
    releaseYear: 1997,
    runtimeMinutes: 81,
    tmdbRating: 8.2,
    genres: ['Thriller', 'Animation', 'Drama'],
    providers: ['Netflix', 'Prime Video'],
    country: 'Japan',
    mediaType: 'movie',
    explanation: 'An intense, stylish pick that matches a moody, cerebral date-night mood.',
  },
  {
    tmdbMovieId: 19995,
    title: 'Before Sunset',
    posterUrl: 'https://image.tmdb.org/t/p/w500/gNJj2BrxR2a4QnygW3I4CTWSc2s.jpg',
    releaseYear: 2004,
    runtimeMinutes: 80,
    tmdbRating: 7.9,
    genres: ['Romance', 'Drama'],
    providers: ['Apple TV+', 'Prime Video'],
    country: 'United States',
    mediaType: 'movie',
    explanation: 'Warm, witty, and compact enough for an easy evening watch.',
  },
  {
    tmdbMovieId: 537996,
    title: 'The Nice Guys',
    posterUrl: 'https://image.tmdb.org/t/p/w500/8bXWtnA88t9Jh8g2A3wiYj2vYns.jpg',
    releaseYear: 2016,
    runtimeMinutes: 116,
    tmdbRating: 7.4,
    genres: ['Comedy', 'Crime'],
    providers: ['Max', 'Prime Video'],
    country: 'United States',
    mediaType: 'movie',
    explanation: 'Funny without feeling lazy, with enough sharp dialogue for a great date-night laugh.',
  },
  {
    tmdbMovieId: 1396,
    title: 'Breaking Bad',
    posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    releaseYear: 2008,
    runtimeMinutes: 47,
    tmdbRating: 9.5,
    genres: ['Drama', 'Crime', 'Thriller'],
    providers: ['Netflix', 'AMC+'],
    country: 'United States',
    mediaType: 'tv',
    explanation: 'A gripping option if you want a premium, bingeable dramatic series.',
  },
  {
    tmdbMovieId: 1399,
    title: 'Game of Thrones',
    posterUrl: 'https://image.tmdb.org/t/p/w500/1XS1oqL89oe0h7M2V0M3h4V4eK5.jpg',
    releaseYear: 2011,
    runtimeMinutes: 60,
    tmdbRating: 8.4,
    genres: ['Fantasy', 'Drama', 'Adventure'],
    providers: ['Max', 'Prime Video'],
    country: 'United States',
    mediaType: 'tv',
    explanation: 'Epic scale and rich world-building for a weekend-long watch session.',
  },
  {
    tmdbMovieId: 348,
    title: 'Alien',
    posterUrl: 'https://image.tmdb.org/t/p/w500/vfrQk5IPloGg1v9Rzbh2eA2t1cA.jpg',
    releaseYear: 1979,
    runtimeMinutes: 117,
    tmdbRating: 8.1,
    genres: ['Horror', 'Science Fiction'],
    providers: ['Prime Video', 'Paramount+'],
    country: 'United States',
    mediaType: 'movie',
    explanation: 'A tense classic with a fierce, lean pacing that still feels modern.',
  },
  {
    tmdbMovieId: 13,
    title: 'Forrest Gump',
    posterUrl: 'https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
    releaseYear: 1994,
    runtimeMinutes: 142,
    tmdbRating: 8.8,
    genres: ['Drama', 'Romance'],
    providers: ['Disney+', 'Prime Video'],
    country: 'United States',
    mediaType: 'movie',
    explanation: 'An uplifting crowd-pleaser with heartfelt energy and a strong nostalgic feel.',
  },
  {
    tmdbMovieId: 120,
    title: 'The Lord of the Rings: The Fellowship of the Ring',
    posterUrl: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQyKJl2i9cO3rJgQ6g.jpg',
    releaseYear: 2001,
    runtimeMinutes: 178,
    tmdbRating: 8.8,
    genres: ['Adventure', 'Fantasy'],
    providers: ['Max', 'Prime Video'],
    country: 'New Zealand',
    mediaType: 'movie',
    explanation: 'A rich, transportive adventure when you want something cinematic and immersive.',
  },
];

function parseCriteria(request: RecommendationRequest): ParsedMovieCriteria {
  const description = request.description.toLowerCase();
  const includesComedy = description.includes('funny') || description.includes('comedy');
  const includesRomance = description.includes('date') || description.includes('romance');
  const includes90s = description.includes('90s') || description.includes('nineties');
  const includesShort = description.includes('short') || description.includes('under two hours');

  return {
    mediaType: request.mediaType,
    mood: includesComedy ? 'playful' : includesRomance ? 'romantic' : 'curious',
    includeGenres: includesComedy ? ['Comedy'] : includesRomance ? ['Romance'] : undefined,
    maxRuntime: request.maxRuntime ?? (includesShort ? 120 : undefined),
    country: request.country,
    streamingServices: request.streamingServices,
    minYear: includes90s ? 1990 : undefined,
    maxYear: includes90s ? 1999 : undefined,
  };
}

export function getMockRecommendations(
  request: RecommendationRequest,
  page = 0,
): RecommendationResponse {
  const criteria = parseCriteria(request);
  const filtered = defaultCatalog.filter((candidate) => {
    if (criteria.mediaType && candidate.mediaType !== criteria.mediaType) {
      return false;
    }

    if (criteria.maxRuntime && candidate.runtimeMinutes > criteria.maxRuntime) {
      return false;
    }

    if (criteria.country && candidate.country.toLowerCase() !== criteria.country.toLowerCase()) {
      return false;
    }

    if (criteria.streamingServices?.length) {
      const matches = criteria.streamingServices.some((service) =>
        candidate.providers.some((provider) => provider.toLowerCase() === service.toLowerCase()),
      );

      if (!matches) {
        return false;
      }
    }

    if (criteria.includeGenres?.length) {
      const hasGenre = criteria.includeGenres.some((genre) =>
        candidate.genres.some((candidateGenre) => candidateGenre.toLowerCase() === genre.toLowerCase()),
      );

      if (!hasGenre) {
        return false;
      }
    }

    if (criteria.minYear && candidate.releaseYear < criteria.minYear) {
      return false;
    }

    if (criteria.maxYear && candidate.releaseYear > criteria.maxYear) {
      return false;
    }

    return true;
  });

  const baseList = filtered.length ? filtered : defaultCatalog;
  const start = page * 5;
  const recommendations = baseList.slice(start, start + 5).map((candidate) => ({
    ...candidate,
    explanation: candidate.explanation,
  }));

  return {
    recommendations,
    source: 'mock',
    preferencesApplied: false,
  };
}
