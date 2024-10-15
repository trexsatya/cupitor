window.poemLineChangesAt = [
  5, 8, 9, 13, 15,
  20, 24, 25, 30, 34, 41,
  '49', '50', '56', '1:00', '1:08', '1:19', '1:24', '1:29', '1:41',
  '1:54', '1:55', '2:02', '2:07', '2:14', '2:22', '2:27', '2:34', '2:41',
  '2:48', '2:49', '2:58', '3:04', '3:10', '3:17', '3:22', '3:32', '3:47'
]

window.mediaSynchronisation = {
  "1": [{t: "0:00", actions: [showMedia(1)]}, {
    t: "1:24",
    actions: [pauseMedia(1), hideMedia(1), showMedia(2), playMedia(2), moveMedia(1, "1:40")]
  }],
  "2": [{t: "3:53", actions: [hideMedia(2), showMedia(1), playMedia(1)]}]
}

function applyMediaSynchronisations() {
  for (let id in window.mediaSynchronisation) {
    let media = window.medias[id]
    let synchronisations = window.mediaSynchronisation[id]
    let currentItem = synchronisations.shift()
    media.addEventListener('timeupdate', function () {
      if (currentItem && media.currentTime > timeInSeconds(currentItem.t)) {
        currentItem.actions.forEach(action => action())
        currentItem = synchronisations.shift()
      }
    })
  }
}

let poem = `Om du kan behålla din hjärna
 när alla tappar deras
Och vill skylla dig järna.
Om du har dig själva att anförtro,
 när alla tvivlar på dig,
Men samt deras tvivlan kan du förstå.

Om du kan vänta utan att väntan slår dig ned,
 När ljugits ger dig inte till lögnaktighet;
Eller när hatats fylls inte hjärtat med vred,
 Och varken ser du anspråkslös ut eller talar som alltvet.

Om du kan dröma utan att drömmar blir härskare,
 Om du kan tänka utan att själva tankar blir pris;
Om du möter katastrof eller seger, de fuskare,
 Och handlar de på samma sätt som riktigt vis;
Om kan orka höra talat av dig som är sant,
 Blir vändat och vridat av de dårar;
Eller ser du livsviktiga saker stå på ruinens brant,
 Så reser du upp dig och bygger om utan tårar.

Om du kan ta alla dina vinster och lyckor,
   Och riskera det på ett myntkast;
Och förlora, och börja på nytt med tomma fickor,
  Och inte beklagar ett dugg även om du har ondast;
Om du kan tvinga din nerv och sena,
  Även om du pustar och frustar;
Om du kan fortsätta även om kroppsdelar är klena,
 Och kan följa den inre röst som ropar “Håll kvar!”

Om du kan styra folkmassa men dina dygder återstår,
 Om du kan gå med kungen utan att avhända sig Ordinära;
Om varken fiender eller vänner kan ge dig sår,
 Om alla beräknas med dig men ingen blir för kära;
Om en oförsonliga minut kan du slå igenom,
 Med sextio sekunders värt kamp och vån;
Då ska du ha hela Jorden, och allt inom,
 Och framför allt så ska du bli en Man, min Son!`;


$(document).ready(() => {
  window.horizRuler = document.getElementById('horizRuler');
  var rulez = new Rulez({
    element: horizRuler,
  });
  rulez.render();

  window.vertRuler = document.getElementById('vertRuler');
  rulez = new Rulez({
    element: vertRuler,
    layout: 'vertical',
    textDefaults: {
      rotation: 90
    }
  });
  rulez.render();
})

function toggleRulers() {
  if (window.horizRuler.style.display === 'none') {
    window.horizRuler.style.display = 'block';
    window.vertRuler.style.display = 'block';
  } else {
    window.horizRuler.style.display = 'none';
    window.vertRuler.style.display = 'none';
  }
}

function CtrlKey(char) {
  return e => (e.ctrlKey || e.metaKey)
    && String.fromCharCode(e.which).toLowerCase() === char.toLowerCase();
}

function Key(char) {
  return e => String.fromCharCode(e.which).toLowerCase() === char.toLowerCase();
}

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

class KeyBinding {
  constructor(matchFn, runFn) {
    this.matchFn = matchFn;
    this.runFn = runFn;
    this.id = uuidv4();
  }

  matches(e) {
    return this.matchFn(e);
  }

  run() {
    this.runFn();
  }
}

function addKeyBinding(keyBinding) {
  keyBindings.push(keyBinding);
}

function removeKeyBinding(keyBinding) {
  keyBindings = keyBindings.filter(it => it.id !== keyBinding.id);
}

let keyBindings = []
document.addEventListener('keydown', function (e) {
  keyBindings.forEach(it => {
    if (it.matches(e)) {
      it.run();
    }
  });//end foreach
});

function timeInSeconds(time) {
  time = time + ""
  if (!time.includes(':')) {
    return parseInt(time)
  }
  let [minutes, seconds] = time.split(':').map(it => parseInt(it))
  return minutes * 60 + seconds
}

function pauseMedia(id) {
  return () => {
    console.log('pausing media', id)
    window.medias[id + ""].pause()
  }
}

function playMedia(id) {
  return () => {
    console.log('playing media', id)
    window.medias[id + ""].play()
  }
}

function moveMedia(id, time) {
  return () => {
    console.log('moving media', id, 'to', time)
    window.medias[id + ""].currentTime = timeInSeconds(time)
  }
}

function hideMedia(id, time) {
  time = time || 3000
  return () => {
    console.log('hiding media', id)
    $(window.medias[id + ""]).fadeOut(time)
  }
}

function showMedia(id, time) {
  time = time || 3000
  return () => {
    console.log('showing media', id)
    $(window.medias[id + ""]).fadeIn(time)
  }
}

