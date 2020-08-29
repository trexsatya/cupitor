CKEDITOR.dialog.add( 'mathematicaDialog', function ( editor ) {

    return {
        title: 'Abbreviation Properties',
        minWidth: 400,
        minHeight: 200,

        contents: [
            {
                    id: 'tab-basic',
                    label: 'Mathematical Text',
                    elements: [
                        {
                            type: 'textarea',
                            id: 'mats',
                            label: 'Maths',
                            validate: CKEDITOR.dialog.validate.notEmpty( "Cannot be empty." ),
                            required: true
                        },
                        {
                            type: 'select',
                            id: 'mathContainerType',
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
            var editing = editor;

            var existing = editing.getSelection().getStartElement();
            if(existing.hasClass('math')){
                dialog.setValueOf( 'tab-basic', 'mathContainerType',  existing.getName())
                dialog.setValueOf( 'tab-basic', 'mats', existing.getHtml() )
            }
        },

        onOk: function() {
                var dialog = this;
                var mattext = dialog.getValueOf( 'tab-basic', 'mats' )
                var mathContainerType = dialog.getValueOf( 'tab-basic', 'mathContainerType' )
                
                var existing = editor.getSelection().getStartElement();
                if(existing.hasClass('math')){
                    existing.setHtml(mattext)
                } else {
                    var insertingElement = mathContainerType == 'span' ? editor.document.createElement('span') 
                                                                   : editor.document.createElement('div');

                    insertingElement.addClass('math');
                    insertingElement.setHtml (mattext);
                    editor.insertElement( insertingElement );    
                }
                
        }
    };
});