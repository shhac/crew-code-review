// Every animal the critters lab shows, in the order of its buttons; the
// first is shown when the page opens. Adding one is its own module beside
// these and a line here.
import { bee } from './bee';
import type { Critter } from './critter';
import { crow } from './crow';
import { cupid } from './cupid';
import { fox } from './fox';
import { gull } from './gull';
import { hare } from './hare';
import { hawk } from './hawk';
import { hedgehog } from './hedgehog';
import { pigeon } from './pigeon';
import { rabbit } from './rabbit';
import { robin } from './robin';
import { spider } from './spider';
import { wasp } from './wasp';

export const CRITTERS: readonly Critter[] = [hedgehog, fox, spider, robin, rabbit, cupid, hare, bee, gull, wasp, crow, pigeon, hawk];

export const critterNamed = (name: string | null): Critter | undefined => CRITTERS.find((c) => c.name === name);
