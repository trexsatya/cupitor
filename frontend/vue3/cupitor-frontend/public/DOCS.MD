Useful JS snippets
```javascript
notesInScale(minorScales, 'C').forEach(it => fretboard.showAllForNoteName(it).forEach(it => it.css({cursor: 'pointer', opacity: 0.3, zIndex: 20000}).click(e => {
    let op = $(e.target).css('opacity')
    let newOp = 0.3;
    if(op == 0.3) { newOp = 1} else { newOp = 0.3}
    $(e.target).css({'opacity': newOp})
})))
```
