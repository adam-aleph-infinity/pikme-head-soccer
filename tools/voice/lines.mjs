// The narration's lines as JSON, for make-voice.py: node tools/voice/lines.mjs > lines.json
import { LINES } from '../../shared/tutorial.js';
console.log(JSON.stringify(LINES));
