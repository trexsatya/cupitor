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
      $('div.math').each((i,e)=>{
          $(e).css({ padding: 10})
          if( $(e).attr('bg')){
                  $(e).css({ background: $(e).attr('bg'), color:  $(e).attr('fg') })
          }
          try {  $(e).html(katex.renderToString($(e).text().trim(), { displayMode: true })) } catch(e) { console.log(e); }
      })

      $('span.math').each((i,e)=>{
         $(e).css({ padding: 10})
         if( $(e).attr('bg')){
             $(e).css({ background: $(e).attr('bg'), color:  $(e).attr('fg') })
         }

          try { $(e).html(katex.renderToString($(e).text().trim())) } catch(e){ console.log(e); }
      })
};

window.appendScripts = function(urls){
      urls.forEach(url =>{
          var script = document.createElement('script');
          script.src = url;
          document.body.appendChild(script);
      });
}