import { describe, expect, it } from 'vitest';
import type { Ledge } from '../floors';
import { emberColour, emberSpots, fanEmbers, heat, reconcileEmbers } from './embers';

const card: Ledge = { left: 100, right: 800, y: 300, base: 500, room: 40, headroom: Infinity, kind: 'card' };

describe('embers', () => {
  it('lands the same embers on the same ledge every time, inside its ends', () => {
    const spots = emberSpots(4, card);
    expect(spots.length).toBeGreaterThan(0);
    expect(emberSpots(4, card)).toEqual(spots);
    expect(emberSpots(4, { ...card, left: 0, right: 700, y: 120 })).toEqual(spots);
    for (const e of spots) expect(e.x).toBeGreaterThanOrEqual(14), expect(e.x).toBeLessThanOrEqual(700 - 14);
  });

  it('leaves heading rules and tight ledges bare', () => {
    expect(emberSpots(4, { ...card, kind: 'heading' })).toEqual([]);
    expect(emberSpots(4, { ...card, room: 6 })).toEqual([]);
  });

  it('smoulders between ash and glow on its own, and flares when fanned', () => {
    const [e] = emberSpots(4, card);
    const levels = Array.from({ length: 60 }, (_, i) => heat(e, i * 1000));
    expect(Math.min(...levels)).toBeLessThan(0.2);
    expect(Math.max(...levels)).toBeGreaterThan(0.7);
    const floors = new Map([[4, card]]);
    const embers = reconcileEmbers(floors);
    const target = embers.get(4)![0];
    const x = card.left + target.x;
    const fanned = fanEmbers(embers, floors, { from: { x: x - 20, y: card.y - 2 }, to: { x: x + 20, y: card.y - 2 }, at: 5000 }).get(4)![0];
    expect(heat(fanned, 5000)).toBe(1);
    expect(heat(fanned, 20000)).toBeCloseTo(heat(target, 20000), 2);
  });

  it('lets a weaker second pass add to, never cool, the first one\'s flare', () => {
    const floors = new Map([[4, card]]);
    const embers = reconcileEmbers(floors);
    const x = card.left + embers.get(4)![0].x;
    const strong = fanEmbers(embers, floors, { from: { x: x - 20, y: card.y - 2 }, to: { x: x + 20, y: card.y - 2 }, at: 1000 });
    const weak = fanEmbers(strong, floors, { from: { x: x - 20, y: card.y - 24 }, to: { x: x + 20, y: card.y - 24 }, at: 1500 });
    const [once, twice] = [strong.get(4)![0], weak.get(4)![0]];
    expect(twice.fanned).toBeCloseTo(2 ** (-500 / 1400), 5);
    expect(heat(twice, 1600)).toBeCloseTo(heat(once, 1600), 5);
    const partial = fanEmbers(embers, floors, { from: { x: x - 20, y: card.y - 24 }, to: { x: x + 20, y: card.y - 24 }, at: 1000 }).get(4)![0];
    expect(partial.fanned).toBeGreaterThan(0);
    expect(partial.fanned).toBeLessThan(1);
  });

  it('keeps an ember\'s fanning through a re-measure that leaves it in place', () => {
    const floors = new Map([[4, card]]);
    const fanned = new Map([[4, reconcileEmbers(floors).get(4)!.map((e) => ({ ...e, fanned: 1, at: 10 }))]]);
    expect(reconcileEmbers(new Map([[4, { ...card, y: 250 }]]), fanned).get(4)![0].fanned).toBe(1);
  });

  it('colours ash grey through orange to hot yellow', () => {
    expect(emberColour(0)).toBe('rgb(112, 106, 100)');
    expect(emberColour(0.5)).toBe('rgb(236, 96, 38)');
    expect(emberColour(1)).toBe('rgb(255, 214, 120)');
  });
});
