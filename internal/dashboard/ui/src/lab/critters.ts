import '../app.css';
import { mount } from 'svelte';
import CritterLab from './CritterLab.svelte';

mount(CritterLab, { target: document.getElementById('lab')! });
