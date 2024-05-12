(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
"use strict";
// Notes: Add new Node types
// 1. Add new Node type to ASTNodeTypes
// 2. Update txtnode.md
// 3. Add test to packages/@textlint/types/test/Rule/TxtNode-test.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTNodeTypes = void 0;
/**
 * ASTNodeTypes is a list of ASTNode type.
 */
var ASTNodeTypes;
(function (ASTNodeTypes) {
    ASTNodeTypes["Document"] = "Document";
    ASTNodeTypes["DocumentExit"] = "Document:exit";
    ASTNodeTypes["Paragraph"] = "Paragraph";
    ASTNodeTypes["ParagraphExit"] = "Paragraph:exit";
    ASTNodeTypes["BlockQuote"] = "BlockQuote";
    ASTNodeTypes["BlockQuoteExit"] = "BlockQuote:exit";
    ASTNodeTypes["ListItem"] = "ListItem";
    ASTNodeTypes["ListItemExit"] = "ListItem:exit";
    ASTNodeTypes["List"] = "List";
    ASTNodeTypes["ListExit"] = "List:exit";
    ASTNodeTypes["Header"] = "Header";
    ASTNodeTypes["HeaderExit"] = "Header:exit";
    ASTNodeTypes["CodeBlock"] = "CodeBlock";
    ASTNodeTypes["CodeBlockExit"] = "CodeBlock:exit";
    /**
     * @deprecated use Html instead of it
     */
    ASTNodeTypes["HtmlBlock"] = "HtmlBlock";
    ASTNodeTypes["HtmlBlockExit"] = "HtmlBlock:exit";
    ASTNodeTypes["HorizontalRule"] = "HorizontalRule";
    ASTNodeTypes["HorizontalRuleExit"] = "HorizontalRule:exit";
    ASTNodeTypes["Comment"] = "Comment";
    ASTNodeTypes["CommentExit"] = "Comment:exit";
    /**
     * @deprecated
     */
    ASTNodeTypes["ReferenceDef"] = "ReferenceDef";
    /**
     * @deprecated
     */
    ASTNodeTypes["ReferenceDefExit"] = "ReferenceDef:exit";
    // inline
    ASTNodeTypes["Str"] = "Str";
    ASTNodeTypes["StrExit"] = "Str:exit";
    ASTNodeTypes["Break"] = "Break";
    ASTNodeTypes["BreakExit"] = "Break:exit";
    ASTNodeTypes["Emphasis"] = "Emphasis";
    ASTNodeTypes["EmphasisExit"] = "Emphasis:exit";
    ASTNodeTypes["Strong"] = "Strong";
    ASTNodeTypes["StrongExit"] = "Strong:exit";
    ASTNodeTypes["Html"] = "Html";
    ASTNodeTypes["HtmlExit"] = "Html:exit";
    ASTNodeTypes["Link"] = "Link";
    ASTNodeTypes["LinkExit"] = "Link:exit";
    ASTNodeTypes["Image"] = "Image";
    ASTNodeTypes["ImageExit"] = "Image:exit";
    ASTNodeTypes["Code"] = "Code";
    ASTNodeTypes["CodeExit"] = "Code:exit";
    ASTNodeTypes["Delete"] = "Delete";
    ASTNodeTypes["DeleteExit"] = "Delete:exit";
    // Table is supported in textlint v13+
    ASTNodeTypes["Table"] = "Table";
    ASTNodeTypes["TableExit"] = "Table:exit";
    ASTNodeTypes["TableRow"] = "TableRow";
    ASTNodeTypes["TableRowExit"] = "TableRow:exit";
    ASTNodeTypes["TableCell"] = "TableCell";
    ASTNodeTypes["TableCellExit"] = "TableCell:exit";
})(ASTNodeTypes = exports.ASTNodeTypes || (exports.ASTNodeTypes = {}));

},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTNodeTypes = void 0;
var ASTNodeTypes_1 = require("./ASTNodeTypes");
Object.defineProperty(exports, "ASTNodeTypes", { enumerable: true, get: function () { return ASTNodeTypes_1.ASTNodeTypes; } });

},{"./ASTNodeTypes":2}],4:[function(require,module,exports){
"use strict";
/*
  Copyright (C) 2014 Yusuke Suzuki <utatane.tea@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.binarySearch = exports.upperBound = exports.lowerBound = exports.compare = void 0;
function compare(v1, v2) {
    return v1 < v2;
}
exports.compare = compare;
function upperBound(array, value, comp = compare) {
    let len = array.length;
    let i = 0;
    while (len) {
        let diff = len >>> 1;
        let cursor = i + diff;
        if (comp(value, array[cursor])) {
            len = diff;
        }
        else {
            i = cursor + 1;
            len -= diff + 1;
        }
    }
    return i;
}
exports.upperBound = upperBound;
function lowerBound(array, value, comp = compare) {
    let len = array.length;
    let i = 0;
    while (len) {
        let diff = len >>> 1;
        let cursor = i + diff;
        if (comp(array[cursor], value)) {
            i = cursor + 1;
            len -= diff + 1;
        }
        else {
            len = diff;
        }
    }
    return i;
}
exports.lowerBound = lowerBound;
function binarySearch(array, value, comp = compare) {
    let cursor = lowerBound(array, value, comp);
    return cursor !== array.length && !comp(value, array[cursor]);
}
exports.binarySearch = binarySearch;
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],5:[function(require,module,exports){
(function (process){(function (){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLog = exports.nodeLog = exports.seekLog = void 0;
const isDebug = typeof process === "object" && process?.env?.DEBUG === "sentence-splitter";
function seekLog(offset, current) {
    if (!isDebug) {
        return;
    }
    console.log("sentence-splitter: " + offset, current);
}
exports.seekLog = seekLog;
function nodeLog(message, sourceCode) {
    if (!isDebug) {
        return;
    }
    if (!sourceCode) {
        console.log("sentence-splitter: " + message);
        return;
    }
    const currentNode = sourceCode.readNode();
    if (!currentNode) {
        console.log("sentence-splitter: " + message);
        return;
    }
    const RowLength = 50;
    const currentChar = (sourceCode.read() || "").replace(/\n/g, "\\n");
    const nodeValue = currentNode.raw.replace(/\n/g, "\\n");
    console.log("sentence-splitter: " +
        sourceCode.offset +
        " " +
        message +
        " |" +
        currentChar +
        "| " +
        " ".repeat(RowLength - currentChar.length - message.length) +
        nodeValue);
}
exports.nodeLog = nodeLog;
function debugLog(...message) {
    if (!isDebug) {
        return;
    }
    console.log("sentence-splitter: ", ...message.map((m) => {
        // make one line if it is multiline
        return typeof m === "string" ? m.replace(/\n/g, "\\n") : m;
    }));
}
exports.debugLog = debugLog;

}).call(this)}).call(this,require('_process'))
},{"_process":1}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbbrMarker = exports.DefaultOptions = void 0;
const English_js_1 = require("./lang/English.js");
const isCapitalized = (text) => {
    if (!text || text.length === 0) {
        return false;
    }
    return /^\p{Uppercase_Letter}/u.test(text);
};
const compareNoCaseSensitive = (a, b) => {
    return a.toLowerCase() === b.toLowerCase();
};
exports.DefaultOptions = {
    language: English_js_1.English
};
/**
 * abbreviation marker
 */
class AbbrMarker {
    options;
    lang;
    constructor(options) {
        this.options = options;
        this.lang = options && options.language ? options.language : exports.DefaultOptions.language;
    }
    /**
     * Get Word
     * word should have left space and right space,
     * @param {SourceCode} sourceCode
     * @param {number} startIndex
     * @returns {string}
     */
    getWord(sourceCode, startIndex = 0) {
        const whiteSpace = /\s/;
        const prevChar = sourceCode.read(-1);
        if (prevChar && !whiteSpace.test(prevChar)) {
            return "";
        }
        let word = "";
        let count = startIndex;
        let char = "";
        while ((char = sourceCode.read(count))) {
            if (whiteSpace.test(char)) {
                break;
            }
            word += char;
            count++;
        }
        return word;
    }
    getPrevWord(sourceCode) {
        const whiteSpace = /\s/;
        let count = -1;
        let char = "";
        while ((char = sourceCode.read(count))) {
            if (!whiteSpace.test(char)) {
                break;
            }
            count--;
        }
        while ((char = sourceCode.read(count))) {
            if (whiteSpace.test(char)) {
                break;
            }
            count--;
        }
        return this.getWord(sourceCode, count + 1);
    }
    mark(sourceCode) {
        if (sourceCode.isInContextRange()) {
            return;
        }
        const currentWord = this.getWord(sourceCode);
        if (currentWord.length === 0) {
            return;
        }
        // Allow: Multi-period abbr
        // Example: U.S.A
        if (/^([a-zA-Z]\.){3,}$/.test(currentWord)) {
            return sourceCode.markContextRange([sourceCode.offset, sourceCode.offset + currentWord.length]);
        }
        // EXCALAMATION_WORDS
        // Example: Yahoo!
        const isMatchedEXCALAMATION_WORDS = this.lang.EXCLAMATION_WORDS.some((abbr) => {
            return compareNoCaseSensitive(abbr, currentWord);
        });
        if (isMatchedEXCALAMATION_WORDS) {
            return sourceCode.markContextRange([sourceCode.offset, sourceCode.offset + currentWord.length]);
        }
        // PREPOSITIVE_ABBREVIATIONS
        // Example: Mr. Fuji
        const isMatchedPREPOSITIVE_ABBREVIATIONS = this.lang.PREPOSITIVE_ABBREVIATIONS.some((abbr) => {
            return compareNoCaseSensitive(abbr, currentWord);
        });
        const isMatchedLineIndexes = /^\d+\.$/.test(currentWord);
        if (isMatchedPREPOSITIVE_ABBREVIATIONS || isMatchedLineIndexes) {
            return sourceCode.markContextRange([sourceCode.offset, sourceCode.offset + currentWord.length]);
        }
        // ABBREVIATIONS
        const isMatched = this.lang.ABBREVIATIONS.some((abbr) => {
            return compareNoCaseSensitive(abbr, currentWord);
        });
        const prevWord = this.getPrevWord(sourceCode);
        const nextWord = this.getWord(sourceCode, currentWord.length + 1);
        // console.log("prevWord", prevWord);
        // console.log("currentWord", currentWord);
        // console.log("nextWord", nextWord);
        // Special case: Capital <ABBR>. Capital
        // Example: `I` as a sentence boundary and `I` as an abbreviation
        // > We make a good team, you and I. Did you see Albert I. Jones yesterday?
        // Related: https://github.com/azu/sentence-splitter/pull/31
        if (isCapitalized(prevWord) && /^\p{Uppercase_Letter}\./u.test(currentWord) && isCapitalized(nextWord)) {
            sourceCode.markContextRange([sourceCode.offset, sourceCode.offset + currentWord.length]);
        }
        else if (isMatched && !isCapitalized(nextWord)) {
            // Exception. This allows to write Capitalized word at next word
            // A.M. is store.
            sourceCode.markContextRange([sourceCode.offset, sourceCode.offset + currentWord.length]);
        }
    }
}
exports.AbbrMarker = AbbrMarker;

},{"./lang/English.js":13}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnyValueParser = void 0;
const logger_js_1 = require("../logger.js");
/**
 * Any value without `parsers`
 */
class AnyValueParser {
    parsers;
    markers;
    /**
     * Eat any value without `parsers.test`
     */
    constructor(options) {
        this.parsers = options.parsers;
        this.markers = options.markers;
    }
    test(sourceCode) {
        if (sourceCode.hasEnd) {
            return false;
        }
        return this.parsers.every((parser) => !parser.test(sourceCode));
    }
    seek(sourceCode) {
        const currentNode = sourceCode.readNode();
        if (!currentNode) {
            // Text mode
            while (this.test(sourceCode)) {
                this.markers.forEach((marker) => marker.mark(sourceCode));
                sourceCode.peek();
            }
            return;
        }
        // node - should not over next node
        const isInCurrentNode = () => {
            const currentOffset = sourceCode.offset;
            return currentNode.range[0] <= currentOffset && currentOffset < currentNode.range[1];
        };
        while (isInCurrentNode() && this.test(sourceCode)) {
            (0, logger_js_1.seekLog)(sourceCode.offset, sourceCode.read());
            this.markers.forEach((marker) => marker.mark(sourceCode));
            sourceCode.peek();
        }
    }
}
exports.AnyValueParser = AnyValueParser;

},{"../logger.js":5}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewLineParser = void 0;
/**
 * New Line Parser
 */
class NewLineParser {
    test(sourceCode) {
        const string = sourceCode.read();
        if (!string) {
            return false;
        }
        return /[\r\n]/.test(string);
    }
    seek(sourceCode) {
        while (this.test(sourceCode)) {
            sourceCode.peek();
        }
    }
}
exports.NewLineParser = NewLineParser;

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PairMaker = void 0;
const logger_js_1 = require("../logger.js");
const DEFAULT_PAIR_MARKS = [
    {
        key: "double quote",
        start: `"`,
        end: `"`
    },
    {
        key: "angled bracket",
        start: `[`,
        end: `]`
    },
    {
        key: "round bracket",
        start: `(`,
        end: `)`
    },
    {
        key: "curly brace",
        start: `{`,
        end: `}`
    },
    {
        key: "かぎ括弧",
        start: `「`,
        end: `」`
    },
    {
        key: "丸括弧",
        start: `（`,
        end: `）`
    },
    {
        key: "二重かぎ括弧",
        start: `『`,
        end: `』`
    },
    {
        key: "波括弧",
        start: `｛`,
        end: `｝`
    },
    {
        key: "角括弧",
        start: `［`,
        end: `］`
    },
    {
        key: "重角括弧",
        start: `〚`,
        end: `〛`
    },
    {
        key: "隅付き括弧",
        start: `【`,
        end: `】`
    },
    {
        key: "二重隅付き括弧",
        start: `《`,
        end: `》`
    }
];
/**
 * Mark pair character
 * PairMarker aim to mark pair string as a single sentence.
 *
 * For example, Following sentence has two period(。). but it should treat a single sentence
 *
 * > I hear "I'm back to home." from radio.
 *
 */
class PairMaker {
    PAIR_MARKS_KEY_Map = new Map(DEFAULT_PAIR_MARKS.flatMap((mark) => {
        return [
            [mark.start, mark],
            [mark.end, mark]
        ];
    }));
    mark(sourceCode) {
        const string = sourceCode.read();
        if (!string) {
            return;
        }
        const pairMark = this.PAIR_MARKS_KEY_Map.get(string);
        if (!pairMark) {
            return;
        }
        // if current is in a context, should not start other context.
        // PairMaker does not support nest context by design.
        if (!sourceCode.isInContext(pairMark)) {
            const isStart = pairMark.start === string;
            if (isStart) {
                (0, logger_js_1.debugLog)(`PairMaker -> enterContext: ${string} `);
                sourceCode.enterContext(pairMark);
            }
        }
        else {
            const isEnd = pairMark.end === string;
            // check that string is end mark?
            if (isEnd) {
                (0, logger_js_1.debugLog)(`PairMaker -> leaveContext: ${string} `);
                sourceCode.leaveContext(pairMark);
            }
        }
    }
}
exports.PairMaker = PairMaker;

},{"../logger.js":5}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparatorParser = exports.DefaultOptions = void 0;
exports.DefaultOptions = {
    separatorCharacters: [
        ".", // period
        "．", // (ja) zenkaku-period
        "。", // (ja) 句点
        "?", // question mark
        "!", //  exclamation mark
        "？", // (ja) zenkaku question mark
        "！" // (ja) zenkaku exclamation mark
    ]
};
/**
 * Separator parser
 */
class SeparatorParser {
    options;
    separatorCharacters;
    constructor(options) {
        this.options = options;
        this.separatorCharacters =
            options && options.separatorCharacters ? options.separatorCharacters : exports.DefaultOptions.separatorCharacters;
    }
    test(sourceCode) {
        if (sourceCode.isInContext()) {
            return false;
        }
        if (sourceCode.isInContextRange()) {
            return false;
        }
        const firstChar = sourceCode.read();
        const nextChar = sourceCode.read(1);
        if (!firstChar) {
            return false;
        }
        if (!this.separatorCharacters.includes(firstChar)) {
            return false;
        }
        // Need space after period
        // Example: "This is a pen. This is not a pen."
        // It will avoid false-position like `1.23`
        if (firstChar === ".") {
            if (nextChar) {
                return /[\s\t\r\n]/.test(nextChar);
            }
            else {
                return true;
            }
        }
        return true;
    }
    seek(sourceCode) {
        while (this.test(sourceCode)) {
            sourceCode.peek();
        }
    }
}
exports.SeparatorParser = SeparatorParser;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceCode = void 0;
const structured_source_1 = require("structured-source");
const findLastIndex = (array, predicate) => {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i], i, array)) {
            return i;
        }
    }
    return -1;
};
class SourceCode {
    index = 0;
    source;
    textCharacters;
    sourceNode;
    // active context
    contexts = [];
    // These context is consumed
    // It is used for attaching context to AST
    consumedContexts = [];
    contextRanges = [];
    firstChildPadding;
    startOffset;
    constructor(input) {
        if (typeof input === "string") {
            this.textCharacters = input.split("");
            this.source = new structured_source_1.StructuredSource(input);
            this.startOffset = 0;
            this.firstChildPadding = 0;
        }
        else {
            this.sourceNode = input;
            // When pass AST, fist node may be >=
            // Preserve it as `startOffset`
            this.startOffset = this.sourceNode.range[0];
            // start index is startOffset
            this.index = this.startOffset;
            // before line count of Paragraph node
            const lineBreaks = Array.from(new Array(this.sourceNode.loc.start.line - 1)).fill("\n");
            // filled with dummy text( range[0] - lineBreaks.length = empty space should be filled)
            const firstOffset = Array.from(new Array(this.startOffset - lineBreaks.length)).fill("∯");
            const inputCharacters = input.raw.split("");
            this.textCharacters = [...lineBreaks, ...firstOffset, ...inputCharacters];
            this.source = new structured_source_1.StructuredSource(this.textCharacters.join(""));
            if (this.sourceNode.children[0]) {
                // Header Node's children does not start with index 0
                // Example: # Header
                // It firstChildPadding is `2`
                this.firstChildPadding = this.sourceNode.children[0].range[0] - this.startOffset;
            }
            else {
                this.firstChildPadding = 0;
            }
        }
    }
    get length() {
        return this.textCharacters.length;
    }
    // range mark is for abbreviation
    markContextRange(range) {
        this.contextRanges.push(range);
    }
    isInContextRange() {
        const offset = this.offset;
        return this.contextRanges.some((range) => {
            return range[0] <= offset && offset < range[1];
        });
    }
    // context is for pair mark
    enterContext(pairMark) {
        this.contexts.push([pairMark, this.index]);
    }
    isInContext(pairMark) {
        if (!pairMark) {
            return this.contexts.length > 0;
        }
        return this.contexts.some((targetContext) => targetContext[0].key === pairMark.key);
    }
    leaveContext(pairMark) {
        const index = findLastIndex(this.contexts, (context) => context[0].key === pairMark.key);
        if (index !== -1) {
            const consumed = this.contexts[index];
            this.contexts.splice(index, 1);
            const range = [consumed[1], this.index];
            this.consumedContexts.push({
                pairMark: consumed[0],
                range: [consumed[1], this.index],
                loc: this.source.rangeToLocation(range)
            });
        }
    }
    /**
     * Return current offset value
     * @returns {number}
     */
    get offset() {
        return this.index + this.firstChildPadding;
    }
    /**
     * Return current position object.
     * It includes line, column, offset.
     */
    now() {
        const indexWithChildrenOffset = this.offset;
        const position = this.source.indexToPosition(indexWithChildrenOffset);
        return {
            line: position.line,
            column: position.column,
            offset: indexWithChildrenOffset
        };
    }
    /**
     * Return true, no more read char
     */
    get hasEnd() {
        return this.read() === false;
    }
    /**
     * read char
     * if can not read, return empty string
     * @returns {string}
     */
    read(over = 0) {
        const index = this.offset + over;
        if (index < this.startOffset) {
            return false;
        }
        if (0 <= index && index < this.textCharacters.length) {
            return this.textCharacters[index];
        }
        return false;
    }
    /**
     * read node
     * if can not read, return empty string
     * @returns {node}
     */
    readNode(over = 0) {
        if (!this.sourceNode) {
            return false;
        }
        const index = this.offset + over;
        if (index < this.startOffset) {
            return false;
        }
        const matchNodeList = this.sourceNode.children.filter((node) => {
            // <p>[node]</p>
            //         ^
            //        range[1]
            // `< range[1]` prevent infinity loop
            // https://github.com/azu/sentence-splitter/issues/9
            return node.range[0] <= index && index < node.range[1];
        });
        if (matchNodeList.length > 0) {
            // last match
            // because, range is overlap two nodes
            return matchNodeList[matchNodeList.length - 1];
        }
        return false;
    }
    /**
     * Increment current index
     */
    peek() {
        this.index += 1;
    }
    /**
     * Increment node range
     */
    peekNode(node) {
        this.index += node.range[1] - node.range[0];
    }
    /**
     * Seek and Peek
     */
    seekNext(parser) {
        const startPosition = this.now();
        parser.seek(this);
        const endPosition = this.now();
        const value = this.sliceRange(startPosition.offset, endPosition.offset);
        return {
            value,
            startPosition,
            endPosition
        };
    }
    /**
     * Slice text form the range.
     * @param {number} start
     * @param {number} end
     * @returns {string}
     */
    sliceRange(start, end) {
        return this.textCharacters.slice(start, end).join("");
    }
}
exports.SourceCode = SourceCode;

},{"structured-source":15}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpaceParser = void 0;
/**
 * Space parser
 */
class SpaceParser {
    test(sourceCode) {
        const string = sourceCode.read();
        if (!string) {
            return false;
        }
        // space without new line
        return /[^\S\n\r]/.test(string);
    }
    seek(sourceCode) {
        while (this.test(sourceCode)) {
            sourceCode.peek();
        }
    }
}
exports.SpaceParser = SpaceParser;

},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.English = void 0;
exports.English = {
    ABBREVIATIONS: [
        "Adj.",
        "Adm.",
        "Adv.",
        "Al.",
        "Ala.",
        "Alta.",
        "Apr.",
        "Arc.",
        "Ariz.",
        "Ark.",
        "Art.",
        "Assn.",
        "Asst.",
        "Attys.",
        "Aug.",
        "Ave.",
        "Bart.",
        "Bld.",
        "Bldg.",
        "Blvd.",
        "Brig.",
        "Bros.",
        "Btw.",
        "Cal.",
        "Calif.",
        "Capt.",
        "Cl.",
        "Cmdr.",
        "Co.",
        "Col.",
        "Colo.",
        "Comdr.",
        "Con.",
        "Conn.",
        "Corp.",
        "Cpl.",
        "Cres.",
        "Ct.",
        "D.phil.",
        "Dak.",
        "Dec.",
        "Del.",
        "Dept.",
        "Det.",
        "Dist.",
        "Dr.",
        "Dr.phil.",
        "Dr.philos.",
        "Drs.",
        "E.g.",
        "Ens.",
        "Esp.",
        "Esq.",
        "Etc.",
        "Exp.",
        "Expy.",
        "Ext.",
        "Feb.",
        "Fed.",
        "Fla.",
        "Ft.",
        "Fwy.",
        "Fy.",
        "Ga.",
        "Gen.",
        "Gov.",
        "Hon.",
        "Hosp.",
        "Hr.",
        "Hway.",
        "Hwy.",
        "I.e.",
        "Ia.",
        "Id.",
        "Ida.",
        "Ill.",
        "Inc.",
        "Ind.",
        "Ing.",
        "Insp.",
        "Is.",
        "Jan.",
        "Jr.",
        "Jul.",
        "Jun.",
        "Kan.",
        "Kans.",
        "Ken.",
        "Ky.",
        "La.",
        "Lt.",
        "Ltd.",
        "Maj.",
        "Man.",
        "Mar.",
        "Mass.",
        "May.",
        "Md.",
        "Me.",
        "Med.",
        "Messrs.",
        "Mex.",
        "Mfg.",
        "Mich.",
        "Min.",
        "Minn.",
        "Miss.",
        "Mlle.",
        "Mm.",
        "Mme.",
        "Mo.",
        "Mont.",
        "Mr.",
        "Mrs.",
        "Ms.",
        "Msgr.",
        "Mssrs.",
        "Mt.",
        "Mtn.",
        "Neb.",
        "Nebr.",
        "Nev.",
        "No.",
        "Nos.",
        "Nov.",
        "Nr.",
        "Oct.",
        "Ok.",
        "Okla.",
        "Ont.",
        "Op.",
        "Ord.",
        "Ore.",
        "P.",
        "Pa.",
        "Pd.",
        "Pde.",
        "Penn.",
        "Penna.",
        "Pfc.",
        "Ph.",
        "Ph.d.",
        "Pl.",
        "Plz.",
        "Pp.",
        "Prof.",
        "Pvt.",
        "Que.",
        "Rd.",
        "Rs.",
        "Ref.",
        "Rep.",
        "Reps.",
        "Res.",
        "Rev.",
        "Rt.",
        "Sask.",
        "Sec.",
        "Sen.",
        "Sens.",
        "Sep.",
        "Sept.",
        "Sfc.",
        "Sgt.",
        "Sr.",
        "St.",
        "Supt.",
        "Surg.",
        "Tce.",
        "Tenn.",
        "Tex.",
        "Univ.",
        "Usafa.",
        "U.S.",
        "Ut.",
        "Va.",
        "V.",
        "Ver.",
        "Vs.",
        "Vt.",
        "Wash.",
        "Wis.",
        "Wisc.",
        "Wy.",
        "Wyo.",
        "Yuk."
    ],
    PREPOSITIVE_ABBREVIATIONS: [
        "Adm.",
        "Attys.",
        "Brig.",
        "Capt.",
        "Cmdr.",
        "Col.",
        "Cpl.",
        "Det.",
        "Dr.",
        "Gen.",
        "Gov.",
        "Ing.",
        "Lt.",
        "Maj.",
        "Mr.",
        "Mrs.",
        "Ms.",
        "Mt.",
        "Messrs.",
        "Mssrs.",
        "Prof.",
        "Ph.",
        "Rep.",
        "Reps.",
        "Rev.",
        "Sen.",
        "Sens.",
        "Sgt.",
        "St.",
        "Supt.",
        "V.",
        "Vs."
    ],
    EXCLAMATION_WORDS: [
        "!Xũ",
        "!Kung",
        "ǃʼOǃKung",
        "!Xuun",
        "!Kung-Ekoka",
        "ǃHu",
        "ǃKhung",
        "ǃKu",
        "ǃung",
        "ǃXo",
        "ǃXû",
        "ǃXung",
        "ǃXũ",
        "!Xun",
        "Yahoo!",
        "Y!J",
        "Yum!"
    ]
};

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitAST = exports.split = exports.DefaultSentenceSplitterOptions = exports.DefaultAbbrMarkerOptions = exports.SentenceSplitterSyntax = void 0;
const ast_node_types_1 = require("@textlint/ast-node-types");
const SourceCode_js_1 = require("./parser/SourceCode.js");
const NewLineParser_js_1 = require("./parser/NewLineParser.js");
const SpaceParser_js_1 = require("./parser/SpaceParser.js");
const SeparatorParser_js_1 = require("./parser/SeparatorParser.js");
Object.defineProperty(exports, "DefaultSentenceSplitterOptions", { enumerable: true, get: function () { return SeparatorParser_js_1.DefaultOptions; } });
const AnyValueParser_js_1 = require("./parser/AnyValueParser.js");
const AbbrMarker_js_1 = require("./parser/AbbrMarker.js");
Object.defineProperty(exports, "DefaultAbbrMarkerOptions", { enumerable: true, get: function () { return AbbrMarker_js_1.DefaultOptions; } });
const PairMaker_js_1 = require("./parser/PairMaker.js");
const logger_js_1 = require("./logger.js");
exports.SentenceSplitterSyntax = {
    WhiteSpace: "WhiteSpace",
    Punctuation: "Punctuation",
    Sentence: "Sentence",
    Str: "Str",
    PairMark: "PairMark"
};
class SplitParser {
    sentenceNodeList = [];
    results = [];
    source;
    constructor(text) {
        this.source = new SourceCode_js_1.SourceCode(text);
    }
    get current() {
        return this.sentenceNodeList[this.sentenceNodeList.length - 1];
    }
    pushNodeToCurrent(node) {
        const current = this.current;
        if (current) {
            current.children.push(node);
        }
        else {
            // Under the root
            this.results.push(node);
        }
    }
    // open with ParentNode
    open(parentNode) {
        this.sentenceNodeList.push(parentNode);
    }
    isOpened() {
        return this.sentenceNodeList.length > 0;
    }
    nextLine(parser) {
        const { value, startPosition, endPosition } = this.source.seekNext(parser);
        this.pushNodeToCurrent(createWhiteSpaceNode(value, startPosition, endPosition));
        return endPosition;
    }
    nextSpace(parser) {
        const { value, startPosition, endPosition } = this.source.seekNext(parser);
        this.pushNodeToCurrent(createWhiteSpaceNode(value, startPosition, endPosition));
    }
    nextValue(parser) {
        const { value, startPosition, endPosition } = this.source.seekNext(parser);
        this.pushNodeToCurrent(createTextNode(value, startPosition, endPosition));
    }
    // close current Node and remove it from list
    close(parser) {
        const { value, startPosition, endPosition } = this.source.seekNext(parser);
        // rest of the value is Punctuation
        // Except for the case of the last character of the value is a space
        // See "space-first-and-space-last" test case
        if (startPosition.offset !== endPosition.offset && !/^\s+$/.test(value)) {
            this.pushNodeToCurrent(createPunctuationNode(value, startPosition, endPosition));
        }
        const currentNode = this.sentenceNodeList.pop();
        if (!currentNode) {
            return;
        }
        if (currentNode.children.length === 0) {
            return;
        }
        const firstChildNode = currentNode.children[0];
        const endNow = this.source.now();
        // update Sentence node's location and range
        const rawValue = this.source.sliceRange(firstChildNode.range[0], endNow.offset);
        const contexts = this.source.consumedContexts
            .sort((a, b) => {
            return a.range[0] - b.range[0];
        })
            .map((context) => {
            return {
                type: "PairMark",
                pairMark: context.pairMark,
                range: context.range,
                loc: context.loc
            };
        });
        this.results.push({
            ...currentNode,
            loc: {
                start: firstChildNode.loc.start,
                end: {
                    line: endNow.line,
                    column: endNow.column
                }
            },
            range: [firstChildNode.range[0], endNow.offset],
            raw: rawValue,
            contexts: contexts
        });
    }
    toList() {
        return this.results;
    }
}
const createParsers = (options = {}) => {
    const newLine = new NewLineParser_js_1.NewLineParser();
    const space = new SpaceParser_js_1.SpaceParser();
    const separator = new SeparatorParser_js_1.SeparatorParser(options.SeparatorParser);
    const abbrMarker = new AbbrMarker_js_1.AbbrMarker(options.AbbrMarker);
    const pairMaker = new PairMaker_js_1.PairMaker();
    // anyValueParser has multiple parser and markers.
    // anyValueParse eat any value if it reaches to other value.
    const anyValueParser = new AnyValueParser_js_1.AnyValueParser({
        parsers: [newLine, separator],
        markers: [abbrMarker, pairMaker]
    });
    return {
        newLine,
        space,
        separator,
        abbrMarker,
        anyValueParser
    };
};
/**
 * split `text` into Sentence nodes
 */
function split(text, options) {
    const { newLine, space, separator, anyValueParser } = createParsers(options);
    const splitParser = new SplitParser(text);
    const sourceCode = splitParser.source;
    while (!sourceCode.hasEnd) {
        if (newLine.test(sourceCode)) {
            splitParser.nextLine(newLine);
        }
        else if (space.test(sourceCode)) {
            splitParser.nextSpace(space);
        }
        else if (separator.test(sourceCode)) {
            splitParser.close(separator);
        }
        else {
            if (!splitParser.isOpened()) {
                splitParser.open(createEmptySentenceNode());
            }
            splitParser.nextValue(anyValueParser);
        }
    }
    splitParser.close(space);
    return splitParser.toList();
}
exports.split = split;
window.splitSentences = split
/**
 * Convert Paragraph Node to Paragraph node that convert children to Sentence node
 * This Node is based on TxtAST.
 * See https://github.com/textlint/textlint/blob/master/docs/txtnode.md
 */
function splitAST(paragraphNode, options) {
    const { newLine, space, separator, anyValueParser } = createParsers(options);
    const splitParser = new SplitParser(paragraphNode);
    const sourceCode = splitParser.source;
    while (!sourceCode.hasEnd) {
        const currentNode = sourceCode.readNode();
        if (!currentNode) {
            break;
        }
        if (currentNode.type === ast_node_types_1.ASTNodeTypes.Str) {
            if (space.test(sourceCode)) {
                (0, logger_js_1.nodeLog)("space", sourceCode);
                splitParser.nextSpace(space);
            }
            else if (separator.test(sourceCode)) {
                (0, logger_js_1.nodeLog)("separator", sourceCode);
                splitParser.close(separator);
            }
            else if (newLine.test(sourceCode)) {
                (0, logger_js_1.nodeLog)("newline", sourceCode);
                splitParser.nextLine(newLine);
            }
            else {
                if (!splitParser.isOpened()) {
                    (0, logger_js_1.nodeLog)("open -> createEmptySentenceNode()");
                    splitParser.open(createEmptySentenceNode());
                }
                (0, logger_js_1.nodeLog)("other str value", sourceCode);
                splitParser.nextValue(anyValueParser);
            }
        }
        else if (currentNode.type === ast_node_types_1.ASTNodeTypes.Break) {
            (0, logger_js_1.nodeLog)("break", sourceCode);
            // Break
            // https://github.com/azu/sentence-splitter/issues/23
            splitParser.pushNodeToCurrent(currentNode);
            sourceCode.peekNode(currentNode);
        }
        else {
            if (!splitParser.isOpened()) {
                (0, logger_js_1.nodeLog)("open -> createEmptySentenceNode()");
                splitParser.open(createEmptySentenceNode());
            }
            (0, logger_js_1.nodeLog)("other node", sourceCode);
            splitParser.pushNodeToCurrent(currentNode);
            sourceCode.peekNode(currentNode);
        }
    }
    (0, logger_js_1.nodeLog)("end separator");
    // It follow some text that is not ended with period.
    // TODO: space is correct?
    splitParser.close(space);
    return {
        ...paragraphNode,
        children: splitParser.toList()
    };
}
exports.splitAST = splitAST;
/**
 * WhiteSpace is space or linebreak
 */
function createWhiteSpaceNode(text, startPosition, endPosition) {
    return {
        type: exports.SentenceSplitterSyntax.WhiteSpace,
        raw: text,
        value: text,
        loc: {
            start: {
                line: startPosition.line,
                column: startPosition.column
            },
            end: {
                line: endPosition.line,
                column: endPosition.column
            }
        },
        range: [startPosition.offset, endPosition.offset]
    };
}
function createPunctuationNode(text, startPosition, endPosition) {
    return {
        type: exports.SentenceSplitterSyntax.Punctuation,
        raw: text,
        value: text,
        loc: {
            start: {
                line: startPosition.line,
                column: startPosition.column
            },
            end: {
                line: endPosition.line,
                column: endPosition.column
            }
        },
        range: [startPosition.offset, endPosition.offset]
    };
}
function createTextNode(text, startPosition, endPosition) {
    return {
        type: exports.SentenceSplitterSyntax.Str,
        raw: text,
        value: text,
        loc: {
            start: {
                line: startPosition.line,
                column: startPosition.column
            },
            end: {
                line: endPosition.line,
                column: endPosition.column
            }
        },
        range: [startPosition.offset, endPosition.offset]
    };
}
function createEmptySentenceNode() {
    return {
        type: exports.SentenceSplitterSyntax.Sentence,
        raw: "",
        loc: {
            start: { column: NaN, line: NaN },
            end: { column: NaN, line: NaN }
        },
        range: [NaN, NaN],
        children: [],
        contexts: []
    };
}

},{"./logger.js":5,"./parser/AbbrMarker.js":6,"./parser/AnyValueParser.js":7,"./parser/NewLineParser.js":8,"./parser/PairMaker.js":9,"./parser/SeparatorParser.js":10,"./parser/SourceCode.js":11,"./parser/SpaceParser.js":12,"@textlint/ast-node-types":3}],15:[function(require,module,exports){
"use strict";
/*
  Copyright (C) 2014 Yusuke Suzuki <utatane.tea@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredSource = void 0;
const boundary_1 = require("boundary");
/**
 * StructuredSource
 */
class StructuredSource {
    /**
     * @constructs StructuredSource
     * @param {string} source - source code text.
     */
    constructor(source) {
        this.indice = [0];
        let regexp = /[\r\n\u2028\u2029]/g;
        const length = source.length;
        regexp.lastIndex = 0;
        while (true) {
            let result = regexp.exec(source);
            if (!result) {
                break;
            }
            let index = result.index;
            if (source.charCodeAt(index) === 0x0D /* '\r' */ &&
                source.charCodeAt(index + 1) === 0x0A /* '\n' */) {
                index += 1;
            }
            let nextIndex = index + 1;
            // If there's a last line terminator, we push it to the indice.
            // So use < instead of <=.
            if (length < nextIndex) {
                break;
            }
            this.indice.push(nextIndex);
            regexp.lastIndex = nextIndex;
        }
    }
    get line() {
        return this.indice.length;
    }
    /**
     * @param {SourceLocation} loc - location indicator.
     * @return {[ number, number ]} range.
     */
    locationToRange(loc) {
        return [this.positionToIndex(loc.start), this.positionToIndex(loc.end)];
    }
    /**
     * @param {[ number, number ]} range - pair of indice.
     * @return {SourceLocation} location.
     */
    rangeToLocation(range) {
        return {
            start: this.indexToPosition(range[0]),
            end: this.indexToPosition(range[1])
        };
    }
    /**
     * @param {SourcePosition} pos - position indicator.
     * @return {number} index.
     */
    positionToIndex(pos) {
        // Line number starts with 1.
        // Column number starts with 0.
        let start = this.indice[pos.line - 1];
        return start + pos.column;
    }
    /**
     * @param {number} index - index to the source code.
     * @return {SourcePosition} position.
     */
    indexToPosition(index) {
        const startLine = (0, boundary_1.upperBound)(this.indice, index);
        return {
            line: startLine,
            column: index - this.indice[startLine - 1]
        };
    }
}
exports.StructuredSource = StructuredSource;
/* vim: set sw=4 ts=4 et tw=80 : */

},{"boundary":4}]},{},[14]);
