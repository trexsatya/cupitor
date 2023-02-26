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
  console.log.apply(null, args.map(it => JSON.stringify(it)))
}

function simpleClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

let intersection = function(a, b) {
  return [a, b].reduce((p,c) => p.filter(e => c.includes(e)));
}

