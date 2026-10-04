import '../app.css';
import { mount } from 'svelte';
import RobinTiming from './RobinTiming.svelte';

mount(RobinTiming, { target: document.getElementById('lab')! });
