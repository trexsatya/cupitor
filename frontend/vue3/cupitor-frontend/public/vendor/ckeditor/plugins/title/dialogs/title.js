CKEDITOR.dialog.add( 'titleDialog', function ( editor ) {

    return {
        title: 'Add Title Popup',
        minWidth: 400,
        minHeight: 200,

        contents: [
            {
                    id: 'tab-basic-title',
                    label: 'Title Text',
                    elements: [
                        {
                            type: 'textarea',
                            id: 'titleTextarea',
                            label: 'Text',
                            validate: CKEDITOR.dialog.validate.notEmpty( "Cannot be empty." ),
                            required: true
                        },
                        {
                            type: 'select',
                            id: 'titleContainerType',
                            label: 'Container Type',
                            items: [ ['span' , 'span'], ['div' , 'div']],
                            default: 'span'
                        }
                    ]
             }
        ],
        onLoad: function(){

        },
        onShow: function(){
            var dialog = this;
            var existing = editor.getSelection().getStartElement();
            console.log(existing)
            if(existing.hasClass('title-popup')) { //Means it's already convered
              dialog.setValueOf( 'tab-basic-title', 'titleContainerType',  existing.getName())
              dialog.setValueOf( 'tab-basic-title', 'titleTextarea', existing.getAttribute('title') )
            } else {
              const selectedText = editor.getSelection().getSelectedText()
              dialog.setValueOf( 'tab-basic-title', 'titleTextarea', selectedText )
            }
        },

        onOk: function() {
                var dialog = this;
                var mattext = dialog.getValueOf( 'tab-basic-title', 'titleTextarea' ).trim()
                var mathContainerType = dialog.getValueOf( 'tab-basic-title', 'titleContainerType' )

                var existing = editor.getSelection().getStartElement();

                if(existing.hasClass('title-popup')){
                    existing.setAttribute('title', mattext)
                } else {
                    var insertingElement = mathContainerType === 'span' ? editor.document.createElement('span')
                                                                   : editor.document.createElement('div');
                    insertingElement.setHtml(editor.getSelection().getSelectedText())
                    insertingElement.addClass('title-popup')
                    insertingElement.setAttribute('title', mattext)
                    editor.insertElement( insertingElement );
                }
        }
    };
});
