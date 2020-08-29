function fixImageUrls() {
  document.querySelectorAll('img').forEach((e,i) => {
    let href = e.getAttribute('src');
    if (href.startsWith('/images/')) {
      href = href.replace('/images/', window.imageCdnUrl+"/images/");
      e.src = href;
    }
  })
};

let MathJax;

if (process.client) {
  MathJax = window.MathJax;
}

let promise = Promise.resolve();  // Used to hold chain of typesetting calls

function typeset(code) {
  promise = promise.then(() => {code(); return MathJax.typesetPromise()})
                   .catch((err) => console.log('Typeset failed: ' + err.message));
  return promise;
}

function drawMathematics() {

  document.querySelectorAll(".math").forEach(m => {
    m.innerHTML = katex.renderToString(m.innerHTML, {
          throwOnError: false
      });
  })

};

export function transformArticle(router) {
  const $ = document.querySelectorAll;
  try {
    document.querySelectorAll('.flex-card-listitem').forEach((e, i) => {
      const to = e.getAttribute('reactlink');
      e.style.cursor = 'pointer';
      e.onclick = () => {
        router.push(to).catch(error => {
          if (error.name != "NavigationDuplicated") {
            throw error;
          }
        });;
      };
    });

    document.querySelectorAll('a[reactlink]').forEach((e, i) => {
      const to = e.getAttribute('reactlink');
      e.style.cursor = 'pointer';
      e.onclick = () => {
        router.push(to).catch(error => {
          if (error.name != "NavigationDuplicated") {
            throw error;
          }
        });;
      };
    })

  } catch (e) {
    console.log(e)
  }
  try {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });
  } catch (e) {
    console.log(e);
  }
  try {
    fixImageUrls()
  } catch (e) {
    console.log(e);
  }
  try {
    drawMathematics()
  } catch (e) {
    console.log(e);
  }
}

if (process.client) {
  window.appendScripts = function(urls) {
    urls.forEach(url => {
      const script = document.createElement('script');
      script.src = url;
      document.body.appendChild(script);
    });
  }
}

