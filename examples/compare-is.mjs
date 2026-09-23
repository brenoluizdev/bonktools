import { decodeInitialState, encodeInitialState, PhysicsSimulator } from '../dist/index.js';

const REAL_CAPTURED = 'jWcWiGhaqGDGCGkWeygybsaBaXGEIWuqefJIafaDWgKaTajLcxXaWemb1aeWhSoOaNcgfPOaBLGc2ajwWzjxDNd5jXanqbEwCGibIbUROlZZ8touXqsARhBplAVmwIAMhF36pMuQqWqNljLbiDlhcagDUUCBIEIS01AAM1ACKABIxcfEcAGYI5IRZ5PhIKYhYAOZphEEADhAF+ACa4toAzkikDfg4hNoALGEAHhzDcNraGPFQhN3admEA7Hxcyy0ArqsI1NOEaL0cZZCEMBi0hBQpWADiAyAApmwqAJ64WGDAZS5VGADWZ4UclxUUSSSFOInIAGF2EkId1JIk2NoAC5QDqwnbVLYAFWgKWkDTY8XRkjU1Ae3zCpAAkpduipviwABqlPAQ97RQiMhDzABsLEoTicfCWaHwh0ZMHm6wAlrLHjyeXBvocYCBThQIbdGQ1tvCycioOC0CxaBgECxLJgCZI7HUGrSev0UFjJK7hsB8EjtrMFksVutNttdvsVSc-vgAUCkEkcRC2Ejqg1aEiAMr6763LKVFBweK4HFHNAIYgAXhLQA';

console.log('=== IS real (capturado do client oficial, solo, id=1) ===');
console.log(JSON.stringify(decodeInitialState(REAL_CAPTURED), null, 2));

const sim = new PhysicsSimulator();
await sim.start();

// Mesma config que live-bot-room.mjs usa de verdade: bot é sempre id=0 (host), humano id=1.
const players = [];
players[0] = { id: 0, team: 3 };
players[1] = { id: 1, team: 2 };
const generated = await sim.reset(players);
console.log('\n=== IS gerado por nós (mesma config do live-bot-room.mjs: id=0 bot/blue, id=1 humano/red) ===');
console.log(JSON.stringify(generated, null, 2));
sim.close();

console.log('\n=== round-trip: encodeInitialState -> decodeInitialState ===');
const blob = encodeInitialState(generated);
console.log('blob length:', blob.length);
const roundTripped = decodeInitialState(blob);
console.log(JSON.stringify(roundTripped, null, 2));

console.log('\n=== round-trip idêntico ao original? ===');
console.log(JSON.stringify(generated) === JSON.stringify(roundTripped));
