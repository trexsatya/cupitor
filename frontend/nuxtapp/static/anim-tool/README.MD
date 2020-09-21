Remember these points while writing animation scripts:
1. Draw the stage first by hand
2. Fix the positions in advance
3. Create functions for small chunks of script
4. Don't depend on manual time adjustment
5. Group actions



Useful functions:
```
playCode(``)

{
    $('#horizRuler,#vertRuler,#item-variables').hide();
    _.clearText = () => { $(".text").velocity("fadeOut"); $(".text").remove(); };

    record();
    return 4
},

bringInText("We are going to solve <strong>Knapsack Problem</strong>. See the problem details in the description below!", {to: {left: 100, top: 100}})

createTextBox("weight=2<br>value=9", {left: 100, top: 340, background: 'green', color: 'white', height: 40})

_createMatrix({ data: "[2, 3, 4, 6], [9, 4, 16, 30]", size: '500,200', yheaders: `"Weights", "Values"`, xtitle: 'Items', ytitle: '.', location: '100,100' });

typeQuote("Now let's see how we can solve this", { theme: 'white', css: {top: 200, left: 650, fontSize: 'larger', position: 'absolute'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

_.A.animate({top: 100, left: 100})

{
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 225,
        left: 200
      }, 1000, ()=> {
        x.html("AB<hr>w=5<br>v=23")
        x.css({ background: 'green'})
        _.AB = x
      })
    })
    ;
    return 3
},

_.aro = createTextBox("⬇", {fontSize: '3em', left: 90, top: 180})


record()
pause()
stop()

```
