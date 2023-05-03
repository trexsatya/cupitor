function CircularCursor(arr) {
  this.items = arr
  this.currentIndex = -1
  // start at 0
  let next = (self) => {
    if(self.items.length === 0) {
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
      let i = this.next()
      let iPlusOne = this.next()
      let iMinusOne = this.previous(2)
      this.next()
      return [iMinusOne, i, iPlusOne]
  }

  this.next = (number) => {
    number = number || 1
    let val = null
    for(let i = 0; i < number; i++) {
      val = next(this)
    }
    return val
  }

  let previous = (self) => {
    if(self.items.length === 0) {
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
    for(let i = 0; i < number; i++) {
      val = previous(this)
    }
    return val
  }

  this.at = i => {
    this.currentIndex = i
    return this.items[this.currentIndex]
  }

  this.goTo = (elem) => {
    for(let i = 0; i < this.items.length; i++) {
      if(this.items[i] === elem) {
        this.currentIndex = i;
        return i
      }
    }
    return -1
  }
}

let nthLast = (arr, x) => arr[arr.length - (x || 1)]

function randomFromArray(cc) {
  return cc[Math.floor(Math.random() * cc.length)]
}

let plus = x => target => target + x
let minus = x => target => target - x

let uniqueByJsonRepresentation = (x, i, a) => a.map(it => JSON.stringify(it)).indexOf(JSON.stringify(x)) === i

const permutate = (inputArr) => {
  let result = [];

  const permute = (arr, m = []) => {
    if (arr.length === 0) {
      result.push(m)
    } else {
      for (let i = 0; i < arr.length; i++) {
        let curr = arr.slice();
        let next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next))
      }
    }
  }

  permute(inputArr)

  return result;
}


let equals = (x, y) => JSON.stringify(x) === JSON.stringify(y)

let log = console.log
function logJson(){
  let args = []
  for(let i=0; i < arguments.length; i++) {
    args.push(arguments[i])
  }
  console.log.apply(null, args.map(it => JSON.stringify(it)), arguments.callee.caller && arguments.callee.caller.name)
}

function simpleClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

let intersection = function(a, b) {
  return [a, b].reduce((p,c) => p.filter(e => c.includes(e)));
}

const findDuplicates = arry => arry.filter((item, index) => arry.indexOf(item) !== index)

function cartesian(...args) {
  if(!args.length) return []
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

  try{
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
let parseRangeInput = (measures)=> {
  let ret = []
  measures = measures.split(",")
  measures = measures.map(it => {
    if(it.indexOf("-") >= 0) {
      let [i,j] = it.split("-")
      for (let k = parseInt(i.trim()); k <= parseInt(j.trim()); k++) {
        ret.push(k)
      }
    } else ret.push(it)
    return it
  })
  ret = ret.map(it => parseInt((it+"").trim()))
  return Array.from(new Set(ret)).sort((a, b) => a-b)
}

generatePairs = (arr) => {
  let v = []
  const num = arr.length
  for (let i=0; i < num; i++) {
    for (let j=i; j < num; j++) {
      v.push([{index: i, item: arr[i]}, {index:j, item: arr[j]}])
    }
  }

  return v
}

let groupBy = function(xs, key, consumer) {
  let fn = key
  if(typeof key === 'string') {
    fn = it => it[key]
  }
  let out = xs.reduce(function(rv, x) {
    (rv[fn(x)] = rv[fn(x)] || []).push(x);
    return rv;
  }, {});
  if(consumer) {
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
  let res = new Map()
  arr.forEach(obj => {
    const category = Object.keys(buckets).find(c => propertyFn(obj) >= buckets[c][0] && propertyFn(obj) < buckets[c][1]);
    let items = res.get(category) || []
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
function choose(arr, k, prefix=[]) {
  if (k === 0) return [prefix];
  return arr.flatMap((v, i) =>
    choose(arr.slice(i+1), k-1, [...prefix, v])
  );
}


function number(str) {
  if(typeof str === 'number') return str
  let [x,y] = str.split("/")
  if(y) {
    return parseInt(x) / parseInt(y)
  }
  return parseInt(x)
}

function sum(arr) {
  return arr.map(number).reduce((a, b) => a+b, 0)
}

let combsWithRep = (k, xs, canBeAdded = ((_comb, _allSoFar) => true)) => {
  let out = []

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
    if(condition()) {
      return true
    }
  }
  log("Condition not satisfied even after " + maxReps + " reps")
  return false
}

function nTimes(n, fn) {
  let res = []
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
  if(!bool) throw new Error(error)
}

function randomGroupingPreservingOrder(arr, numGroups, min=1) {
  // uncomment this line if you don't want the original array to be affected
  assert(numGroups * min <= arr.length, "")
  arr = arr.slice();
  let groups = range(numGroups).map(_ => [])
  let hasLessThanRequired = () => groups.some(g => g.length < min)

  //Fist group must contain min, and because of ordering requirement it will be first min items
  nTimes(min, () => arr.shift()).forEach(it => groups[0].push(it))

  //Assign each item to some group
  let lastGroupUsed = 0
  for (let i = min-1; i < arr.length - min; i++) {
    let gotoGroup = randomFromArray([lastGroupUsed, lastGroupUsed + 1])
    let item = arr[i];
    // log("lastGroupUsed", lastGroupUsed, "gotoGroup", gotoGroup, "item", item)

    if(gotoGroup >= groups.length) {
      gotoGroup = groups.length-1
      groups[groups.length-1].push(item)
    } else {
      if(gotoGroup === lastGroupUsed) groups[gotoGroup].push(item)
      else groups[gotoGroup].unshift(item)
    }

    lastGroupUsed = gotoGroup
  }
  nTimes(min, () => arr.pop()).forEach(it => groups[groups.length-1].push(it))

  let cursor = new CircularCursor(groups)

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
  let array = _.values(collection);
  if (array.length < n) {
    return [];
  }
  let recur = ((array, n) => {
    if (--n < 0) {
      return [[]];
    }
    let combinations = [];
    array = array.slice();
    while (array.length - n) {
      let value = array.shift();
      recur(array, n).forEach((combination) => {
        combination.unshift(value);
        combinations.push(combination);
      });
    }
    return combinations;
  });
  return recur(array, n);
}
