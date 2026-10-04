import { mount } from 'svelte';
import RobinRig from './RobinRig.svelte';

const target = document.getElementById('lab');
if (target) mount(RobinRig, { target });
