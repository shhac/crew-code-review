// The spiders' behaviour, kept free of the DOM so it can be stepped in tests.
// model holds the shapes and the tuning; routes finds the ways about a page;
// behaviour decides what each spider does next; pose says where to draw it;
// world steps them all together with the draglines they leave.
export { away, LINE_FADE, LINE_LIFE, MAX_LINES } from './model';
export type { Choice, Context, Dir, Floor, Floors, Frame, Line, Outcome, Pose, Rand, Spider, Tie } from './model';
export { tiePoint } from './routes';
export { step, weighted } from './behaviour';
export { pose } from './pose';
export { advance, type World } from './world';
