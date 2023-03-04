
// Extended fabric line class
fabric.LineArrow = fabric.util.createClass(fabric.Line, {

    type: 'lineArrow',

    initialize: function(element, options) {
        options || (options = {});
        this.callSuper('initialize', element, options);
    },

    toObject: function() {
        return fabric.util.object.extend(this.callSuper('toObject'));
    },

    _render: function(ctx) {
        this.callSuper('_render', ctx);

        // do not render if width/height are zeros or object is not visible
        if (this.width === 0 || this.height === 0 || !this.visible) return;

        ctx.save();

        var xDiff = this.x2 - this.x1;
        var yDiff = this.y2 - this.y1;
        var angle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1) * 180 / Math.PI;

        ctx.translate(this.x2,this.y2)

        //ctx.rotate(angle);
        ctx.beginPath();
        //move 10px in front of line to start the arrow so it does not have the square line end showing in front (0,0)
        //ctx.moveTo(10, 0);

        ctx.lineTo(10*Math.cos(angle), 10*Math.sin(angle))
        ctx.translate(this.x2,this.y2)

        ctx.lineTo(-10*Math.cos(angle), -10*Math.sin(angle))
        ctx.closePath();
        ctx.fillStyle = this.stroke;
        //ctx.fill();

        ctx.restore();

    }
});

fabric.LineArrow.fromObject = function(object, callback) {
    callback && callback(new fabric.LineArrow([object.x1, object.y1, object.x2, object.y2], object));
};

fabric.LineArrow.async = true;


var Arrow = (function() {
    function Arrow(canvas) {
        this.canvas = canvas;
        this.className = 'Arrow';
        this.isDrawing = false;
        this.bindEvents();
    }

    Arrow.prototype.bindEvents = function() {
        var inst = this;
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
        var inst = this;
        inst.disable();
    };

    Arrow.prototype.onMouseMove = function(o) {
        var inst = this;
        if (!inst.isEnable()) {
            return;
        }

        var pointer = inst.canvas.getPointer(o.e);
        var activeObj = inst.canvas.getActiveObject();
        activeObj.set({
            x2: pointer.x,
            y2: pointer.y
        });
        activeObj.setCoords();
        inst.canvas.renderAll();
    };

    Arrow.prototype.onMouseDown = function(o) {
        var inst = this;
        inst.enable();
        var pointer = inst.canvas.getPointer(o.e);

        var points = [pointer.x, pointer.y, pointer.x, pointer.y];
        var line = new fabric.LineArrow(points, {
            strokeWidth: 5,
            fill: 'red',
            stroke: 'red',
            originX: 'center',
            originY: 'center',
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
    obj._objects[1].set({
        text: data
    });

    if(pc) pc.renderAll()
}

function textbox(opts){
    var opts = combined({ top: 100, left: 400, angle: 0, color: 'blue', text: '', width: 300 }, opts);

    var textSample = new fabric.Textbox(opts.text, {
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
    let id = globalStore('tb', textSample)

    console.log(`_.${id} = textbox(${JSON.stringify(opts)})`)
    return textSample
}

function textInRect(text, x,y, optsText, optsRect){
    if(!arguments.length) console.log('textInRect(text, x,y, optsText, optsRect)')

    var op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    var text = new fabric.Text( " "+text+" ", {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    });

    var dwidth = 20, dheight = 20
    if(optsRect && optsRect.padx) dwidth = optsRect.padx;
    if(optsRect && optsRect.pady) dheight = optsRect.pady;

    var options = Object.assign({},{
        width: text.width + dwidth,
        height: text.height + dheight,
        fill: 'red',
        originX: 'center',
        originY: 'center',
        rx: 10, ry: 10
    },optsRect);

    if(optsRect.rectColor) options.fill = optsRect.rectColor;

    var rect = new fabric.Rect(options);

    var group = new fabric.Group([ rect, text ], {
        left: x,
        top: y
    });

    group.customData = {
        type: "textInRect",
        foreground: function(color) {
            if(!color) {

            }
        },
        background: function(color) {
            if(!color) {

            }
        }
    };

    return group;
}

function textInCircle(text, x,y, optsText, optsCirc){
    if(!arguments.length) console.log('textInCircle(text, x,y, optsText, optsCirc)')
    if(!text) return null;

    var op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    var text = new fabric.Text( text, op);

    var options = Object.assign({},{
        radius: text.width,
        fill: 'red',
        originX: 'center',
        originY: 'center'
    },optsCirc);

    if(optsCirc.circleColor) options.fill = optsCirc.circleColor;

    var circle = new fabric.Circle(options);

    var group = new fabric.Group([ circle, text ], {
        left: x,
        top: y
    });

    return group;
}

function addRectangle(opts){
    opts = opts || {}

    var rect = new fabric.Rect({
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

    let G = new fabric.Group(objs, {left: opts.left || 100, top: opts.top || 100 })
    pc.add(G);
    G.setCoords()

    pc.renderAll();

    return G
}

function arrow(x1,y1,x2,y2, opts){
    var options = combined({},  { strokeWidth: 1, stroke: 'black', fill: 'white', triangleWidth: 10, triangleHeight: 10}, opts)
    var tri = new fabric.Triangle({
        left: x2,
        top: y2,
        strokeWidth: options.strokeWidth,
        width: options.triangleWidth,
        height: options.triangleHeight,
        stroke: options.stroke,
        fill: options.fillTriangle,
        selectable: true,
        originX: 'center',
        originY: 'center'
    });

    var slope =  Math.atan2(y2- y1, x2- x1)*180/Math.PI;
    tri.rotate(90+slope);
    var line = new fabric.Line([ x1,y1,x2,y2 ], { stroke: options.stroke, strokeWidth: options.strokeWidth})

    var group = new fabric.Group([ line, tri ], {
        left: x1,
        top: y1
    });

    return group
}

function textInEllipse(text, x,y, optsText, optsCirc){
    if(!arguments.length) console.log('textInEllipse(text, x,y, optsText, optsCirc)')
    if(!text) return null;

    var op = Object.assign({}, {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    }, optsText);
    if(optsText.textColor) op.fill = optsText.textColor;

    var text = new fabric.Text( text, op);

    var options = Object.assign({},{
        rx: text.width,
        ry: text.height,
        fill: 'red',
        originX: 'center',
        originY: 'center'
    },optsCirc);

    if(optsCirc.circleColor) options.fill = optsCirc.circleColor;

    var circle = new fabric.Ellipse(options);

    var group = new fabric.Group([ circle, text ], {
        left: x,
        top: y
    });

    return group;
}

function text(text){
    var txt = new fabric.Text( text+"", {
        fontSize: 20,
        originX: 'center',
        originY: 'center',
        fill: 'white'
    });
    return txt
}

function arrayOfCircledTextsAt(x,y, canvas, opts){
    if(!arguments.length) console.log('arrayOfCircledTextsAt(x,y, canvas, opts)')

    var nextx = x, nexty = y;
    var addedObjects = []
    var options = Object.assign({},{ gapx: 3/2, gapy: 3/2 }, opts)
    var texts = []

    function Item(item){
        this.stopAnimation = false;
        this.stopRightNow = false;

        this.circle = item.item(0)
        this.all = item
        this.text = item.item(1)
        this.animating = false

        this.originalProps = { fill: item.item(0).fill, radius: item.item(0).radius}

        var me = this;
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
            var options = Object.assign({}, {
                duration: 1000,
                onChange: canvas.renderAll.bind(canvas),
                onComplete: function() {}
            },opts);

            item.animate('left',x, options);
            item.animate('top', y, options);
        }

        this.moveBy = function (fn, opts){
            var pxy = fn(this)
            this.moveToPoint(pxy[0], pxy[1], opts)
        }

        this.move = function(where, other, opts){
            var options = combined({}, { gap: 0, dx: 0, dy: 0}, opts)

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
            var size = 'original';

            me.stopAnimation = false;

            var fn = null;
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
            var line = null;

            var opts = opts || { dx:0, dy: 0 }
            var options = combined({
                fill: 'red',
                stroke: 'red',
                strokeWidth: 3
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

        var tmp = [this.at(x).all.left, this.at(x).all.top]
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
        var max = 0;
        texts.forEach(t => {
            var txt = text(t);
            if(txt.width > max) max = txt.width;
        });
        var radius = options.radius || max

        this.reset();
        const specificSizes = options.specificSizes || {}

        texts.forEach((t,i )=> {
            var group = textInCircle(t, nextx,nexty, options, combined({ radius: specificSizes[i] || radius}, options));
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

function showArray(items,x,y,canvas, opts){
    if(!arguments.length) console.log('showArray(items,x,y,canvas, opts)')

    var arr = new arrayOfCircledTextsAt(x,y,canvas, opts)
    items.forEach(item => arr.add( item+''))
    arr.normalize()

    window.itemRecordCounter['A'] = window.itemRecordCounter['A']
    window.itemRecord['_AR_'+ window.itemRecordCounter['A']] = arr;
    return arr
}

function showMatrix(arryOfItems, x,y,canvas, opts){
    if(!arguments.length) console.log('showMatrix(arryOfItems, x,y,canvas, opts)')

    var rad = arryOfItems.reduce((a,b) => a.concat(b)).reduce( (mx,a) => Math.max(mx, text(a).width) )
    var options = Object.assign({}, { gapx: 3/2, gapy: 3/2, radius: rad}, opts)

    var matrix = []
    arryOfItems.forEach( items => {
        var arr = showArray(items,x,y, canvas, options)
        matrix.push(arr)
        y += arr.at(1).all.height*options.gapy
    });

    return matrix;
}

function combined(){
    return Object.assign(...arguments)
}

function fabricUpdate(canvas, obj, changes){
    obj.set(changes)
    canvas.renderAll()
}

function range(start, count, filter, fn) {

    if(!arguments.length) console.log('range(start, count)')

    if(arguments.length === 3){
        fn = filter;
        filter = x => true
    }

    const ar = Array.apply(0, Array(count))
        .map(function (element, index) {
            return index + start;
        });

    if(fn) return ar.filter(filter).map(x => fn(x))
    else return ar;
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

function animate(obj, props,opts){
    let canvas = pc;
    let options = Object.assign({}, {
        duration: 1000,
        onChange: canvas.renderAll.bind(canvas),
        onComplete: function() {}
    },opts);

    let fn = options.onComplete;

    return new Promise(function(myResolve, myReject) {
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
    var options = combined({}, {
        xtitle: '', ytitle: '',
        xheaders: [], yheaders: [],
        width: 100, height: 60,
        backgroundColor: 'white', color: 'white',
        xheaderColor: '#73738c',
        yheaderColor: '#73738c',
        id: `table-autogen-${new Date().getTime()}`
    }, opts)

    if(table.length == 0 && options.xheaders.length != 0){
        table = range(0,options.yheaders.length).map(i => range(0, options.xheaders.length).map(j => ' '))
    }

    var css = `
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


    var tableHtml = `<table id="${options.id}" style="position: absolute; " class="main-container">
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

    var table = $(tableHtml)
    $(target).append(table)

    table.find('table').css({ backgroundColor: options.backgroundColor, color: options.color })
    table.css({ backgroundColor: options.backgroundColor, color: options.color, width: options.width, height: options.height, position: 'absolute',
        left: options.left,
        top: options.top })

    table.draggable()
    table.resizable();

//  $(table).find("tr:nth(1)").remove()

    $(function() {
        var thHeight = table.find("th:first").height();
        table.find("th").resizable({
            handles: "e",
            minHeight: thHeight,
            maxHeight: thHeight,
            minWidth: 40,
            resize: function (event, ui) {
                var sizerID = "#" + $(event.target).attr("id") + "-sizer";
                $(sizerID).width(ui.size.width);
            }
        });
        table.find('td').resizable({
            handles: "s"
        });
    });

//	table.find('table.data').css(opts)
//	setTimeout(()=> table.find('.yheader').css({'padding-left': '4%','padding-right': '4%'}), 500);

    let each = fn => {
        for(let i = 0; i < opts.yheaders.length; i++) {
            for(let j = 0; j < opts.xheaders.length; j++) {
                let el = $($(table.find('tr.data')[i]).find('td')[j]);
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

function midOf(obj){
    var rect = {x: null, y: null,w: null, h: null}

    if(!obj.left) {
        try {
            var tl = $(obj).position();
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
    var c2 = midOf(obj2);

    var rect = {x: null, y: null,w: null, h: null}

    if(!obj.left) {
        try {
            var tl = $(obj).position();
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

    let arity = fn.length; //(2) number of arguments fn expects
    return (...args) => { // (3)
        let firstArgs = args.length; // (4)
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
        var titles = [];
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

    var rect = {x: null, y: null,w: null, h: null, right: null, bottom: null}

    if(!obj.left) {
        try {
            var tl = $(obj).position();
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

fabric.Image.filters.WhiteToTransparent = fabric.util.createClass({

    type: 'whiteToTransparent',

    applyTo: function(canvasEl) {
        var context = canvasEl.getContext('2d'),
            imageData = context.getImageData(0, 0, canvasEl.width, canvasEl.height),
            pix = imageData.data;

        var newColor = {r:0,g:0,b:0, a:0};
        for (var i = 0, n = pix.length; i <n; i += 4) {
            var r = pix[i],
                g = pix[i+1],
                b = pix[i+2];

            if(r == 255&& g == 255 && b == 255){
                // Change the white to the new color.
                pix[i] = newColor.r;
                pix[i+1] = newColor.g;
                pix[i+2] = newColor.b;
                pix[i+3] = newColor.a;
            }
        }


        context.putImageData(imageData, 0, 0);
    }
});

function connect(canvas, it, other, opts){

    var line = null;

    var opts = opts || { dx:0, dy: 0 }
    var options = combined({
        fill: 'black',
        stroke: 'black',
        strokeWidth: 2
    }, opts);

    if(typeof other == 'function'){
        other = other(this)
    }

    var x1,y1,x2,y2;
    var midx1 = it.left+it.width/2, midy1 = it.top+it.height/2, midx2 = other.left+other.width/2, midy2 = other.top + other.height/2
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
        strokeWidth: 2,
        fill: 'red',
        stroke: 'red',
        originX: 'center',
        originY: 'center'
    });

    canvas.add(line)

    return line

}

// This function does the actual work
function matex(text, callback) {
    // Create a script element with the LaTeX code
    var div = document.createElement("div");
    div.style.position = "absolute";
    div.style.left = "-1000px";
    document.body.appendChild(div);
    var se = document.createElement("script");
    se.setAttribute("type", "math/tex");
    se.innerHTML = text;
    div.appendChild(se);


    MathJax.Hub.Process(se, function() {
        // When processing is done, remove from the DOM
        // Wait some time before doing tht because MathJax calls this function before
        // actually displaying the output
        var display = function() {
            // Get the frame where the current Math is displayed
            var frame = document.getElementById(se.id + "-Frame");
            if(!frame) {
                setTimeout(display, 500);
                return;
            }

            // Load the SVG
            var svg = frame.getElementsByTagName("svg")[0];
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svg.setAttribute("version", "1.1");
            var height = svg.parentNode.offsetHeight;
            var width = svg.parentNode.offsetWidth;
            svg.setAttribute("height", height);
            svg.setAttribute("width", width);
            svg.removeAttribute("style");

            // Embed the global MathJAX elements to it
            var mathJaxGlobal = document.getElementById("MathJax_SVG_glyphs");
            svg.appendChild(mathJaxGlobal.cloneNode(true));

            // Create a data URL
            var svgSource = '<?xml version="1.0" encoding="UTF-8"?>' + "\n" + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + "\n" + svg.outerHTML;
            var retval = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgSource)));

            // Remove the temporary elements
            document.body.removeChild(div);

            // Invoke the user callback
            callback(retval, width, height);
        };
        setTimeout(display, 1000);
    });
}

var highlightByZooming = function(object, canvas, opts){
    var me = object.externalData || {}

    me.stopAnimation = false;

    var fn = null;

    var originalZoomY = object.zoomY
    var originalZoomX = object.zoomX
    me.originalProps = me.originalProps || {}
    me.originalProps.zoomX = originalZoomX
    me.originalProps.zoomY = originalZoomY

    var range = (x) => [x*2, 2*x/3] //zoomout, zoomin

    var zoomX = range(originalZoomX)
    var zoomY = range(originalZoomY)

    var timer = 0;
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
        var me = object.externalData
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
    opts = Object.assign({}, {fill: 'red', stroke: 'red', strokeWidth: 2}, opts);
    return new fabric.Line(coords, {
        fill: opts.fill,
        stroke: opts.stroke,
        strokeWidth: opts.strokeWidth,
        selectable: false,
        evented: false,
    });
}


