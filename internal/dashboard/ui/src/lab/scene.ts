import '../app.css';
import { mount } from 'svelte';
import SpiderScene from './SpiderScene.svelte';

mount(SpiderScene, { target: document.getElementById('lab')! });
