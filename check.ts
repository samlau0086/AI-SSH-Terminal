import { readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('./dist/index.html', 'utf-8');
// But wait, React renders dynamically. We can't just query the HTML.
