// What each seasonal set draws: its art on the rail's shelf and its layer
// over the page, either one optional. A set's parts are named in its own
// scene.ts, so a new month shows under ?theme= without touching the page.
import type { Component } from 'svelte';
import aurora from './aurora/scene';
import bluebells from './bluebells/scene';
import bonfire from './bonfire/scene';
import christmas from './christmas/scene';
import easter from './easter/scene';
import fete from './fete/scene';
import halloween from './halloween/scene';
import hares from './hares/scene';
import harvest from './harvest/scene';
import seaside from './seaside/scene';
import type { ThemeName } from './theme';
import valentine from './valentine/scene';
import wimbledon from './wimbledon/scene';

export type Scene = { Shelf?: Component; Layer?: Component };

export const scenes = {
  none: {},
  halloween,
  bonfire,
  christmas,
  aurora,
  valentine,
  hares,
  easter,
  bluebells,
  fete,
  wimbledon,
  seaside,
  harvest,
} satisfies Record<ThemeName, Scene>;

export const sceneOf = (name: ThemeName): Scene => scenes[name];
