let SERVER_API = `http://localhost:3001/language.html`;

function getCustomDialogBox() {
    return $("#ctl-box");
}

function getSelectionText() {
    let text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type !== "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}

async function searchTextChanged() {
    let searchText = $('#searchText').val();
    console.log(searchText, "searchTextChanged")
    await fetchSRTs(searchText)
}

let $tlBox = $(`
<div>
    <div id="info-dialog" title="Media Info" style="display: none;">
        <div id="info-dialog-content"></div>
    </div>
    <div id="tlBoxContent">
        <input type="search" id="searchText" placeholder="Search text" onchange="searchTextChanged()"
                           style="width: 68%;">
       EN:<input class="tgl tgl-flip" id="toggleLangCb" type="checkbox" data-toggle="toggle"
       data-size="small" data-on="EN" data-off="SV" style="width: 8%"/>
        <button id="searchButton">Search</button>
        <div id="resultContainer">
                <div id="vocabularyResult">

                </div>
                <div id="result" style="overflow: scroll; height: 300px;clear: both;
                    border: 1px solid green; border-right: none;">

                </div>
        </div>
    </div>
</div>
`).attr("id", "ctl-box")

async function test() {
    window.showInfoWithoutPopup = true;
    window.dontConfirmOnRefresh = true;

    if(!getCustomDialogBox().length) {
        $('body').append($tlBox);
        getCustomDialogBox().dialog({
            width: '90%',
            height: 900,
            close: function( event, ui ) {
                $("button[title=Spela]").click()
            }
        }).css({ fontSize: 'large'});
        $(".ui-front").css({zIndex: 10000})
        getCustomDialogBox().dialog( "close");
    }
    $('body').dblclick(async e => {
        let txt = getSelectionText()
        $('#searchText').val(txt)
        await fetchSRTs(txt)
        getCustomDialogBox().dialog("open");
    })
    $('#searchButton').click(async e => {
        let txt = $('#searchText').val()
        await fetchSRTs(txt);
    })
}
test()
