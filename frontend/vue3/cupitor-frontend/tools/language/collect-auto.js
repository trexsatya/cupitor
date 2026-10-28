#!/usr/bin/env node
// Automatically collect F1 Swedish SRT gaps with a bounded credit budget.
// Successful batches are committed and pushed before proceeding to the next.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { parseAutoState, chooseAutoBatch, updateAutoState, autoProgress, validPositive } from './collect-auto-plan.js';

const flags = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--') || i + 1 >= process.argv.length) throw new Error('Expected --name value');
  flags[process.argv[i].slice(2)] = process.argv[++i];
}
const dataDir = resolve(flags.dataDir || '');
const srtsDir = join(dataDir, 'srts');
const statePath = join(dataDir, 'srt-collection', 'f1-state.json');
const outDir = resolve(flags.outDir || './out/f1-auto');
const wordsFile = resolve(flags.wordsFile || 'tools/language/word-lists/f1.txt');
const gitDir = resolve(flags.gitDir || '.');
const branch = flags.branch;
const budget = validPositive(flags.budget ?? 100, 'budget');
const batchSize = validPositive(flags.batchSize ?? 20, 'batchSize');
const maxWords = validPositive(flags.maxWords ?? 200, 'maxWords');
const maxNoYield = validPositive(flags.maxNoYield ?? 2, 'maxNoYield');
const threshold = validPositive(flags.threshold ?? 5, 'threshold');
const dryRun = flags.dryRun === 'true';
if (!dryRun) {
  if (!process.env.FILMOT_API_KEY) throw new Error('FILMOT_API_KEY must be supplied through a secure environment secret');
  if (!branch || !/^ai\/f1-srt-threshold5-auto-[0-9]+$/.test(branch)) {
    throw new Error('Refusing to push outside an F1 auto review branch');
  }
  const current = execFileSync('git', ['-C',gitDir,'branch','--show-current'], {encoding:'utf8'}).trim();
  if (current !== branch) throw new Error('Unexpected Git branch: ' + current);
}
mkdirSync(outDir, {recursive:true});
const log = (...args) => console.log(...args);
const json = (file, fallback) => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
function atomicJson(file, data) {
  mkdirSync(dirname(file), {recursive:true});
  const temp = file + '.tmp-' + process.pid;
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  renameSync(temp, file);
}
function nodeCollect(args) {
  const result = spawnSync(process.execPath, ['tools/language/lang-manage.js','collect',...args], {
    encoding:'utf8', cwd:process.cwd(), env:process.env, maxBuffer:16*1024*1024,
  });
  if (result.error) throw result.error;
  return { status:result.status, stdout:result.stdout||'', stderr:result.stderr||'' };
}
function coverage() {
  const run = nodeCollect(['--wordsFile',wordsFile,'--threshold',String(threshold),
    '--chunk','0','--dry-run','--dataDir',dataDir,'--srtsDir',srtsDir,'--outDir',outDir]);
  if (run.status !== 0) throw new Error('Coverage scan failed: ' + run.stderr.slice(-900));
  const plan = json(join(outDir,'collect-plan.json'),null);
  if (!plan || !Array.isArray(plan.selected)) throw new Error('Missing complete coverage plan');
  return plan.selected;
}
function persist(state) {
  atomicJson(statePath, state);
  execFileSync('git',['-C',gitDir,'add','--','db/language/swedish/srts','db/language/swedish/srt-collection/f1-state.json']);
  const check = spawnSync('git',['-C',gitDir,'diff','--cached','--quiet']);
  if (check.status === 0) return;
  if (check.status !== 1) throw new Error('Failed to check staged SRT changes');
  execFileSync('git',['-C',gitDir,'-c','user.name=github-actions[bot]',
    '-c','user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit','-m','Collect F1 Swedish subtitle contexts (resumable batch)']);
  execFileSync('git',['-C',gitDir,'push','origin','HEAD:refs/heads/'+branch]);
}
function summary(status, state, pending, spent, tried) {
  const progress = autoProgress(pending, state, maxNoYield);
  const result = {status, threshold, batchSize, runBudget:budget,
    creditsSpentThisRun:spent, wordsTriedThisRun:tried,
    totalBatches:state.totals.batches, totalCaptured:state.totals.savedCaptures,
    ...progress};
  atomicJson(join(outDir,'auto-summary.json'),result);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## F1 automatic collection\n\n' +
      '| Metric | Value |\n|---|---:|\n' +
      '| Stop reason | '+status+' |\n' +
      '| Credits spent this run | '+spent+' / '+budget+' |\n' +
      '| Words attempted | '+tried+' |\n' +
      '| Outstanding words | '+progress.outstanding+' |\n' +
      '| Skipped after repeated no-yield searches | '+progress.skipped+' |\n' +
      '| Actionable words remaining | '+progress.actionable+' |\n' +
      '| Captures saved in automatic runs | '+state.totals.savedCaptures+' |\n\n');
  }
  log(JSON.stringify(result,null,2));
}
const state = parseAutoState(json(statePath,null));
let spent = 0, tried = 0, status = dryRun ? 'audit-only' : 'all-covered', pending = coverage();
log('Starting F1 auto collector: '+pending.length+' under-covered words; '+budget+' credit budget.');
while (!dryRun) {
  const batch = chooseAutoBatch(pending, state, {batchSize:Math.min(batchSize,maxWords-tried),maxNoYield});
  if (!pending.length) {status='all-covered';break;}
  if (!batch.length) {status=tried >= maxWords ? 'word-cap' : 'no-actionable-words';break;}
  if (spent >= budget - 2) {status='credit-budget';break;}
  if (tried >= maxWords) {status='word-cap';break;}
  const batchFile = join(outDir,'batch-words.txt');
  writeFileSync(batchFile,batch.map(w=>w.line).join('\n')+'\n');
  const run = nodeCollect(['--wordsFile',batchFile,'--threshold',String(threshold),
    '--chunk','0','--api','--no-translate','--apiCredits','15',
    '--apiBudget',String(budget-spent),'--dataDir',dataDir,'--srtsDir',srtsDir,
    '--outDir',outDir]);
  const results = json(join(outDir,'collect-results.json'),[]);
  const metrics = json(join(outDir,'collect-metrics.json'),null);
  if (!metrics || !Number.isFinite(metrics.apiCreditsUsed) ||
      metrics.apiCreditsUsed < 0 || metrics.apiCreditsUsed > budget-spent) {
    throw new Error('Missing or invalid credit accounting: stopping without another batch');
  }
  spent += metrics.apiCreditsUsed;
  tried += batch.length;
  updateAutoState(state,results,{maxNoYield});
  state.totals.batches++;
  state.totals.spentCredits += metrics.apiCreditsUsed;
  state.totals.savedCaptures += results.reduce((n,r)=>n+(r.added||0),0);
  state.lastRun = {status:run.status, words:batch.map(w=>w.line),credits:metrics.apiCreditsUsed};
  if (!dryRun) persist(state);
  log('Batch committed: '+results.length+'/'+batch.length+' responses; '+metrics.apiCreditsUsed+
    ' credits; '+spent+'/'+budget+' this run; '+state.totals.savedCaptures+' automatic captures to date.');
  if (run.status !== 0) {
    log('Collector stopped with an API error: '+run.stderr.slice(-700));
    status='api-error';
    break;
  }
  if (results.some(r=>r.budgetExhausted)) {status='credit-budget';break;}
  if (!results.length) {status='no-progress';break;}
  pending = coverage();
}
summary(status,state,pending,spent,tried);
if (status==='api-error') process.exitCode=1;
