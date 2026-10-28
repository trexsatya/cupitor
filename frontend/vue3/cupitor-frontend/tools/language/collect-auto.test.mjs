import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAutoState, chooseAutoBatch, updateAutoState, autoProgress, validPositive} from './collect-auto-plan.js';

test('batch selects actionable outstanding words and preserves current order', () => {
  const state = parseAutoState(null);
  const pending = [{line:'x',count:0},{line:'y',count:1},{line:'z',count:2}];
  assert.deepEqual(chooseAutoBatch(pending,state,{batchSize:2,maxNoYield:2}).map(x=>x.line),['x','y']);
  updateAutoState(state,[{word:'x',before:0,count:0,remaining:5},{word:'y',before:1,count:4,remaining:1}],{maxNoYield:2});
  assert.equal(state.attempts.x.noYieldStreak,1);
  assert.equal(state.attempts.y.noYieldStreak,0);
  updateAutoState(state,[{word:'x',before:0,count:0,remaining:5}],{maxNoYield:2});
  assert.equal(state.attempts.x.skipped,true);
  assert.deepEqual(chooseAutoBatch(pending,state,{batchSize:10,maxNoYield:2}).map(x=>x.line),['y','z']);
  assert.deepEqual(autoProgress(pending,state,2),{outstanding:3,skipped:1,actionable:2,skippedWords:['x']});
});

test('transient API and global budget problems never count as zero-yield attempts', () => {
  const state = parseAutoState(null);
  updateAutoState(state,[{word:'word',count:0,remaining:5,budgetExhausted:true}],{maxNoYield:2});
  updateAutoState(state,[{word:'word',count:0,remaining:5,error:'429'}],{maxNoYield:2});
  assert.equal(state.attempts.word.noYieldStreak,0);
  updateAutoState(state,[{word:'word',before:0,count:2,remaining:3}],{maxNoYield:2});
  assert.equal(state.attempts.word.noYieldStreak,0);
});

test('state validation rejects corruption rather than restarting and wasting credits', () => {
  assert.deepEqual(parseAutoState(null).totals,{batches:0,spentCredits:0,savedCaptures:0});
  assert.throws(()=>parseAutoState({version:2}),/Invalid/);
  assert.throws(()=>validPositive(-1,'credits'),/positive/);
  assert.equal(validPositive(0,'credits',true),0);
});
