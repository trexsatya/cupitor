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