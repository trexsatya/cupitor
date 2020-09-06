function typeQuote(text, _options) {
  let options = Object.assign({}, {
    wait: 0,
    theme: 'black',
    onComplete: () => {},
    css: {  }}, _options);

  if(Object.keys(options.css).length > 0) {
    options.css.position = 'absolute'
    options.css.marginTop = 0
  }

  let textillateContainer = $('#textillateContainer');
  let savedCssTC = {
      zIndex: textillateContainer.css('z-index'),
      color: textillateContainer.css('color'),
      backgroundColor:  textillateContainer.css('backgroundColor'),
      font: textillateContainer.css('font'),
      top: textillateContainer.css('top'),
      left: textillateContainer.css('left')
    }

  let cinemaText = $('#cinemaText');
  let savedCssCT = {
      zIndex: cinemaText.css('z-index'),
      color: cinemaText.css('color'),
      backgroundColor:  cinemaText.css('backgroundColor'),
      font: cinemaText.css('font'),
      top: cinemaText.css('top'),
      left: cinemaText.css('left'),
      marginTop: cinemaText.css('marginTop')
    }

    let cinemaHtml = cinemaText.html()

    if(options.theme === 'black') {
        textillateContainer.css({ backgroundColor: '#1a1a1a', zIndex: 900000})
        cinemaText.css({ color: 'white'})
    }
    cinemaText.css(options.css)

    let start = new Date().getTime();

    return type(text, '#cinemaText', { onComplete: (self) => {
        setTimeout(()=> {
          console.log("typed in " + (new Date().getTime() - start)/1000 + "secs")
          textillateContainer.css(savedCssTC);
          
          // self.destroy();
          if(window.spaceCommand != 'start') { //if not paused
            cinemaText.css(savedCssCT);
            cinemaText.html(cinemaHtml);
            options.onComplete();  
          }
          window.typing = null;
        }, options.wait * 1000)
    }})
}

function typeAndDisappear(text, opts) {
  let options = Object.assign({}, {wait: 100}, opts);

  let id = "T"+new Date().getTime();
  // id = "cinemaText"
  let T = createTextBox('', opts).attr('id', id)

  window.id = id
  return id
}


function type(strings, elSelector, opts) {
  var options = Object.assign({}, {
    strings: [strings].flat(),
    onComplete: (self) => {}
  }, opts);

  $('#typed-strings').html("<p>"+strings+ "</p>")

  let prettyLog = (x) => console.log(x);

  var typed = new Typed(elSelector, {
    strings: options.strings,
    typeSpeed: 30,
    backSpeed: 0,
    backDelay: 500,
    startDelay: 1000,
    loop: false,
    onComplete: function(self) {
        // prettyLog('onCmplete ' + self); self.destroy();
       options.onComplete(self);
    },
    onDestroy: function(self) {
      console.log("destroyed")
    }

  });
  return typed;
}

function Scheduler(){
  let animationScriptFunction = null
  let paused = false;

  let scheduler = this;
  let step = 0;
  /**
  * taskRunner => a function that will use data items.
  * data => array of data items or array of functions. If data item is a function it will be used as taskRunner for that interval.
  *     taskRunner can return false to stop the further invocations. taskRunner can return time delay in seconds before next invocation occurs.
  *     taskRunner can return 'WAIT_FOR_SIGNAL' which means that next invocation will occur only when signal is received.
  */
  let fn = null;

  function schedule(data, timeInSeconds, taskRunner, options) {
    options = Object.assign({}, {
      onComplete: () => {},
      onStep: () => {}
    },options);

    data = data.map(x => x); //clone
    
    fn = (x) => setTimeout(stepFunction, x);

    let carryStep = (result, fn) => {
      if(result !== false) {
        let delay = timeInSeconds*1000
        if(typeof(result) == 'number') delay = result * 1000

        if(result ===  -1) {
          paused = true;
        } else {
          fn(delay)
        }
      
      } else {
        console.log("Ended because function returned false!")
      }

    }; //end carryStep

    let stepFunction = null;

    stepFunction = () => {
       if(paused) {
         setTimeout(() => stepFunction(), 1);
         return
       }

       let first = data[step];
       if(first) {
         let task = typeof(first) == 'function' ? first : () => taskRunner(first)
         let result = task()
         options.onStep(step);
         carryStep(result, fn);
         step++;
       } else {
         options.onComplete();
       }
    }; //step function end

    fn(0);

    return scheduler;
  };

  return {
    schedule: schedule,
    pause: () => paused = true,
    resume: () => { if(!paused) return; paused = false; fn(0); },
    setStep: (num) => { step = num; }
  } 
}




function resumeAnimationScript() {
  if(!window.animationScriptFunction) {
    console.log("No animation function!!!")
    return
  }
  window.animationScriptFunction()
  window.animationScriptFunction = null
  $('#btnResumeAnimation').hide();
}

function includeScript(src, id){
  let el = document.createElement("script");
  el.src = src;
  if(id) el.id = id;
  document.head.append(el);
}

function fetchContentToRead(url) {
  return fetch("/reader-api?url="+url)
}


function splitIntoSentences(str) {
  return str.replace(/([.?!])\s*(?=[A-Z])/g, "$1|").split("|");
}

// includeScript("http://localhost:3000/anim-tool/jquery.min.js")
// includeScript("http://localhost:3000/reader/index.js")
// includeScript("http://localhost:3000/anim-tool/typed.min.js")

// let currentItem = $("h2:contains('INTRODUCTION')")
// tasks = [...new Array(100).keys()].map(x => { currentItem = currentItem.next(); return -1 })

// typeQuote("And you'll see that it either comes from top", { theme: 'black', css: {top: 100, left: 450, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});

window.spaceCommand = 'stop';

// $('#controls-container').



function readFromURL(url){
  fetchContentToRead(url).then(x => x.json()).then(x => {
     let els = $.parseHTML(x.rawText);

     let texts = els.map(x => {
      return {
        tag: x.tagName,
        text: $(x).text().trim(),
        el: $(x)
      }
     }).filter(x => {
        return !(x.tag == 'STYLE' || x.tag == 'SCRIPT')
               && x.text.length > 0
     });

     texts = texts.map(x => splitIntoSentences(x.text).map(y => ({tag: x.tag, text: y, el: x.el}))).flat();


     let sched = new Scheduler();

     sched.schedule(texts, -1, (x) => {
       if(x.tag == 'TABLE') {
         $('#cinemaText').html(x.el.html());
         return 10;
       }
       
       if(window.typing) {
        window.typing.destroy();
       }

       let waitTime = str => {
          return 3*(str.length/200);
       }

       window.typing = typeQuote(
                        x.text, 
                        { 
                          wait: waitTime(x.text), 
                          onComplete: ()=> { sched.resume(); }
                        });
       return -1
     },
     {
      onStep: x => { 
        $( "#slider" ).slider("value", x); 
        
        $("#slider-value").text(x + " of " + texts.length);
      }
     });//end schedule

     let stopTyping = () => {
        if(window.typing) {
          window.typing.stop();
          
        } else {
          sched.pause();
        }
        $('#stopBtn').hide();
        $('#startBtn').show();
        window.spaceCommand = 'start'
     };

     let startTyping = () => {
        if(window.typing) {
          window.typing.start();
        } else {
          let cinemaText = $('#cinemaText');
          cinemaText.html('');
          sched.resume();
        }
        $('#stopBtn').show();
        $('#startBtn').hide();
        window.spaceCommand = 'stop'
     };

     $('#stopBtn').show();
     $('#stopBtn')[0].onclick = e => {
        stopTyping();
        e.preventDefault();
     }

     $('#startBtn')[0].onclick = e => {
        startTyping();
        e.preventDefault();
     };

     document.onkeypress = e => {
        let code = e.code
        if(code == 'Space') {
          if(window.typing) {
            if(window.spaceCommand == 'stop') {
              stopTyping();
            } else {
              startTyping();
            }
          }
          e.preventDefault();
          return false;
        }
        return true;
     }



     $( "#slider" ).slider({
        range: false,
        max: texts.length,
        min: 1,
        slide: function( event, ui ) {
          if(window.typing) {
            window.typing.destroy();
            window.typing = null;
            $('#cinemaText').html('')
            sched.resume();
          }
          sched.setStep(ui.value);
          
          $("#slider-value").text(ui.value + " of " + texts.length);
        }
     });
  });
}

