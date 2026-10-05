import { mount } from 'svelte';
import RobinParts from './RobinParts.svelte';

const target = document.getElementById('lab');
if (target) mount(RobinParts, { target });
