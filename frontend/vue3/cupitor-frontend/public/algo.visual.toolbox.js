window.globalFabricObjId = 0;

function combined(){
  return Object.assign(...arguments)
}

function recordScript(str) {
  if(window.recordScriptFn) {
    window.recordScriptFn(str);
  }
}

function findById(id, canvas) {
  if (!canvas) canvas = pc
  const fabricObj = canvas._objects.find(it => it.uid + '' === id + '' || it.customData?.uid + '' === id + '');
  if(!fabricObj) {
    let obj = $(`*[data-uid='${id}']`)
    if(!obj.length) obj = $(`#${id}`)
    return obj
  }
  return fabricObj;
}

function isFabricObject(obj) {
  return obj instanceof fabric.Object;
}

function findIfRequired(idOrObj) {
  if(typeof idOrObj !== 'object') {
    return  findById(idOrObj);
  }
  const obj = idOrObj
  if(obj.uid && !isFabricObject(obj)) {
    return findById(obj.uid)
  }
  return obj
}

const Arrow = (function() {
    function Arrow(canvas) {
        this.canvas = canvas;
        this.className = 'Arrow';
        this.isDrawing = false;
        this.bindEvents();
    }

    Arrow.prototype.bindEvents = function() {
        const inst = this;
        inst.canvas.on('mouse:down', function(o) {
            inst.onMouseDown(o);
        });
        inst.canvas.on('mouse:move', function(o) {
            inst.onMouseMove(o);
        });
        inst.canvas.on('mouse:up', function(o) {
            inst.onMouseUp(o);
        });
        inst.canvas.on('object:moving', function(o) {
            inst.disable();
        })
    }

    Arrow.prototype.onMouseUp = function(o) {
        const inst = this;
        inst.disable();
    };

    Arrow.prototype.onMouseMove = function(o) {
        const inst = this;
        if (!inst.isEnable()) {
            return;
        }

        const pointer = inst.canvas.getPointer(o.e);
        const activeObj = inst.canvas.getActiveObject();
        activeObj.set({
            x2: pointer.x,
            y2: pointer.y
        });
        activeObj.setCoords();
        inst.canvas.renderAll();
    };

    Arrow.prototype.onMouseDown = function(o) {
        const inst = this;
        inst.enable();
        const pointer = inst.canvas.getPointer(o.e);

        const points = [pointer.x, pointer.y, pointer.x, pointer.y];
        const line = new fabric.LineArrow(points, {
            strokeWidth: 1.5,
            fill: '',
            stroke: '#555',
            padding: 4,
            hasBorders: false,
            hasControls: false
        });

        inst.canvas.add(line).setActiveObject(line);
    };

    Arrow.prototype.isEnable = function() {
        return this.isDrawing;
    }

    Arrow.prototype.enable = function() {
        this.isDrawing = true;
    }

    Arrow.prototype.disable = function() {
        this.isDrawing = false;
    }

    return Arrow;
}());

function changeText(obj, data) {
    if(!obj) return
    obj?._objects?.find(it => it.text !== null && it.text !== undefined)?.set({
        text: data
    });

    pc?.renderAll()
}

function textbox(opts){
    opts = combined({ top: 100, left: 400, angle: 0, color: 'blue', text: '', width: 300 }, opts);

    const textSample = new fabric.Textbox(opts.text, {
        fontSize: 20,
        left: opts.left,
        top: opts.top,
        fontFamily: 'helvetica',
        angle: opts.angle,
        fill: opts.color,
        fontWeight: '',
        originX: 'left',
        width: opts.width,
        hasRotatingPoint: true,
        centerTransform: true
    });
    if(opts.uid) textSample.uid = opts.uid;
    return textSample
}

function textInRect(textStr, x, y, optsText, optsRect, uid){
    if(!arguments.length) console.log('textInRect(text, x,y, optsText, optsRect)')
    if(!textStr) return null;

    const op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    const text = new fabric.Text(" " + textStr + " ", {
      fontSize: 20,
      originX: 'center',
      originY: 'center',
      fill: op.fill
    });

    let dwidth = 20, dheight = 20
    if(optsRect && optsRect.padx) dwidth = optsRect.padx;
    if(optsRect && optsRect.pady) dheight = optsRect.pady;

    const options = Object.assign({},{
        width: text.width + dwidth,
        height: text.height + dheight,
        fill: 'red',
        originX: 'center',
        originY: 'center',
        rx: 10, ry: 10
    },optsRect);

    if(optsRect.rectColor) options.fill = optsRect.rectColor;

    const rect = new fabric.Rect(options);

    const group = new fabric.Group([ rect, text ], {
        left: x,
        top: y
    });

    group.customData = {
        type: "textInRect",
        text: textStr,
        foreground: function(color) {
            if(!color) {

            }
        },
        background: function(color) {
            if(!color) {

            }
        }
    };

    if(uid) {
      group.uid = uid;
    }
    return group;
}

function textInCircle(textStr, x,y, optsText, optsCirc){
    if(!arguments.length) console.log('textInCircle(text, x,y, optsText, optsCirc)')
    if(!textStr) return null;

    const op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    const text = new fabric.Text( textStr, op);

    const options = Object.assign({},{
        radius: text.width,
        fill: 'red',
        originX: 'center',
        originY: 'center'
    },optsCirc);

    if(optsCirc.circleColor) options.fill = optsCirc.circleColor;

    const circle = new fabric.Circle(options);

    const group = new fabric.Group([ circle, text ], {
        left: x,
        top: y
    });

    group.customData = {
      type: "textInCircle",
      text: textStr
    }
    return group;
}

function textInEllipse(textStr, x, y, optsText, optsCirc){
  if(!arguments.length) console.log('textInEllipse(text, x,y, optsText, optsCirc)')
  if(!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);
  if(optsText.textColor) op.fill = optsText.textColor;

  const text = new fabric.Text( textStr, op);

  const options = Object.assign({},{
    rx: text.width,
    ry: text.height,
    fill: 'red',
    originX: 'center',
    originY: 'center'
  },optsCirc);

  if(optsCirc.circleColor) options.fill = optsCirc.circleColor;

  const circle = new fabric.Ellipse(options);

  const group = new fabric.Group([ circle, text ], {
    left: x,
    top: y
  });

  group.customData = {
    type: "textInEllipse",
    text: textStr
  }
  return group;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function boundedText(type) {
  switch (type) {
    case 'rect': return textInRect;
    case 'circ': return textInCircle;
    case 'elli': return textInEllipse;
    case 'diamond': return textInDiamond;
    case 'hexagon': return textInHexagon;
    case 'star': return textInStar;
    case 'cloud': return textInCloud;
  }
}

// Miro-like shape functions
function textInDiamond(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  const size = Math.max(text.width + 40, text.height + 40);
  const points = [
    { x: size/2, y: 0 },      // top
    { x: size, y: size/2 },   // right
    { x: size/2, y: size },   // bottom
    { x: 0, y: size/2 }       // left
  ];

  const options = Object.assign({}, {
    points: points,
    fill: 'orange',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  const diamond = new fabric.Polygon(points, options);

  const group = new fabric.Group([diamond, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInDiamond", text: textStr };
  return group;
}

function textInHexagon(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  const radius = Math.max(text.width, text.height) / 2 + 20;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    points.push({
      x: radius + radius * Math.cos(angle),
      y: radius + radius * Math.sin(angle)
    });
  }

  const options = Object.assign({}, {
    points: points,
    fill: 'purple',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  const hexagon = new fabric.Polygon(points, options);

  const group = new fabric.Group([hexagon, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInHexagon", text: textStr };
  return group;
}

function textInStar(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'white'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  const outerRadius = Math.max(text.width, text.height) / 2 + 25;
  const innerRadius = outerRadius * 0.5;
  const points = [];

  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    points.push({
      x: outerRadius + radius * Math.cos(angle - Math.PI/2),
      y: outerRadius + radius * Math.sin(angle - Math.PI/2)
    });
  }

  const options = Object.assign({}, {
    points: points,
    fill: 'gold',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  const star = new fabric.Polygon(points, options);

  const group = new fabric.Group([star, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInStar", text: textStr };
  return group;
}

function textInCloud(textStr, x, y, optsText, optsShape) {
  if (!textStr) return null;

  const op = Object.assign({}, {
    fontSize: 20,
    originX: 'center',
    originY: 'center',
    fill: 'black'
  }, optsText);

  const text = new fabric.Text(textStr, op);

  // Create cloud shape using multiple circles
  const baseWidth = text.width + 60;
  const baseHeight = text.height + 40;

  const circles = [
    new fabric.Circle({ radius: baseHeight/3, left: -baseWidth/4, top: 0 }),
    new fabric.Circle({ radius: baseHeight/2.5, left: -baseWidth/6, top: -baseHeight/4 }),
    new fabric.Circle({ radius: baseHeight/2, left: baseWidth/6, top: -baseHeight/3 }),
    new fabric.Circle({ radius: baseHeight/3, left: baseWidth/3, top: -baseHeight/6 }),
    new fabric.Circle({ radius: baseHeight/4, left: baseWidth/2, top: baseHeight/6 })
  ];

  const options = Object.assign({}, {
    fill: 'lightblue',
    originX: 'center',
    originY: 'center'
  }, optsShape);

  circles.forEach(circle => {
    circle.fill = options.fill;
    circle.originX = 'center';
    circle.originY = 'center';
  });

  const group = new fabric.Group([...circles, text], {
    left: x,
    top: y
  });

  group.customData = { type: "textInCloud", text: textStr };
  return group;
}

function addRectangle(opts){
    opts = opts || {}
    const rect = new fabric.Rect({
        left: 100,
        top: 100,
        fill: opts.fill || '',
        strokeWidth: 1,
        stroke: 'red',
        width: opts.width || 20,
        height: opts.height || 20
    });

    pc.add(rect)
    pc.renderAll()
    return rect
}

function groupFabricObjects (objs, opts){
    if(!objs) return
    objs.forEach(o => { pc.remove(o) });

    const G = new fabric.Group(objs, {left: opts.left || 100, top: opts.top || 100 })
    pc.add(G);
    G.setCoords()
    pc.renderAll();

    return G
}

function arrow(x1, y1, x2, y2, opts) {
    const options = combined({}, { strokeWidth: 1.5, stroke: '#555', arrowSize: 8 }, opts);
    const line = new fabric.LineArrow([x1, y1, x2, y2], {
        stroke: options.stroke,
        strokeWidth: options.strokeWidth,
        fill: '',
        arrowSize: options.arrowSize,
        padding: 4,
        selectable: true
    });
    if (opts && opts.uid) line.uid = opts.uid;
    return line;
}

function bidirectionalArrow(x1, y1, x2, y2, opts) {
    const options = combined({}, { strokeWidth: 1.5, stroke: '#555', arrowSize: 8 }, opts);

    // Use a custom Line that renders arrowheads at both ends
    const line = new BiLineArrow([x1, y1, x2, y2], {
        stroke: options.stroke,
        strokeWidth: options.strokeWidth,
        fill: '',
        arrowSize: options.arrowSize,
        padding: 4,
        selectable: true
    });

    if (opts && opts.uid) line.uid = opts.uid;
    return line;
}

// Bidirectional arrow: arrowheads at both ends
class BiLineArrow extends fabric.Line {
  static type = 'BiLineArrow';

  constructor(points, options) {
    const opts = Object.assign({ arrowSize: 8 }, options || {});
    super(points, opts);
    this.arrowSize = opts.arrowSize;
  }

  toObject(propertiesToInclude) {
    const obj = super.toObject(propertiesToInclude);
    obj.arrowSize = this.arrowSize;
    return obj;
  }

  _render(ctx) {
    super._render(ctx);
    if ((this.width === 0 && this.height === 0) || !this.visible) return;

    const xDiff = this.x2 - this.x1;
    const yDiff = this.y2 - this.y1;
    const angle = Math.atan2(yDiff, xDiff);
    const sz = this.arrowSize || 8;

    ctx.save();
    ctx.strokeStyle = this.stroke;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';

    // Arrowhead at end (x2,y2)
    ctx.translate((this.x2 - this.x1) / 2, (this.y2 - this.y1) / 2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, -sz * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, sz * 0.5);
    ctx.stroke();

    // Reset and draw arrowhead at start (x1,y1)
    ctx.rotate(-angle);
    ctx.translate(-(this.x2 - this.x1), -(this.y2 - this.y1));
    ctx.rotate(angle + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, -sz * 0.5);
    ctx.moveTo(0, 0);
    ctx.lineTo(-sz, sz * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  static fromObject(object) {
    return Promise.resolve(new BiLineArrow([object.x1, object.y1, object.x2, object.y2], object));
  }
}
fabric.BiLineArrow = BiLineArrow;
fabric.classRegistry.setClass(BiLineArrow);
fabric.classRegistry.setClass(BiLineArrow, 'BiLineArrow');

function text(text){
    const txt = new fabric.Text( text+"", {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    });
    txt.customData = {
      type: "text",
      text: text
    }

    return txt
}

/**
 * TODO: Support other shapes like rect, ellipse
 *
 **/
function arrayOfCircledTextsAt(x,y, canvas, opts){
    if(!arguments.length) console.log('arrayOfCircledTextsAt(x,y, canvas, opts)')

    recordScript(`arrayOfCircledTextsAt(${x}, ${y}, pc, ${JSON.stringify(opts)});`)
    let nextx = x, nexty = y;
    let addedObjects = []
    const options = Object.assign({},{ gapx: 3/2, gapy: 3/2 }, opts)
    const texts = []

    function Item(item){
        this.stopAnimation = false;
        this.stopRightNow = false;

        this.circle = item.item(0)
        this.all = item
        this.text = item.item(1)
        this.animating = false

        this.originalProps = { fill: item.item(0).fill, radius: item.item(0).radius}

        const me = this;
        this.animateCircleInLoop = function(x,y,z){

            me.circle.animate(x,y(), Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {
                    //callback code goes here
                    me.animateCircleInLoop(x,y,z)
                },
                abort: function(){
                    return me.stopAnimation;
                }
            },z));

            return me;
        } //end animateCircleInLoop

        this.animateCircle = function(x,y,z){
            const secArg = typeof(y) == 'function' ? y() : y

            me.circle.animate(x, secArg, Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {

                }
            },z));

            return me;
        } //end animateCircle

        this.animate = function(x,y,z){
            const secArg = typeof(y) == 'function' ? y() : y

            item.animate(x, secArg, Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {}
            },z));
        }

        this.moveToPoint = function (x,y, opts){
            const options = Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {}
            },opts);

            item.animate('left',x, options);
            item.animate('top', y, options);
        }

        this.moveBy = function (fn, opts){
            const pxy = fn(this)
            this.moveToPoint(pxy[0], pxy[1], opts)
        }

        this.move = function(where, other, opts){
            const options = combined({}, { gap: 0, dx: 0, dy: 0}, opts)

            cases = ['toLeftOf', 'below', 'above', 'toRightOf']

            switch(cases.indexOf(where)){
                case 0 : this.moveToPoint(other.left - item.width - options.gap + options.dx, other.top + options.dy, opts)
                    break;
                case 1 : this.moveToPoint(other.left + options.dx, other.top + other.height + options.gap + options.dy, opts)
                    break;
                case 2 : this.moveToPoint(other.left + options.dx, other.top - item.height - options.gap + options.dy, opts)
                    break;
                case 3 : this.moveToPoint(other.left + other.width + options.gap + options.dx, other.top + options.dy, opts)
                    break;
            }
        }

        this.changeCircle = function(changes){
            this.circle.set(changes)
            canvas.renderAll();
        }

        this.stop = function(){
            me.stopAnimation = true; animating = false;

            me.changeCircle(me.originalProps)
        }

        this.stopRightNow = function(){ me.stopRightNow = true; }

        this.highlightByZooming = function(opts){
            const size = 'original';

            me.stopAnimation = false;

            let fn = null;
            fn = () => {
                me.animateCircle('radius',
                    (me.circle.radius == me.originalProps.radius ? '-=8' : '+=8'),
                    {
                        onComplete: ()=> fn(),
                        abort: () => me.stopAnimation
                    }
                )
            }

            fn();

            me.animating = true
            if(opts){
                me.changeCircle(opts)
            }
            return me
        }
        this.connections = []
        this.connectTo = function (other, opts){
            let line = null;

            var opts = opts || { dx:0, dy: 0 }
            const options = combined({
                fill: '',
                stroke: '#888',
                strokeWidth: 1.5,
                padding: 4
            }, opts);

            if(typeof other == 'function'){
                other = other(this)
            }

            if(!other.all){
                line = new fabric.Line([ this.all.left+this.all.width/2-5,this.all.top+this.all.height,
                    other[0], other[1] ], options);
            } else {
                line = new fabric.Line([ this.all.left+this.all.width/2-5,this.all.top+this.all.height,
                    other.all.left+other.all.width/2 + opts.dx, other.all.top-5 + opts.dy], options);
            }
            canvas.add(line)
            this.connections.push(line)
            return line
        }

        this.methods = function(){
            return [
                'connectTo', 'highlightByZooming(options e.g. { fill: \'green\'})', 'stop',
                'changeCircle(options)', 'animate(e.g. \'left\', \'+=10\', options)',
                'moveToPoint(x,y,opts)'
            ]
        }

        this.pos = function(){
            return {
                x: this.all.left,
                y: this.all.top,
                midx: this.all.left+ this.all.width/2,
                midy: this.all.top + this.all.height /2
            }
        }

    } //end Item

    this.adjust = function(){

        addedObjects.forEach(obj => obj.animate('top', '-='+obj.all.height/2));

        return this;
    }

    this.add = function(text){
        texts.push(text)
    }

    this.and = function(text){

    }

    this.swap =  function(x,y, opts1, opts2){
        opts1 = combined({},{dx: 0, dy: 0}, opts1)
        opts2 = combined({},{dx: 0, dy: 0}, opts2)

        const tmp = [this.at(x).all.left, this.at(x).all.top]
        this.at(x).moveToPoint(this.at(y).all.left + opts1.dx, this.at(y).all.top + opts1.dy)

        this.at(y).moveToPoint(tmp[0] + opts2.dx, tmp[1] + opts2.dy)
    }

    this.at = function(i){
        if(i < 0){ return addedObjects[addedObjects.length+i]; }
        return addedObjects[i-1]
    }

    this.reset = function(){
        nextx = x, nexty = y;
        addedObjects.forEach( v => canvas.remove(v.all) )
        addedObjects = []
    }

    this.normalize = function(){
        let max = 0;
        texts.forEach(t => {
            const txt = text(t);
            if(txt.width > max) max = txt.width;
        });
        const radius = options.radius || max

        this.reset();
        const specificSizes = options.specificSizes || {}

        texts.forEach((t,i )=> {
            const group = textInCircle(t, nextx,nexty, options, combined({ radius: specificSizes[i] || radius}, options));
            canvas.add(group);

            nextx = nextx + group.width*options.gapx
            addedObjects.push(new Item(group))
        });
    }

    this.methods = function(){
        return [
            'normalize',
            'reset', 'at(indx)', 'add(text)', 'adjust'
        ]
    }
}

window.itemRecordCounter = {'A': 0, '': 0}
window.itemRecord = {}

function showArray(items, x, y, canvas, opts){
    if(!arguments.length) console.log('showArray(items,x,y,canvas, opts)')

    recordScript(`showArray(${items}, ${x}, ${y}, pc, ${JSON.stringify(opts)});`)
    const arr = new arrayOfCircledTextsAt(x,y,canvas, opts)
    items.forEach(item => arr.add( item+''))
    arr.normalize()

    window.itemRecordCounter['A'] = window.itemRecordCounter['A']
    window.itemRecord['_AR_'+ window.itemRecordCounter['A']] = arr;
    return arr
}

function showMatrix(arryOfItems, x,y,canvas, opts){
    if(!arguments.length) console.log('showMatrix(arryOfItems, x,y,canvas, opts)')

    const rad = arryOfItems.reduce((a,b) => a.concat(b)).reduce( (mx,a) => Math.max(mx, text(a).width) )
    const options = Object.assign({}, { gapx: 3/2, gapy: 3/2, radius: rad}, opts)

    const matrix = []
    arryOfItems.forEach( items => {
        const arr = showArray(items,x,y, canvas, options)
        matrix.push(arr)
        y += arr.at(1).all.height*options.gapy
    });

    return matrix;
}


function fabricUpdate(canvas, obj, changes){
    obj.set(changes)
    canvas.renderAll()
}

function visualAlgoMethods(){
    return [
        'range(start, count)',
        'fabricUpdate(canvas, obj, changes)',
        'showMatrix(arryOfItems, x,y,canvas, opts)',
        'showArray(items,x,y,canvas, opts)',
        'textInRect(text, x,y, optsText, optsRect)'
    ]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function animate(obj, props, opts){
    if(!obj) return
    obj = findIfRequired(obj)

    const canvas = pc;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
    const objSpecificUpdate = obj?.onAnimationChange || (() => {});
    const options = Object.assign({}, {
        duration: 1000,
        onChange: () => { canvas.renderAll.bind(canvas); objSpecificUpdate(); canvas.renderAll(); },
        onComplete: function() {}
    }, opts);

    const fn = options.onComplete;

    return new Promise(function(myResolve) {
        options.onComplete = (e) => {
            fn(e);
            myResolve()
        }
        obj.animate(props, options);
    });
}

function centerOf(obj){
    return {
        x: obj.left + obj.width/2,
        y: obj.top + obj.height/2
    }
}

function positionTogether(first, second){
    return {
        ytop: second.top - first.height,
        ybottom: second.top + second.height,
        xleft: second.left - first.width,
        xright: second.left + second.width
    }
}

function appendTableInto(table, target, opts){
    const options = combined({}, {
        xtitle: '', ytitle: '',
        xheaders: [], yheaders: [],
        width: 100, height: 60,
        backgroundColor: 'white', color: 'white',
        xheaderColor: '#73738c',
        yheaderColor: '#73738c',
        id: `table-autogen-${new Date().getTime()}`
    }, opts)

    if(table.length === 0 && options.xheaders.length !== 0){
        table = range(0,options.yheaders.length).map(i => range(0, options.xheaders.length).map(j => ' '))
    }

    const css = `
.verticalTableHeader {
    text-align:center;
    white-space:nowrap;
    g-origin:50% 50%;
    -webkit-transform: rotate(90deg);
    -moz-transform: rotate(90deg);
    -ms-transform: rotate(90deg);
    -o-transform: rotate(90deg);
    transform: rotate(90deg);
    color: #8888c1;
    padding: 0;
    margin: 0;
    width: 53px;
	}
	.verticalTableHeader p {
	    margin:0 -100% ;
	    display:inline-block;
	}
	.verticalTableHeader p:before{
	    content:'';
	    width:0;
	    padding-top:110%;/* takes width as reference, + 10% for faking some extra padding */
	    display:inline-block;
	    vertical-align:middle;
	}

.data td::before {

}
	`;

    if(!$('#verticalTableHeader').length){
        $('body').append($('<style>').attr({id : 'verticalTableHeader'}).html(css))
    }


    const tableHtml = `<table id="${options.id}" style="position: absolute; " class="main-container">
  <tr>
    <td>
	  	<tr width="100%" style="color: blue; height: 20px;">
	      	<td></td>
	        <td colspan="${table[0].length}" style="padding: 5px; text-align: center" >
	        	${options.xtitle}
	        </td>
	      </tr>
	  </td>
  </tr>
  <tr>

 	<td class="verticalTableHeader">
 		<p>
	     ${options.ytitle}
	  </p>
 	</td>

    <td>
      <table class="data" border="1" style="border-collapse: collapse; width: 100%; margin-left: -15px; margin-top: 0px; text-align: center; height: 100%">

	      <tr>
	          <th style="text-align: center" ></th>
	          ${options.xheaders.map((x, col) => `<th style="text-align: center; color: blue" data-column="${col}" class="xheader"> <span class="item"> ${x}</span></th>`).join('')}
	      </tr>

	      ${range(0, table.length).map(row =>
        `<tr class="data"> <th style="text-align: center; color: #8888c1" data-row="${row}" class="yheader"> <span class="item"> ${options.yheaders[row]} </span></th>`
        + table[row].map((y,col) => `<td style="" data-row="${row}" data-column="${col}" data-value="${y}"> <span class="item"> ${y} </span></td>`).join('') +'</tr>'
    ).join('')}
    </table>
    </td>
  </tr>
</table>`

    table = $(tableHtml)
    $(target).append(table)

    table.find('table').css({ backgroundColor: options.backgroundColor, color: options.color })
    table.css({ backgroundColor: options.backgroundColor, color: options.color, width: options.width, height: options.height, position: 'absolute',
        left: options.left,
        top: options.top })

    table.draggable()
    table.resizable();

//  $(table).find("tr:nth(1)").remove()

    $(function() {
        const thHeight = table.find("th:first").height();
        table.find("th").resizable({
            handles: "e",
            minHeight: thHeight,
            maxHeight: thHeight,
            minWidth: 40,
            resize: function (event, ui) {
                const sizerID = "#" + $(event.target).attr("id") + "-sizer";
                $(sizerID).width(ui.size.width);
            }
        });
        table.find('td').resizable({
            handles: "s"
        });
    });

//	table.find('table.data').css(opts)
//	setTimeout(()=> table.find('.yheader').css({'padding-left': '4%','padding-right': '4%'}), 500);

    const each = fn => {
        for(let i = 0; i < opts.yheaders.length; i++) {
            for(let j = 0; j < opts.xheaders.length; j++) {
                const el = $($(table.find('tr.data')[i]).find('td')[j]);
                fn(i, j, el)
            }
        }
    }

    if(opts.cellClicked) {
        each( (i, j, el) => el.click(e => opts.cellClicked(i, j, el)) )
    }

    return {
        all: table,
        xheader: function(i){
            return $(table.find('th.xheader')[i-1])
        },
        yheader : function(i){
            return $(table.find('th.yheader')[i-1])
        },
        at : function(i,j){
            return $($(table.find('tr.data')[i-1]).find('td')[j-1])
        },
        each: function (fn) {
            each(fn)
        }
    }
}

/**
 * TODO: Make it work for both fabrics js and html
 * @param obj
 * @returns {*[]}
 */
function midOf(obj){
    const rect = {x: null, y: null,w: null, h: null}

    if(!obj.left) {
        try {
            const tl = $(obj).position();
            rect.x = tl.left; rect.y = tl.top;
        } catch(e){ console.log(e); }
    } else {
        rect.x = obj.left; rect.y = obj.top;
    }

    if(obj.width && (typeof obj.width != 'function')){
        rect.w = obj.width; rect.h = obj.height;
    } else {
        rect.w = obj.width(); rect.h = obj.height();
    }


    return [rect.x + rect.w/2, rect.y + rect.h/2]
}

function centerFirstToSecond(obj, obj2){
    const c2 = midOf(obj2);

    const rect = {x: null, y: null,w: null, h: null}

    if(!obj.left) {
        try {
            const tl = $(obj).position();
            rect.x = tl.left; rect.y = tl.top;
        } catch(e){ console.log(e); }
    } else {
        rect.x = obj.left; rect.y = obj.top;
    }

    if(obj.width && (typeof obj.width != 'function')){
        rect.w = obj.width; rect.h = obj.height;
    }
    else { rect.w = obj.width(); rect.h = obj.height();}

    return [c2[0] - rect.w/2, c2[1] - rect.h /2]
}

window.curry = fn => { // (1)

    const arity = fn.length; //(2) number of arguments fn expects
    return (...args) => { // (3)
        const firstArgs = args.length; // (4)
        if (firstArgs >= arity) { //correct number of arguments

            return fn(...args); // (5)
        } else {
            return (...secondArgs) => { // (6)

                return fn(...[...args, ...secondArgs]); // (7)
            }
        }
    }
}

window.Accordion = {
    createAll: function(className){
        const titles = [];
        $("."+ className +" .title").each((i,e) => titles.push(e))

        const clickHandler = (target) => {
            $(target).toggleClass('active');
            if($(target).hasClass('active')){
                $(target).next('.content').addClass('active')

                titles.filter( t => t != target).forEach(t => {
                    $(t).removeClass('active')
                    $(t).next('.content').removeClass('active')
                })
            } else {
                $(target).next('.content').removeClass('active')
            }
        };

        titles.forEach( (t,i) => $(t).click(e => clickHandler(t) ))
    }
}

function bounds(obj){

    const rect = {x: null, y: null,w: null, h: null, right: null, bottom: null}

    if(!obj.left) {
        try {
            const tl = $(obj).position();
            rect.x = tl.left; rect.y = tl.top;
        } catch(e){ console.log(e); }
    } else {
        rect.x = obj.left; rect.y = obj.top;
    }

    if(obj.width && (typeof obj.width != 'function')){
        rect.w = obj.width; rect.h = obj.height;
    } else {
        rect.w = obj.width(); rect.h = obj.height();
    }

    rect.right = rect.x + rect.w;
    rect.bottom = rect.y + rect.h;

    return rect;

}

/**
 * Connect using a line.
 * TODO: Make it sticky just like treeConnections
 * @param canvas
 * @param it
 * @param other
 * @param opts
 * @returns {*}
 */
function connect(canvas, it, other, opts){

    var line = null;

    var opts = opts || { dx:0, dy: 0 }
    const options = combined({
        stroke: '#555',
        strokeWidth: 1.5
    }, opts);

    if(typeof other == 'function'){
        other = other(this)
    }

    let x1,y1,x2,y2;
    const midx1 = it.left+it.width/2, midy1 = it.top+it.height/2, midx2 = other.left+other.width/2, midy2 = other.top + other.height/2
    if(other.left > it.left + it.width){
        x1 = it.left+it.width; x2 = other.left;
    } else if(other.left + other.width < it.left) {
        x1 = it.left; x2 = other.left+other.width;
    } else {
        x1 = midx1; x2 = midx2;
    }

    if(other.top > it.top + it.height){
        y1 = it.top + it.height; y2 = other.top;
    } else if(other.top + other.height < it.top) {
        y1 = it.top; y2 = other.top + other.height;
    } else {
        y1 = midy1; y2 = midy2;
    }

    var line = new fabric.LineArrow([x1, y1, x2, y2], {
        strokeWidth: 1.5,
        fill: '',
        stroke: '#555',
        padding: 4
    });

    canvas.add(line)

    return line

}

// This function does the actual work
function matex(text, callback) {
    // Create a script element with the LaTeX code
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.left = "-1000px";
    document.body.appendChild(div);
    const se = document.createElement("script");
    se.setAttribute("type", "math/tex");
    se.innerHTML = text;
    div.appendChild(se);


    MathJax.Hub.Process(se, function() {
        // When processing is done, remove from the DOM
        // Wait some time before doing tht because MathJax calls this function before
        // actually displaying the output
        var display = function() {
            // Get the frame where the current Math is displayed
            const frame = document.getElementById(se.id + "-Frame");
            if(!frame) {
                setTimeout(display, 500);
                return;
            }

            // Load the SVG
            const svg = frame.getElementsByTagName("svg")[0];
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svg.setAttribute("version", "1.1");
            const height = svg.parentNode.offsetHeight;
            const width = svg.parentNode.offsetWidth;
            svg.setAttribute("height", height);
            svg.setAttribute("width", width);
            svg.removeAttribute("style");

            // Embed the global MathJAX elements to it
            const mathJaxGlobal = document.getElementById("MathJax_SVG_glyphs");
            svg.appendChild(mathJaxGlobal.cloneNode(true));

            // Create a data URL
            const svgSource = '<?xml version="1.0" encoding="UTF-8"?>' + "\n" + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + "\n" + svg.outerHTML;
            const retval = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgSource)));

            // Remove the temporary elements
            document.body.removeChild(div);

            // Invoke the user callback
            callback(retval, width, height);
        };
        setTimeout(display, 1000);
    });
}

const highlightByZooming = function(object, canvas, opts){
    const me = object.externalData || {}

    me.stopAnimation = false;

    let fn = null;

    const originalZoomY = object.zoomY
    const originalZoomX = object.zoomX
    me.originalProps = me.originalProps || {}
    me.originalProps.zoomX = originalZoomX
    me.originalProps.zoomY = originalZoomY

    const range = (x) => [x*2, 2*x/3] //zoomout, zoomin

    const zoomX = range(originalZoomX)
    const zoomY = range(originalZoomY)

    let timer = 0;
    fn = (prop, values, opts) => {
        opts = opts || {}
        object.animate(prop, values[timer], Object.assign({},
            {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),

                abort: () => !object || me.stopAnimation
            },
            opts || {},
            {
                onComplete: ()=> {fn(prop, values, opts); if(opts.onComplete) opts.onComplete();}
            }
            )
        );

    }

    me.animating = true;
    fn('zoomX', zoomX);
    fn('zoomY', zoomY, { onComplete: ()=> timer = (timer+1)%2 });

    me.animating = true
    if(opts){
        me.changeCircle(opts)
    }
    object.externalData = me;
    return me;
}

function stopAnimation(object, canvas){

    if(object.externalData) {
        const me = object.externalData
        me.stopAnimation = true;
        if(!me.animating) return null;

        if(me.originalProps.zoomX)object.zoomX = me.originalProps.zoomX
        if(me.originalProps.zoomY)object.zoomY = me.originalProps.zoomY

        canvas.renderAll()
        me.animating = false;
        return me;
    }
    return null
}

function makeLine(coords, opts) {
    opts = Object.assign({}, {stroke: '#888', strokeWidth: 1.5}, opts);
    return new fabric.Line(coords, {
        fill: '',
        stroke: opts.stroke,
        strokeWidth: opts.strokeWidth,
        selectable: false,
        evented: false,
        padding: 4
    });
}

function hide() {
  const items = Array.prototype.slice.apply(arguments);
  items.forEach(it => {
    if (it instanceof fabric.Object) {
      it.set({ opacity: 0 });
      update();
    } else if (it instanceof jQuery) {
      it.hide()
    }
  });
}

function Clone(object, id, top, left) {
  return object.clone().then(function (clone) {
    pc.add(clone.set({
      left: left || (object.left + 1),
      top: top || (object.top + 1)
    }));
    update();
    if (window._ && id) _[id] = clone;
    return clone;
  });
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

function type(strings, elSelector, opts) {
  const options = Object.assign({}, {
    strings: [strings].flat(),
    onComplete: (self) => {
    }
  }, opts);

  $(elSelector).css(options);

  $('#typed-strings').html("<p>" + strings + "</p>");
  $('#textillateContainer .typed-cursor').remove()

  const prettyLog = (x) => console.log(x);

  $(elSelector).html('');

  return new Promise((myResolve) => {
    const typed = new Typed(elSelector, {
      stringsElement: '#typed-strings',
      typeSpeed: 40,
      backSpeed: 0,
      backDelay: 500,
      startDelay: 1000,
      loop: false,
      onComplete: function (self) {
        // prettyLog('onCmplete ' + self); self.destroy();
        options.onComplete(self);
        myResolve(self);
      },
      onDestroy: function (self) {
        console.log("destroyed");
        myResolve(self);
      }

    });
  });//promise
}

//Accessor for matrix
function at(matrix, i, j) {
  return $(matrix.all.find(`table.data td[data-row='${i}']`)[j]);
}

