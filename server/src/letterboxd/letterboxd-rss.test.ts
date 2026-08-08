import { describe, expect, it } from 'vitest';

import { parseLetterboxdRss } from './letterboxd-rss';

describe('parseLetterboxdRss', () => {
  it('parses basic feed items and deduplicates title+year keys', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:letterboxd="https://letterboxd.com">
        <channel>
          <item>
            <title>The Matrix, 1999</title>
            <letterboxd:filmTitle>The Matrix</letterboxd:filmTitle>
            <letterboxd:filmYear>1999</letterboxd:filmYear>
            <pubDate>Mon, 01 Jan 2024 01:00:00 GMT</pubDate>
            <description>Watched with 4.5 stars and a heart</description>
          </item>
          <item>
            <title>The Matrix, 1999</title>
            <letterboxd:filmTitle>The Matrix</letterboxd:filmTitle>
            <letterboxd:filmYear>1999</letterboxd:filmYear>
            <pubDate>Tue, 02 Jan 2024 01:00:00 GMT</pubDate>
            <description>Rewatch with 5 stars</description>
          </item>
        </channel>
      </rss>`;

    const parsed = parseLetterboxdRss(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].normalizedTitle).toBe('the matrix');
    expect(parsed[0].releaseYear).toBe(1999);
    expect(parsed[0].ratingTenths).toBe(10);
    expect(parsed[0].isRewatch).toBe(true);
  });

  it('handles malformed or minimal items without throwing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Unknown Film</title>
            <description>No known metadata</description>
          </item>
          <item>
            <title>   </title>
            <description>Empty title should be ignored</description>
          </item>
        </channel>
      </rss>`;

    const parsed = parseLetterboxdRss(xml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].normalizedTitle).toBe('unknown film');
    expect(parsed[0].releaseYear).toBeNull();
  });
});
