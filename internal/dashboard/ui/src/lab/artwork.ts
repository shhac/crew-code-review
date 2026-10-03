import '../app.css';
import { mount } from 'svelte';
import Artwork from './Artwork.svelte';

mount(Artwork, { target: document.getElementById('lab')! });
