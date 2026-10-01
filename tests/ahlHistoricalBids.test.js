import { jest } from '@jest/globals';

import {
  NA_HISTORICAL_BID_STATS,
  getHistoricalBidStats,
  loadAhlHistoricalBids,
} from '../ahlHistoricalBids.js';

const SAMPLE_BUNDLE = {
  version: 1,
  years: [2024, 2025],
  players: {
    'd strome': {
      name: 'D Strome',
      avgCost: 57.75,
      minCost: 55,
      maxCost: 60.5,
      yearsDrafted: [2024, 2025],
    },
  },
};

describe('ahlHistoricalBids', () => {
  describe('getHistoricalBidStats', () => {
    test('matches a player by direct normalized key', () => {
      expect(getHistoricalBidStats(SAMPLE_BUNDLE, 'D Strome')).toEqual({
        avgCost: 57.75,
        minCost: 55,
        maxCost: 60.5,
        yearsDrafted: [2024, 2025],
      });
    });

    test('matches a player via the first-initial-last-name alias', () => {
      expect(getHistoricalBidStats(SAMPLE_BUNDLE, 'Dylan Strome')).toEqual({
        avgCost: 57.75,
        minCost: 55,
        maxCost: 60.5,
        yearsDrafted: [2024, 2025],
      });
    });

    test('falls back to NA when the player has no historical entry', () => {
      expect(getHistoricalBidStats(SAMPLE_BUNDLE, 'Totally Unknown Player')).toEqual(NA_HISTORICAL_BID_STATS);
    });

    test('falls back to NA when no bundle is available', () => {
      expect(getHistoricalBidStats(null, 'Dylan Strome')).toEqual(NA_HISTORICAL_BID_STATS);
    });

    test('falls back to NA when no player name is given', () => {
      expect(getHistoricalBidStats(SAMPLE_BUNDLE, '')).toEqual(NA_HISTORICAL_BID_STATS);
    });
  });

  describe('loadAhlHistoricalBids', () => {
    test('fetches once and caches the bundle on the shared cache object', async () => {
      const fetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_BUNDLE,
      });
      const cache = {};

      const first = await loadAhlHistoricalBids(cache, fetchImpl);
      const second = await loadAhlHistoricalBids(cache, fetchImpl);

      expect(first).toEqual(SAMPLE_BUNDLE);
      expect(second).toEqual(SAMPLE_BUNDLE);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(cache.historicalBids).toEqual(SAMPLE_BUNDLE);
      expect(cache.historicalBidsRequest).toBeUndefined();
    });

    test('shares the in-flight request when called concurrently', async () => {
      let resolveFetch;
      const fetchImpl = jest.fn().mockReturnValue(new Promise((resolve) => {
        resolveFetch = resolve;
      }));
      const cache = {};

      const firstPromise = loadAhlHistoricalBids(cache, fetchImpl);
      const secondPromise = loadAhlHistoricalBids(cache, fetchImpl);
      resolveFetch({ ok: true, json: async () => SAMPLE_BUNDLE });

      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      expect(first).toEqual(SAMPLE_BUNDLE);
      expect(second).toEqual(SAMPLE_BUNDLE);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    test('clears the in-flight request and rejects on fetch failure', async () => {
      const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
      const cache = {};

      await expect(loadAhlHistoricalBids(cache, fetchImpl)).rejects.toThrow();
      expect(cache.historicalBidsRequest).toBeUndefined();
      expect(cache.historicalBids).toBeUndefined();
    });
  });
});
