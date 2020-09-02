function playCode1(){
  playCode(`



def simple_solution(limit, weights, values):
    possible_ways = []
    maximum = 0

    for i, weight in enumerate(weights):
        more_ways = []
        for way in possible_ways:
            if weight + way[0] <= limit:
                more_ways.append([weight + way[0],
                                 values[i] + way[1]])
                # Append the current item
                maximum = max(maximum, values[i] + way[1])

        if weight <= limit:
            more_ways.append([weight, values[i]])
            maximum = max(maximum, values[i])

        possible_ways.extend(more_ways)

    return maximum

`)
}

function playCode2() {
  playCode(`


def matrix_based_solution(limit, item_weights, values):

    # Prepare matrix
    matrix = [0 for i in item_weights]
    for i, row in enumerate(matrix):
        matrix[i] = [0]*(limit+2)

    maximum = 0
    for i, cost in enumerate(item_weights[:]):
        for wt in range(1, limit+1):
            if wt == cost:
                matrix[i][cost] = values[i]

            matrix[i][wt] = max(matrix[i][wt],
                                matrix[i-1][wt])  # From top

            if matrix[i-1][wt]:
                add_forward_at_proper_place(
                    matrix[i-1][wt] + values[i],
                    i,
                    wt + cost,
                    matrix)

            maximum = max(maximum, matrix[i][wt])

    return maximum

def add_forward_at_proper_place(num, row, col, matrix):
    if 0 <= row < len(matrix) and 0 <= col < len(matrix[0]):
        if matrix[row][col] < num:
            matrix[row][col] = num
`)
}

function playCode3() {
  playCode(`


  def matrix_based_solution2(limit, weights, values):
    # Prepare matrix
    K = [[0 for x in range(limit + 1)] for x in range(len(weights) + 1)]

    for i in range(len(weights)):
        if weights[i] < limit:
            K[i][weights[i]] = values[i]

        for w in range(limit + 1):
            if weights[i] <= limit and w == weights[i]:
                K[i][w] = max(K[i][w], values[i])

            # From top cell
            K[i][w] = max(K[i][w], K[i-1][w])

            if w - weights[i] >= 0:
                K[i][w] = max(
                    # From top left
                    values[i] + K[i-1][w - weights[i]],
                    K[i][w]
                )

    return K[n-1][limit]

    # Done! We now have 3 different solutions for this problem!
  `)
}

tasks = [
  () => {
    $('#horizRuler,#vertRuler,#item-variables').hide();
    _.clearText = () => { $(".text").velocity("fadeOut"); $(".text").remove(); };

    record();
    return 4
  },
  () => {
    typeQuote("Problems are themselves the best guide to solutions. The only thing you need to do is pay attention to the details of the problem. Other things come with experience.", { wait: 5, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    _.BT1 = bringInText("We are going to solve <strong>Knapsack Problem</strong>. See the problem details in the description below!", {to: {left: 100, top: 100}})
    return 5
  },
  () => {
    _.BT2 = bringInText("You have a bag that can hold <strong>only W kilogram of weight at max </strong>. Then you have different items which have different values (profit) and weights (cost).", { color: 'red',to: {left: 100, top: 160}})
    return 5
  },
  () => {
    _.BT3 = bringInText("The goal is to fill the bag such that you get maximum value within the limit of weight W", {color: 'green', to: {left: 100, top: 250}})
    return 5
  },
  () => {
    _.T1 = createTextBox("weight=2<br>value=9", {left: 100, top: 340, background: 'green', color: 'white', height: 40})

    _.T2 = createTextBox("weight=3<br>value=14", {left: 250, top: 340, background: 'cyan', height: 60})

    _.T3 = createTextBox("weight=4<br>value=16", {left: 400, top: 340, background: 'purple', color: 'white', height: 80})

    _.T4 = createTextBox("weight=6<br>value=30", {left: 550, top: 340, background: 'maroon', color: 'white', height: 100})
    return 3
  },
  () => {
    _.T5 = bringInText("Let's say these are the items", {to: {left: 100, top: 500}, color: 'blue'})

    _.bag = createTextBox("Max Capacity = 10", {left: 820, top: 320, background: 'white', color: 'black', height: 180, border: '1px solid black', width: 61})
    return 3
  },
  () => {
    _.T6 = bringInText("And the bag can hold maximum 10 kg of weight", {to: {left: 750, top: 570}, color: 'blue'})

    return 5
  },
  () => {
    _.T6.remove(); _.T5.remove();

    _.T7 = bringInText("Then these items should be put in the bag for maximum profit", {to: {left: 200, top: 570}, color: 'blue'})

    return 5
  },
  () => {
    _.T3.animate({ left: 820, top: 320, zIndex: 2}, 1000)
    return 2
  },
  () => {
    _.T4.animate({ left: 820, top: 402, zIndex: 2}, 1000)
    return 3
  },
  () => {
    _.T7.remove()
    _.T7 = bringInText("Try and see which items should be put if the maximum capacity was different", {to: {left: 200, top: 570}, color: 'blue'})

    return 3
  },
  () => {
    [_.BT1, _.BT2, _.BT3].forEach(x => x.hide());
    _.M = _createMatrix({ data: "[2, 3, 4, 6], [9, 4, 16, 30]", size: '500,200', yheaders: `"Weights", "Values"`, xtitle: 'Items', ytitle: '.', location: '100,100' });
    _.T1 = createTextBox("Max Capacity = 10", {left: 700, top: 100})

    return 3
  },
  () => {
    typeQuote("Now let's see how we can solve this", { theme: 'white', css: {top: 200, left: 650, fontSize: 'larger', position: 'absolute'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    typeQuote("First, represent these items in form of symbols just for simplicity", { theme: 'white', css: {top: 200, left: 650, fontSize: 'larger', position: 'absolute'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    _.M.all.hide()
    _.clearText()
    _.A = createTextBox("A<hr>w=2<br>v=9", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 350, left: 220})
    _.B = createTextBox("B<hr>w=3<br>v=14", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 350, left: 320})
    _.C = createTextBox("C<hr>w=4<br>v=16", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 350, left: 420})
    _.D = createTextBox("D<hr>w=6<br>v=30", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 350, left: 520})

    return 6
  },
  () => {

    typeQuote("Then, let's visit these items one by one and see how they can go into the bag", { theme: 'white', css: {top: 200, left: 100, fontSize: 'larger', position: 'absolute'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    _.B.css({opacity: 0.1})
    _.C.css({opacity: 0.1})
    _.D.css({opacity: 0.1})
    typeQuote("For the first item A, there is only one way. Just put it into the bag", { theme: 'white', css: {top: 200, left: 100, fontSize: 'larger', position: 'absolute', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})
    _.A.animate({top: 100, left: 100})
    return -1
  },
  () => {
    _.B.css({opacity: 1})

    typeQuote("Now there are two items, A and B. We can put either A only, or B only, or AB both", { theme: 'white', css: {top: 200, left: 100, fontSize: 'larger', position: 'absolute', color: 'green'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    _.B.animate({
      top: 100,
      left: 200
    });
    return 3
  },
  () => {
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
  () => {
    _.C.css({opacity: 1})
    typeQuote("Similarly now there are three items, A, B and C. There will be more ways to put them in bag", { theme: 'white', css: {top: 200, left: 350, fontSize: 'larger', position: 'absolute', color: 'green'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    _.C.animate({top: 100, left: 300})
    return 3
  },
  () => {
    duplicate(_.B).then(x => {
      $(x).animate({
        top: 225,
        left: 300
      }, 1000, ()=> {
        x.html("BC<hr>w=7<br>v=30")
        x.css({ background: 'green'})
        _.BC = x
      })
    })

    return 3
  },
  () => {

    duplicate(_.AB).then(x => {
      $(x).animate({
        top: 350,
        left: 300
      }, 1000, ()=> {
        x.html("ABC<hr>w=9<br>v=39")
        x.css({ background: 'green'})
        _.ABC = x
      })
    })

    return 3
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 475,
        left: 300
      }, 1000, ()=> {
        x.html("AC<hr>w=6<br>v=25")
        x.css({ background: 'green'})
        _.AC = x
      })
    })

    return 3
  },
  () => {
    _.D.css({opacity: 1})

    typeQuote("Similarly now there are four items, A, B, C and D. There will be more ways to put them in bag", { theme: 'white', css: {top: 200, left: 450, fontSize: 'larger', position: 'absolute', color: 'green'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})
    _.D.animate({top: 100, left: 400})

    return -1
  },
  () => {
    duplicate(_.C).then(x => {
      $(x).animate({
        top: 225,
        left: 400
      }, 1000, ()=> {
        x.html("CD<hr>w=10<br>v=46")
        x.css({ background: 'green'})
        _.CD = x
      })
    })

    return 3
  },
  () => {
    duplicate(_.BC).then(x => {
      $(x).animate({
        top: 350,
        left: 400
      }, 1000, ()=> {
        x.html("BCD<hr>w=13<br>v=60")
        x.css({ background: 'green'})
        _.BCD = x
        _.BCD.css({ background: 'red'})
      })
    })


    return 3
  },
  () => {
    typeQuote("But you can see weight of BCD is more than capacity", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'red'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    typeQuote("So, let's just ignore it. That means we will not consider BCD", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'red'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    _.BCD.hide('slow')
    return 3
  },
  () => {
    duplicate(_.ABC).then(x => {
      $(x).animate({
        top: 350,
        left: 400
      }, 1000, ()=> {
        x.html("ABCD<hr>w=15<br>v=69")
        x.css({ background: 'red', width: 30})
        _.ABCD = x
      })
    })
    return 3
  },
  () => {
    _.ABCD.hide('slow')
    duplicate(_.AC).then(x => {
      $(x).animate({
        top: 350,
        left: 400
      }, 1000, ()=> {
        x.html("ACD<hr>w=12<br>v=55")
        x.css({ background: 'red', width: 30})
        _.ACD = x
      })
    })

    return 3
  },
  () => {
    _.ACD.hide('slow')

    return 3
  },
  () => {
    duplicate(_.B).then(x => {
      $(x).animate({
        top: 350,
        left: 400
      }, 1000, ()=> {
        x.html("BD<hr>w=9<br>v=44")
        x.css({ background: 'green', width: 30})
        _.BD = x
      })
    })

    return 3
  },
  () => {
    duplicate(_.AB).then(x => {
      $(x).animate({
        top: 475,
        left: 400
      }, 1000, ()=> {
        x.html("ABD<hr>w=11<br>v=53")
        x.css({ background: 'red', width: 30})
        _.ABD = x
        _.ABD.hide('slow')
      })
    })

    return 3
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 475,
        left: 400
      }, 1000, ()=> {
        x.html("AD<hr>w=8<br>v=39")
        x.css({ background: 'green', width: 30})
        _.AD = x
      })
    })

    return 3
  },
  () => {
    typeQuote("You can simply keep track of maximum combined value of items that you have seen so far!", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    typeQuote("Let's see the code for this", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'green'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    playCode1();
    return -1
  }
]

tasks2 = [
  () => {
    $('#editor').hide();
    return 4
  },
  () => {
    typeQuote("For another solution, Let's revisit this process... <br>When we were to add item D", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }});

    return -1
  },
  () => {
    [_.CD, _.BD, _.AD].forEach(x => x.css({opacity: 0.1}))
    return 3
  },
  () => {
    typeQuote("Notice that D can be combined with only these highlighted boxes", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }});
    [_.AB, _.BC, _.ABC, _.AC].forEach(x => x.css({opacity: 0.2}));
    [_.A, _.B, _.C].forEach(x => x.css({border: '4px solid yellow'}));

    return -1
  },
  () => {
    typeQuote("WHY? - Because the weight of these boxes is less than (Capacity - weight of D) i.e (10 - 6)", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    typeQuote("So, somehow we need to keep these boxes <strong>in order</strong> as they come up so that we can answer this question:<br><span style='color: green'><strong>WHAT ARE THE BOXES WITH WHICH THIS ITEM CAN COMBINE?</strong></span>", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue', paddingRight: '1em'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    typeQuote("We could have arranged these boxes in this fashion!", { theme: 'white', css: {top: 200, left: 520, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'red'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    _.clearText = () => { $(".text").velocity("fadeOut"); $(".text").remove(); };
    _.clearText()
    _.A = createTextBox("A<hr>w=2<br>v=9", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 100, left: 100})
    _.B = createTextBox("B<hr>w=3<br>v=14", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 100, left: 320})
    _.C = createTextBox("C<hr>w=4<br>v=16", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 100, left: 420})
    _.D = createTextBox("D<hr>w=6<br>v=30", {width: 20, height: 60, background: 'blue', color: 'white', borderRadius: '25%', fontWeight: 'bolder', padding: 0, top: 100, left: 520});
    [_.B, _.C, _.D].forEach(x => x.hide());

    return 3
  },
  () => {
    typeQuote("So far we only have A. We can simply put it in the bag if it is less than capacity", { theme: 'white', css: {top: 200, left: 300, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }});
    return -1;
  },
  () => {
    typeQuote("Now B comes", { theme: 'white', css: {top: 200, left: 300, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});
    _.B.show();
    return -1
  },
  () => {
    typeQuote("Let's see the ways we can put items A, B into bag now.", { theme: 'white', css: {top: 200, left: 300, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});
    _.B.css({top: 250, left: 100, opacity: 0.3})
    _.aro = createTextBox("⬇", {fontSize: '3em', left: 90, top: 180})
    return -1
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 250,
        left: 100
      }, 1000, ()=> {
        x.html("AB<hr>w=5<br>v=23")
        x.css({width: 30})
        _.AB = x
        _.AB.animate({left: 350}, 1000)
      })
    })
    return 3
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 250
      }, 1000, ()=> {
        _.A.css({opacity: 0.5});
        _.A = x;
      })
    });
    return 3
  },
  () => {
    _.aro.animate({left: 165}, 1000)
    _.B.animate({
      left: 175
    }, 1000, () => _.B.css({opacity: 1}))
    return 3
  },
  () => {
    _.aro.hide()
    return 2
  },
  () => {
    _.C.show()
    _.C.css({top: 400, left: 100, opacity: 0.3})
    typeQuote("Now let's see the ways we can put items A, B, C into bag now.", { theme: 'white', css: {top: 350, left: 300, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});
    _.aro.show()
    _.aro.css({left: 90})

    return -1
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 400,
        left: 100
      }, 1000, ()=> {
        x.html("AC<hr>w=6<br>v=25")
        x.css({width: 30})
        _.AC = x
        _.AC.animate({left: 450}, 1000)
      })
    })
    return 3
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 400
      }, 1000, ()=> {
        _.A.css({opacity: 0.5});
        _.A = x;
      })
    })
    return 3
  },
  () => {
    _.aro.animate({left: 160}, 1000)
    _.C.animate({left: 175}, 1000)
    return 3
  },
  () => {
    duplicate(_.B).then(x => {
      $(x).animate({
        top: 400,
        left: 175
      }, 1000, ()=> {
        x.html("BC<hr>w=7<br>v=30")
        x.css({width: 30})
        _.BC = x
        _.BC.animate({left: 550}, 1000)
      })
    })
    _.moveDown = (key, top, complete) => {
      duplicate(_[key]).then(x => {
        $(x).animate({
          top: top
        }, 1000, ()=> {
          _[key].css({opacity: 0.5});
          _[key] = x;
          if(complete) {complete()}
        })
      })
    }
    return 3
  },
  () => {
    _.moveDown("B", 400)
    return 3
  },
  () => {
    _.aro.animate({left: 250}, 1000)
    _.C.animate({left: 250}, 1000)

    return 3
  },
  () => {
    _.C.css({opacity: 1})
    return 3
  },
  () => {
    _.aro.animate({left: 340}, 1000)
    duplicate(_.C).then(x => {
      x.css({opacity: 0.3})
      _.C1 = x
      x.animate({left: 350}, 1000)
    })
    return 3
  },
  () => {
    duplicate(_.AB).then(x => {
      $(x).animate({
        top: 400
      }, 1000, ()=> {
        x.html("ABC<hr>w=9<br>v=39")
        x.css({width: 30})
        _.ABC = x
        x.animate({left: 780}, 1000)
      })
    })

    return 3
  },
  () => {
    _.moveDown("AB", 400)
    return 3
  },
  () => {
    _.D.show()
    _.D.css({top: 550, left: 100, opacity: 0.3})
    _.aro.show()
    _.aro.css({top: 330, left: 90})

    return 3
  },
  () => {
    duplicate(_.A).then(x => {
      $(x).animate({
        top: 550,
        left: 100
      }, 1000, ()=> {
        x.html("AD<hr>w=8<br>v=39")
        x.css({width: 30})
        _.AD = x
        _.AD.animate({left: 660}, 1000)
      })
    });
    return 3
  },
  () => {
    _.moveDown("A", 550);
    return 3
  },
  () => {
    _.aro.animate({left: 160}, 1000)
    _.D.animate({left: 175}, 1000)

    return 3
  },
  () => {
    duplicate(_.B).then(x => {
      $(x).animate({
        top: 550
      }, 1000, ()=> {
        x.html("BD<hr>w=9<br>v=44")
        x.css({width: 30})
        _.BD = x
        _.BD.animate({left: 780}, 1000)
      })
    });

    return 2
  },
  () => {
    typeQuote("At this point, we need to consider the value from above as well, <br> keep whatever is maximum", { theme: 'white', css: {top: 280, left: 500, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    _.moveDown("ABC", 550, ()=> {_.ABC.hide()});

    return 3
  },
  () => {
    _.moveDown("B", 550);

    return 3
  },
  () => {
    _.aro.animate({left: 250}, 1000)
    _.D.animate({left: 250}, 1000)

    return 3
  },
  () => {
    duplicate(_.C).then(x => {
      $(x).animate({
        top: 550
      }, 1000, ()=> {
        x.html("CD<hr>w=10<br>v=46")
        x.css({width: 30})
        _.CD = x
        _.CD.animate({left: 875}, 1000)
      })
    });

    return 3
  },
  () => {
    _.moveDown("C", 550);
    return 3
  },
  () => {
    _.aro.animate({left: 340}, 1000)
    _.D.animate({left: 350}, 1000)
    return 3
  },
  () => {
    _.moveDown("AB", 550)
    _.C1.hide()
    return 3
  },
  () => {
    typeQuote("Now we can not combine D with any other boxes because their weights are <br> more than (Capacity - Weight of D)", { theme: 'white', css: {top: 150, left: 500, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    typeQuote("But D alone can be put in the bag. Hence", { theme: 'white', css: {top: 300, left: 500, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    _.aro.animate({left: 440}, 1000)
    _.D.animate({left: 450}, 1000, () => _.D.css({opacity: 1}))

    return 5
  },
  () => {
    _.moveDown("AC", 550, () => _.AC.hide('slow'));
    typeQuote("Keep maximum", { theme: 'white', css: {top: 650, left: 450, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'green'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    _.aro.animate({left: 540}, 1000)

    return 3
  },
  () => {
    _.moveDown("BC", 550 );

    return 3
  },
  () => {
    _.aro.hide();
    typeQuote("The algo is pretty simple, take the values from top, let's say it is (w,v), <br>add the current item's weight x and value y, <br>and set the values to the proper place forward i.e. (w+x, v+y)", { theme: 'white', css: {top: 150, left: 500, position: 'absolute', fontSize: '1.4em',fontWeight: 'bolder', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})

    return -1
  },
  () => {
    typeQuote("So, what do we need to store these values?<br>We can use a matrix", { theme: 'white', css: {top: 150, left: 500, position: 'absolute', fontSize: '1.4em',fontWeight: 'bolder', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    typeQuote("Let's write code for this", { theme: 'white', css: {top: 150, left: 500, position: 'absolute', fontSize: '1.4em',fontWeight: 'bolder', color: 'green'}, wait: 5, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    playCode2();
    return -1
  }
]

tasks3 = [
  () => {
    $('#editor').hide();
    return 4
  },
  () => {
    typeQuote("Now, you don't have to do anything extra, just ask this question", { theme: 'white', css: {top: 200, left: 300, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});

    return -1
  },
  () => {
    $('.text').html('').css({ opacity: 0.3, background: 'blue'});
    _.D.css({opacity: 1}).html('<br>x<br>y');
    _.aro = createTextBox("⬇", {fontSize: '3em', left: 440, top: 480})
    typeQuote("WHERE DOES THE VALUE AT THIS PLACE COME FROM?", { theme: 'white', css: {top: 490, left: 485, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});

    return -1
  },
  () => {
    $($('.text')[7]).css({opacity: 1, background: 'green'}).html("<br>W<br>V'");
    typeQuote("And you'll see that it either comes from top", { theme: 'white', css: {top: 350, left: 450, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }});
    return -1
  },
  () => {
    $($('.text')[10]).css({opacity: 1, background: 'green', width: 53, paddingLeft: 10}).html("<br>W-x<br>V''");
    typeQuote("Or, it comes from left on the top row", { theme: 'white', css: {top: 350, left: 200, fontSize: 'larger', position: 'absolute', fontWeight: 'bolder', color: 'blue'}, wait: 6, onComplete: ()=> { resumeAnimationScript(); }});
    return -1
  },
  () => {
    typeQuote("We can have another solution, Let's write code for this", { theme: 'white', css: {top: 150, left: 500, position: 'absolute', fontSize: '1.4em',fontWeight: 'bolder', color: 'green'}, wait: 3, onComplete: ()=> { resumeAnimationScript(); }})
    return -1
  },
  () => {
    playCode3();
    return -1
  },
  () => {
    stop()
  }
]

tasks = tasks.concat(tasks2, tasks3)

