CKEDITOR.plugins.add( 'title', {
    icons: 'title',
    init: function( editor ) {
        editor.addCommand( 'title', new CKEDITOR.dialogCommand( 'titleDialog' ) );
        editor.ui.addButton( 'Title Popup', {
            label: 'Insert Title',
            command: 'title',
            toolbar: 'insert,0'
        });
        CKEDITOR.dialog.add( 'titleDialog', this.path + 'dialogs/title.js' );
        const pluginDirectory = this.path;
        editor.addContentsCss( pluginDirectory + 'title.css' );
    }
});
