export function transformArticle(router){
  try {
    $('.flex-card-listitem').each((i,e) => {
       $(e).css({ margin: '20px', border: '0.3px solid grey' })

       $(e).click(evt => {
        router.push($(e).attr('reactlink'))
       })
    })


    
    $('a*[reactlink]').each((i,e)=> {
      $(e).css({ cursor: 'hover'})
      var to = $(e).attr('reactlink')
      $(e).click(evt => router.push(to))
    })

  } catch(e){
    console.log(e)
  }
  try { Prism.highlightAll() } catch(e){ console.log(e); }
  try { fixImageUrls() } catch(e){ console.log(e); }
  try { drawMathematics() } catch(e){ console.log(e); }
}


window.transformArticle = transformArticle;

window.fixImageUrls = function(){
    $('img').each((i,e) => {
        var href = $(e).attr('src')
        if(href.startsWith('/images/')){
            href = href.replace('/images/', imageCdnUrl)
            $(e).attr('src', href)
        }
    })
};


window.drawMathematics = function(){
      document.querySelectorAll('.math').forEach(x => {
      var input = x.innerHTML;  
      x.innerHTML = '';
      MathJax.texReset();
      var options = MathJax.getMetricsFor(x);
      options.display = x.nodeName === 'DIV';
      MathJax.tex2chtmlPromise(input, options).then(function (node) {
            //
            //  The promise returns the typeset node, which we add to the output
            //  Then update the document to include the adjusted CSS for the
            //    content of the new equation.
            //
            x.appendChild(node);
            MathJax.startup.document.clear();
            MathJax.startup.document.updateDocument();
          }).catch(function (err) {
            //
            //  If there was an error, put the message into the output instead
            //
            x.appendChild(document.createElement('pre')).appendChild(document.createTextNode(err.message));
          }).then(function () {
            //
            //  Error or not, re-enable the display and render buttons
            //
            console.log('done rendering math')
          });
      
    });

};

window.appendScripts = function(urls){
      urls.forEach(url =>{
          var script = document.createElement('script');
          script.src = url;
          document.body.appendChild(script);
      });
}