CKEDITOR.plugins.add( 'mathematica', {
    icons: 'mathematica',
    init: function( editor ) {
        editor.addCommand( 'mathematica', new CKEDITOR.dialogCommand( 'mathematicaDialog' ) );
        editor.ui.addButton( 'Maths', {
            label: 'Insert Mathematics',
            command: 'mathematica',
            toolbar: 'insert,0'
        });
        CKEDITOR.dialog.add( 'mathematicaDialog', this.path + 'dialogs/mathematica.js' );
    }
});