// Every animal the critters lab shows, in the order of its buttons; the
// first is shown when the page opens. Adding one is its own module beside
// these and a line here.
import { bee } from './bee';
import type { Critter } from './critter';
import { cupid } from './cupid';
import { fox } from './fox';
import { gull } from './gull';
import { hare } from './hare';
import { hedgehog } from './hedgehog';
import { rabbit } from './rabbit';
import { robin } from './robin';
import { spider } from './spider';

export const CRITTERS: readonly Critter[] = [hedgehog, fox, spider, robin, rabbit, cupid, hare, bee, gull];

export const critterNamed = (name: string | null): Critter | undefined => CRITTERS.find((c) => c.name === name);
