function float(x) {
  return Number.parseFloat(x)
}

function range(start, count, arg3, arg4) {
  if (!arguments.length) console.log('range(start, count)')

  let filter, fn;
  if (arguments.length === 2) {
    filter = x => true
    fn = x => x
  } else if (arguments.length === 3) {
    fn = arg3;
    filter = x => true
  } else {
    filter = arg3;
    fn = arg4
  }

  const ar = Array.apply(0, Array(count))
      .map(function (element, index) {
        return index + start;
      });

  return ar.filter(filter).map(fn)
}

function uuid() {
  const S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

function waitUntil(condition) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval)
        resolve()
      }
    }, 100)
  })
}

function computeIfAbsent(map, key, fn) {
  if (!map[key]) {
    map[key] = fn()
  }
  return map[key]
}

function CircularCursor(arr) {
  this.items = arr
  this.currentIndex = -1
  // start at 0
  const next = (self) => {
    if (self.items.length === 0) {
      return null
    }
    self.currentIndex++
    if (self.currentIndex === self.items.length) {
      self.currentIndex = 0;
    }
    return self.items[self.currentIndex]
  }

  /**
   * Return {number} elements from left, and number elements from right, along with current element wherever the cursor is
   */
  this.triplet = () => {
    const i = this.next()
    const iPlusOne = this.next()
    const iMinusOne = this.previous(2)
    this.next()
    return [iMinusOne, i, iPlusOne]
  }

  this.next = (number) => {
    number = number || 1
    let val = null
    for (let i = 0; i < number; i++) {
      val = next(this)
    }
    return val
  }

  const previous = (self) => {
    if (self.items.length === 0) {
      return null
    }
    self.currentIndex--;
    if (self.currentIndex < 0) {
      self.currentIndex = self.items.length - 1;
    }
    return self.items[self.currentIndex]
  }

  this.previous = (number) => {
    number = number || 1
    let val = null
    for (let i = 0; i < number; i++) {
      val = previous(this)
    }
    return val
  }

  this.at = i => {
    this.currentIndex = i
    return this.items[this.currentIndex]
  }

  this.goTo = (elem) => {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i] === elem) {
        this.currentIndex = i;
        return i
      }
    }
    return -1
  }
}

const nthLast = (arr, x) => arr[arr.length - (x || 1)]

function randomFromArray(cc) {
  return cc[Math.floor(Math.random() * cc.length)]
}

const plus = x => target => target + x
const minus = x => target => target - x

const uniqueByJsonRepresentation = (x, i, a) => a.map(it => JSON.stringify(it)).indexOf(JSON.stringify(x)) === i

const permutate = (inputArr) => {
  const result = [];

  const permute = (arr, m = []) => {
    if (arr.length === 0) {
      result.push(m)
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next))
      }
    }
  }

  permute(inputArr)

  return result;
}


const equals = (x, y) => JSON.stringify(x) === JSON.stringify(y)

const log = console.log

function logJson() {
  const args = []
  for (let i = 0; i < arguments.length; i++) {
    args.push(arguments[i])
  }
  console.log.apply(null, args.map(it => JSON.stringify(it)), arguments.callee.caller && arguments.callee.caller.name)
}

function simpleClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

const intersection = function (a, b) {
  return [a, b].reduce((p, c) => p.filter(e => c.includes(e)));
}

const findDuplicates = arry => arry.filter((item, index) => arry.indexOf(item) !== index)

function cartesian(...args) {
  if (!args.length) return []
  const r = [], max = args.length - 1;

  function helper(arr, i) {
    for (let j = 0, l = args[i].length; j < l; j++) {
      const a = arr.slice(0); // clone arr
      a.push(args[i][j]);
      if (i === max)
        r.push(a);
      else
        helper(a, i + 1);
    }
  }

  try {
    helper([], 0);
  } catch (e) {
    log(args)
    throw e
  }

  return r;
}

const sortByLength = (a, b) => b.length - a.length

/**
 * parseRangeInput("4, 5, 1-5") => [1, 2, 3, 4, 5]
 * @param measures
 * @returns {number[]}
 */
const parseRangeInput = (measures) => {
  let ret = []
  measures = measures.split(",")
  measures = measures.map(it => {
    if (it.indexOf("-") >= 0) {
      const [i, j] = it.split("-")
      for (let k = parseInt(i.trim()); k <= parseInt(j.trim()); k++) {
        ret.push(k)
      }
    } else ret.push(it)
    return it
  })
  ret = ret.map(it => parseInt((it + "").trim()))
  return Array.from(new Set(ret)).sort((a, b) => a - b)
}

generatePairs = (arr) => {
  const v = []
  const num = arr.length
  for (let i = 0; i < num; i++) {
    for (let j = i; j < num; j++) {
      v.push([{index: i, item: arr[i]}, {index: j, item: arr[j]}])
    }
  }

  return v
}

const groupBy = function (xs, key, consumer) {
  let fn = key
  if (typeof key === 'string') {
    fn = it => it[key]
  }
  const out = xs.reduce(function (rv, x) {
    (rv[fn(x)] = rv[fn(x)] || []).push(x);
    return rv;
  }, {});
  if (consumer) {
    return Object.keys(out).map(k => {
      return consumer(k, out[k])
    })
  }
  return out
};

function toGraph(arr) {
  const graph = {}; // this will hold the node "IDs"
  for (let i = 0; i < arr.length; i++) {
    // "create node" if it's not added in the graph yet
    graph[arr[i][0]] = graph[arr[i][0]] || {};
    graph[arr[i][1]] = graph[arr[i][1]] || {};
    // add bidirectional "edges" to the "vertices"
    // Yes, we set the value to null, but what's important is to add the key.
    graph[arr[i][0]][arr[i][1]] = null;
    graph[arr[i][1]][arr[i][0]] = null;
  }
  return graph;
}

function putIntoBuckets(buckets, propertyFn, arr) {
  const res = new Map()
  arr.forEach(obj => {
    const category = Object.keys(buckets).find(c => propertyFn(obj) >= buckets[c][0] && propertyFn(obj) < buckets[c][1]);
    const items = res.get(category) || []
    items.push(obj)
    res.set(category, items)
  })
  return res
}

// to be called after getting the result from toGraph(arr)
function connectedComponents(graph) {
  const subGraphs = []; // array of connected vertices
  const visited = {};
  for (const i in graph) { // for every node...
    const subGraph = dfs(graph, i, visited); // ... we call dfs
    if (subGraph != null) // if vertex is not added yet in another graph
      subGraphs.push(subGraph);
  }
  return subGraphs;
}

// it will return an array of all connected nodes in a subgraph
function dfs(graph, node, visited) {
  if (visited[node]) return null; // node is already visited, get out of here.
  let subGraph = [];
  visited[node] = true;
  subGraph.push(node);
  for (const i in graph[node]) {
    const result = dfs(graph, i, visited);
    if (result == null) continue;
    subGraph = subGraph.concat(result);
  }
  return subGraph;
}

/**
 * Gives combinations
 * @param arr
 * @param k
 * @param prefix
 * @returns {*[][]|*}
 */
function choose(arr, k, prefix = []) {
  if (k === 0) return [prefix];
  return arr.flatMap((v, i) =>
      choose(arr.slice(i + 1), k - 1, [...prefix, v])
  );
}


function number(str) {
  if (typeof str === 'number') return str
  const [x, y] = str.split("/")
  if (y) {
    return parseInt(x) / parseInt(y)
  }
  return parseInt(x)
}

function sum(arr) {
  return arr.map(number).reduce((a, b) => a + b, 0)
}

const combsWithRep = (k, xs, canBeAdded = ((_comb, _allSoFar) => true)) => {
  const out = []

  function disp(x) {
    out.push(x.split(" "))
  }

  function pick(n, got, pos, from, show) {
    let cnt = 0;
    if (got.length === n) {
      if (show) disp(got.join(' '));
      return 1;
    }
    for (let i = pos; i < from.length; i++) {
      got.push(from[i]);

      cnt += pick(n, got, i, from, show);
      got.pop();
    }
    return cnt;
  }

  pick(k, [], 0, xs, true)
  return out
};

function until(condition, maxReps, run) {
  for (let i = 0; i < maxReps; i++) {
    run()
    if (condition()) {
      return true
    }
  }
  log("Condition not satisfied even after " + maxReps + " reps")
  return false
}

function nTimes(n, fn) {
  const res = []
  for (let i = 0; i < n; i++) {
    res.push(fn())
  }
  return res
}

function not(predicate) {
  return function () {
    return !predicate.apply(this, arguments);
  };
}

function assert(bool, error) {
  if (!bool) alert(error)
}

function randomGroupingPreservingOrder(arr, numGroups, min = 1) {
  // uncomment this line if you don't want the original array to be affected
  assert(numGroups * min <= arr.length, "")
  arr = arr.slice();
  const groups = range(numGroups).map(_ => [])
  const hasLessThanRequired = () => groups.some(g => g.length < min)

  //Fist group must contain min, and because of ordering requirement it will be first min items
  nTimes(min, () => arr.shift()).forEach(it => groups[0].push(it))

  //Assign each item to some group
  let lastGroupUsed = 0
  for (let i = min - 1; i < arr.length - min; i++) {
    let gotoGroup = randomFromArray([lastGroupUsed, lastGroupUsed + 1])
    const item = arr[i];
    // log("lastGroupUsed", lastGroupUsed, "gotoGroup", gotoGroup, "item", item)

    if (gotoGroup >= groups.length) {
      gotoGroup = groups.length - 1
      groups[groups.length - 1].push(item)
    } else {
      if (gotoGroup === lastGroupUsed) groups[gotoGroup].push(item)
      else groups[gotoGroup].unshift(item)
    }

    lastGroupUsed = gotoGroup
  }
  nTimes(min, () => arr.pop()).forEach(it => groups[groups.length - 1].push(it))

  const cursor = new CircularCursor(groups)

  //Shuffle
  // for (let i = 0; i < randomFromArray(range(10)); i++) {
  //   let [prev, current, next] = cursor.triplet()
  //   let howManyToMoveFromPrev = randomFromArray(range(prev.length))
  //   nTimes(howManyToMoveFromPrev, () => prev.pop()).forEach(it => current.unshift(it))
  // }

  // until(not(hasLessThanRequired), 200, () => {
  //   let [prev, current, next] = cursor.triplet()
  //   if(current.length < min) {
  //     if(min - prev.length > 0) {
  //       nTimes(min - prev.length, () => prev.pop()).forEach(it => current.unshift(it))
  //     }
  //   }
  // })
  return groups;
}

/**
 * For all combinations of all sizes
 * _.flatMap(collection, (v, i, a) => combinations(a, i + 1))
 * @param collection
 * @param n
 * @returns {[[]]|[]|*[]}
 */
function combinations(collection, n) {
  const array = _.values(collection);
  if (array.length < n) {
    return [];
  }
  const recur = ((array, n) => {
    if (--n < 0) {
      return [[]];
    }
    const combinations = [];
    array = array.slice();
    while (array.length - n) {
      const value = array.shift();
      recur(array, n).forEach((combination) => {
        combination.unshift(value);
        combinations.push(combination);
      });
    }
    return combinations;
  });
  return recur(array, n);
}

class LRUCache {
  constructor(capacity) {
    this.cache = new Map();
    this.capacity = capacity;
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const val = this.cache.get(key);

    this.cache.delete(key);
    this.cache.set(key, val);

    return val;
  }

  put(key, value) {
    this.cache.delete(key);

    if (this.cache.size === this.capacity) {
      this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, value);
    } else {
      this.cache.set(key, value);
    }
  }

  // Implement LRU/MRU retrieval methods
  getLeastRecent() {
    return Array.from(this.cache)[0];
  }

  getMostRecent() {
    return Array.from(this.cache)[this.cache.size - 1];
  }
}

function ArrayPlusDelay(array, consumer, delay) {
  let i = 0

  // seed first call and store interval (to clear later)
  var interval = setInterval(function () {
    // each loop, call passed in function
    consumer(array[i]);

    // increment, and if we're past array, clear interval
    if (i++ >= array.length - 1)
      clearInterval(interval);
  }, delay)

  return interval
}

/**
 * waitForKeyboardInput(" ")
 * @param key
 * @returns {Promise<unknown>}
 */
function waitForKeyboardInput(key) {
  const id = uuid()
  return new Promise(resolve => {
     $(document).on('keyup.ns' + id, (e) => {
       if (e.key === key) {
         $(document).off('keyup.ns' + id);
         resolve(id)
       }
     })
  })
}

/**
 * schedule(["simple data",
 *            () => { console.log("do this"); },
 *            () => { console.log("then do this"); return 0; },
 *            () => { console.log("this will be run immediately following the previous"); }
 *          ], 2, data => console.log("Consumed ", data))
 * @param data
 * @param timeInSeconds
 * @param taskRunner
 * @param onComplete
 * @param finishNowCondition
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function schedule(data, timeInSeconds, taskRunner, onComplete, finishNowCondition) {
  data = data.map(x => x); //clone
  const totalDataItems = data.length
  let fn = null;
  fn = (x, idx) => setTimeout(() => {
    // console.log("Processing item at index", idx, " at ", new Date());
    const first = data.splice(0, 1);

    if (finishNowCondition && finishNowCondition(first)) {
      //-1 => Finished because finishNowCondition satisfied
      console.log("Maybe finishing early on index, last consumed data item at index: " + (idx) + " out of total: " + (totalDataItems - 1))
      return
    }

    if (first.length) {
      const item = first[0]
      const task = typeof (item) == 'function' ? item : () => taskRunner(item, idx)
      const result = task()
      if (result instanceof Promise) {
        // Wait for promise to fulfill before consuming next item
        result.then(it => {
          fn && fn(100, idx + 1)
        })
      } else if (result !== false) {
        // If the item is just a number, we assume that you want to sleep for that amount of seconds
        let delay = timeInSeconds * 1000
        if (typeof (result) == 'number') delay = result * 1000
        fn && fn(delay, idx + 1)
      } else {
        console.log("Terminated because function at index: " + idx + " returned false!")
      }
    } else {
      if (onComplete) onComplete();
    }
  }, x);
  fn(0, 0);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const debugLog = (...arguments) => {
  if (window.DEBUG) {
    console.log(arguments)
  }
}

function closest(num, arr) {
  let mid;
  let lo = 0;
  let hi = arr.length - 1;
  while (hi - lo > 1) {
    mid = Math.floor((lo + hi) / 2);
    if (arr[mid] < num) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (num - arr[lo] <= arr[hi] - num) {
    return arr[lo];
  }
  return arr[hi];
}
