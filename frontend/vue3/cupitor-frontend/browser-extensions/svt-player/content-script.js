let TRANSLATION_SERVER_API = `http://localhost:3001/translate`;


const waitUntil = (condition) => {
    return new Promise((resolve) => {
        let interval = setInterval(() => {
            if (!condition()) {
                return
            }
            clearInterval(interval)
            resolve()
        }, 100)
    })
};

function isYoutube() {
    return window.location.toString().indexOf("youtube.com") >= 0
}

function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

let $tlBox = $(`
<div> 
    <div><label for="translateToggleButton">Stop</label><input type="checkbox" id="translateToggleButton" /> </div>
    <div id="tlBoxContent"></div>
</div>
`).attr("id", "ctl-box")

function showAlert(text1, text2) {
    let $content = $('#tlBoxContent')
    $content.html(`<div>${text1}</div><br/>`)

    let $sv = $('<p/>')
    console.log(text1, text2)
    text2.split(" ").forEach(word => {
        let wikiWord = word.replaceAll("-", "").replaceAll("–", "").replace(/[^a-zÅÄÖ ]/gi, '')
        wikiWord = wikiWord.toLowerCase()
        let url = `https://en.wiktionary.org/wiki/${wikiWord}#Swedish`
        $sv.append(`<a target="_blank" href="${url}" style="color: blue;"> ${word} </a>`)
    })
    $content.append($sv)
    $content.append($(`<button>Copy Swedish</button>`).click(e => {
        navigator.clipboard.writeText(text2)
    }))

    $('#translateToggleButton').button()

    getCustomDialogBox().dialog( "open");

    $('#ctl-box').parent(".ui-dialog").css({left: '80%', width: '20%'})
}

function getCustomDialogBox() {
    return $("#ctl-box");
}

async function test() {
    if(isYoutube()) {

    } else {
        await waitUntil(() => location.toString().indexOf("/video/") > 0)
    }

    if(!getCustomDialogBox().length) {
        $('body').append($tlBox);
        getCustomDialogBox().dialog({
            width: '40%',
            height: 500,
            close: function( event, ui ) {
                $("button[title=Spela]").click()
            }
        }).css({ fontSize: 'large'});
        $(".ui-front").css({zIndex: 10000})

        getCustomDialogBox().dialog( "close");
    }

    function getSubtitleContainer() {
        if(isYoutube()) {
            return $('div[class*="caption-window"]')
        }
        return $('div[class*="_video-player__text-tracks_"]');
    }

    await waitUntil(() => getSubtitleContainer().length > 0)

    let subtitleNode= getSubtitleContainer()[0]

    let lastText = null
    let observer = new MutationObserver(function( mutations ) {
        $('div[aria-label="video modal"]').css({width: '80%'})
        mutations.forEach(function( mutation ) {
            var newNodes = mutation.addedNodes; // DOM NodeList
            if( newNodes !== null ) { // If there are new nodes added
                var $nodes = $( newNodes ); // jQuery set
                $nodes.each(function() {
                    var $node = $( this );
                    // if( $($node).attr( "class" ).indexOf("_video-player__text-tracks_") >= 0 ) {
                    let text = $($node).html();
                    text = $(text.replace(/<br\s*\/?>/gi,' ')).text()
                    if(text.startsWith(lastText)) {
                        lastText += text
                        return
                    }

                    if(lastText !== text) {
                        lastText = text
                    // console.log($node, text)
                    // Pause and Translate
                    if($('#translateToggleButton').is(":checked")) {
                        $("button[title=Pausa]").click()
                    }

                    let time = $('div[data-rt="video-player-time-indicator"]').text()
                    time = time.split("/")[0].trim();

                    fetch(`${TRANSLATION_SERVER_API}?q=${text}&src=${location.toString()}&ts=${time}`, {mode: 'no-cors'})
                        .then(it => it.text())
                        .then(resp => {
                            let txt = resp
                            console.log(txt)
                            return JSON.parse(txt)
                        })
                        .then(it => {
                            console.log(it);
                            showAlert(it.eng, text)
                        })
                    }
                });
            }
        });
    });

    // Configuration of the observer:
    let config = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    };

    console.log('sk',subtitleNode)
    // Pass in the target node, as well as the observer options
    observer.observe(subtitleNode, config);
}

test()