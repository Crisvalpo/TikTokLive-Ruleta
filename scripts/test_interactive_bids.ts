import { parseBidAmount } from '../src/commands/parser';
import { InteractiveEngine } from '../src/interactive/engine';
import { InternalGameEvent } from '../src/types';

console.log('🧪 RUNNING INTERACTIVE BID ENGINE, TIE-BREAKER & APPROVAL TEST...\n');

// 1. Probar Parser de Pujas
const testCases = [
  { input: '500', expected: 500 },
  { input: '$700', expected: 700 },
  { input: '1.200', expected: 1200 },
  { input: '$ 1.500', expected: 1500 },
  { input: 'yo doy 2000 pesitos', expected: 2000 },
  { input: 'me gusta la camisa', expected: null },
  { input: 'opcion A', expected: null }
];

console.log('--- 1. PARSER TEST ---');
let parserSuccess = true;
testCases.forEach(({ input, expected }) => {
  const result = parseBidAmount(input);
  const ok = result === expected;
  console.log(`Input: "${input}" => Parsed: ${result} (Expected: ${expected}) ${ok ? '✅' : '❌'}`);
  if (!ok) parserSuccess = false;
});

// 2. Probar Interactive Engine & Tie Breaker
console.log('\n--- 2. INTERACTIVE ENGINE TIE-BREAKER TEST ---');
const engine = new InteractiveEngine();

// Iniciar ronda 1 (Polera Nike negra, inicio $500)
engine.startRound(0);

function createTestEvent(username: string, msg: string): InternalGameEvent {
  const bidNum = parseBidAmount(msg);
  return {
    id: `evt_${Date.now()}_${Math.random()}`,
    type: 'CHAT_MESSAGE',
    source: 'simulator',
    userId: `id_${username}`,
    username,
    rawMessage: msg,
    numericValue: bidNum || undefined,
    timestamp: new Date().toISOString()
  };
}

// Simulando pujas empatadas
console.log('\nSimulando puja @juan 1200...');
engine.processEvent(createTestEvent('juan', '1200'));

console.log('Simulando puja empatada @maria 1200...');
engine.processEvent(createTestEvent('maria', '1200'));

let session = engine.getSession();
console.log(`Líderes empatados: ${session.tiedPlayers.map(p => '@' + p.username).join(', ')}`);

console.log('\nFinalizando ronda de 45s con 2 finalistas empatados...');
engine.finishRound();
session = engine.getSession();
console.log(`Estado post-ronda: ${session.state} (Cajas creadas: ${session.mysteryBoxes.length})`);

if (session.state !== 'TIE_BREAKER') {
  console.error('❌ ERROR: El estado debería ser TIE_BREAKER');
  process.exit(1);
}

// Encontrar cuál caja es la ganadora
const winningBoxObj = session.mysteryBoxes.find(b => b.isWinner);
const winningBoxNum = winningBoxObj ? winningBoxObj.boxNumber : 1;
const wrongBoxNum = [1, 2, 3, 4].find(n => n !== winningBoxNum) || 1;

console.log(`\nSimulando apertura de Caja Vacía #${wrongBoxNum} por @juan...`);
engine.processEvent(createTestEvent('juan', `${wrongBoxNum}`));
session = engine.getSession();

console.log(`Simulando apertura de Caja GANADORA #${winningBoxNum} por @maria...`);
engine.processEvent(createTestEvent('maria', `caja ${winningBoxNum}`));
session = engine.getSession();

console.log(`Ganador final desempate: @${session.winner?.username} con $${session.winner?.amount} (Caja #${session.winner?.winningBoxNumber})`);

// 3. Probar Control de Espectadores Aprobados
console.log('\n--- 3. APPROVED BIDDERS TEST ---');
engine.startRound(1); // Ronda 2: Polera Adidas roja ($700)

console.log('\nSimulando puja de usuario NO APROBADO @pedro 1500...');
const blocked = !engine.processEvent(createTestEvent('pedro', '1500'));
session = engine.getSession();
console.log(`Puja bloqueada correctamente: ${blocked ? '✅' : '❌'}`);
console.log(`Solicitudes pendientes: ${session.pendingApprovals.map(p => '@' + p.username + ' ($' + p.attemptedBid + ')').join(', ')}`);
console.log(`Líder actual: @${session.currentLeader?.username || 'ninguno'}`);

console.log('\nAprobando a @pedro desde el panel...');
engine.approveBidder('pedro');
session = engine.getSession();
console.log(`Líder tras aprobar a @pedro: @${session.currentLeader?.username} - $${session.currentLeader?.amount} ${session.currentLeader?.username === 'pedro' ? '✅' : '❌'}`);

if (parserSuccess && session.currentLeader?.username === 'pedro' && session.currentLeader?.amount === 1500) {
  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE CAJAS Y APROBACIONES PASARON CON ÉXITO! ✅');
} else {
  console.error('\n❌ ERROR EN PRUEBAS DE APROBACIÓN');
  process.exit(1);
}
