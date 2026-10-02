import '../app.css';
import { mount } from 'svelte';
import SpiderLab from './SpiderLab.svelte';

mount(SpiderLab, { target: document.getElementById('lab')! });
