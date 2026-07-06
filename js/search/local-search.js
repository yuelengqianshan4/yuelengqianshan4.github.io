window.addEventListener('load', () => {
  let loadFlag = false
  let dataObj = []
  const $searchMask = document.getElementById('search-mask')

  const openSearch = () => {
    const $searchDialog = document.querySelector('#local-search .search-dialog')
    const $searchInput = document.querySelector('#local-search-input input')
    if (!$searchMask || !$searchDialog || !$searchInput) return

    const bodyStyle = document.body.style
    bodyStyle.width = '100%'
    bodyStyle.overflow = 'hidden'
    btf.animateIn($searchMask, 'to_show 0.5s')
    btf.animateIn($searchDialog, 'titleScale 0.5s')
    setTimeout(() => { $searchInput.focus() }, 100)
    if (!loadFlag) {
      search()
      loadFlag = true
    }
    // shortcut: ESC
    document.addEventListener('keydown', function f (event) {
      if (event.code === 'Escape') {
        closeSearch()
        document.removeEventListener('keydown', f)
      }
    })
  }

  const closeSearch = () => {
    const bodyStyle = document.body.style
    bodyStyle.width = ''
    bodyStyle.overflow = ''
    const $searchDialog = document.querySelector('#local-search .search-dialog')
    if ($searchDialog) btf.animateOut($searchDialog, 'search_close .5s')
    if ($searchMask) btf.animateOut($searchMask, 'to_hide 0.5s')
  }

  const searchClickFn = () => {
    const $searchButton = document.querySelector('#search-button > .search')
    if ($searchButton) $searchButton.addEventListener('click', openSearch)
  }

  const searchClickFnOnce = () => {
    const $closeButton = document.querySelector('#local-search .search-close-button')
    if ($closeButton) $closeButton.addEventListener('click', closeSearch)
    if ($searchMask) $searchMask.addEventListener('click', closeSearch)
    if (GLOBAL_CONFIG.localSearch.preload) dataObj = fetchData(GLOBAL_CONFIG.localSearch.path)
  }

  // check url is json or not
  const isJson = url => {
    const reg = /\.json$/
    return reg.test(url)
  }

  const fetchData = async (path) => {
    let data = []
    const response = await fetch(path)
    if (isJson(path)) {
      data = await response.json()
    } else {
      const res = await response.text()
      const t = await new window.DOMParser().parseFromString(res, 'text/xml')
      const a = await t
      data = [...a.querySelectorAll('entry')].map(item =>{
        return {
          title: item.querySelector('title').textContent,
          content: item.querySelector('content') && item.querySelector('content').textContent,
          url: item.querySelector('url').textContent
        }
      })
    }
    if (response.ok) {
      const $loadDataItem = document.getElementById('loading-database')
      if ($loadDataItem && $loadDataItem.nextElementSibling) {
        $loadDataItem.nextElementSibling.style.display = 'block'
        $loadDataItem.remove()
      }
    }
    return data
  }

  const search = () => {
    if (!GLOBAL_CONFIG.localSearch.preload) {
      dataObj = fetchData(GLOBAL_CONFIG.localSearch.path)
    }

    const $input = document.querySelector('#local-search-input input')
    const $resultContent = document.getElementById('local-search-results')
    const $loadingStatus = document.getElementById('loading-status')
    if (!$input || !$resultContent || !$loadingStatus) return

    $input.addEventListener('input', function () {
      const keywords = this.value.trim().toLowerCase().split(/[\s]+/)
      if (keywords[0] !== '') $loadingStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>'

      $resultContent.innerHTML = ''
      let str = '<div class="search-result-list">'
      if (keywords.length <= 0) return
      let count = 0
      // perform local searching
      dataObj.then(data => {
        data.forEach(data => {
          let isMatch = true
          let dataTitle = data.title ? data.title.trim().toLowerCase() : ''
          const dataContent = data.content ? data.content.trim().replace(/<[^>]+>/g, '').toLowerCase() : ''
          const dataUrl = data.url.startsWith('/') ? data.url : GLOBAL_CONFIG.root + data.url
          let indexTitle = -1
          let indexContent = -1
          let firstOccur = -1
          // only match articles with not empty titles and contents
          if (dataTitle !== '' || dataContent !== '') {
            keywords.forEach((keyword, i) => {
              indexTitle = dataTitle.indexOf(keyword)
              indexContent = dataContent.indexOf(keyword)
              if (indexTitle < 0 && indexContent < 0) {
                isMatch = false
              } else {
                if (indexContent < 0) {
                  indexContent = 0
                }
                if (i === 0) {
                  firstOccur = indexContent
                }
              }
            })
          } else {
            isMatch = false
          }

          // show search results
          if (isMatch) {
            if (firstOccur >= 0) {
              // cut out 130 characters
              // let start = firstOccur - 30 < 0 ? 0 : firstOccur - 30
              // let end = firstOccur + 50 > dataContent.length ? dataContent.length : firstOccur + 50
              let start = firstOccur - 30
              let end = firstOccur + 100
              let pre = ''
              let post = ''

              if (start < 0) {
                start = 0
              }

              if (start === 0) {
                end = 100
              } else {
                pre = '...'
              }

              if (end > dataContent.length) {
                end = dataContent.length
              } else {
                post = '...'
              }

              let matchContent = dataContent.substring(start, end)

              // highlight all keywords
              keywords.forEach(keyword => {
                const regS = new RegExp(keyword, 'gi')
                matchContent = matchContent.replace(regS, '<span class="search-keyword">' + keyword + '</span>')
                dataTitle = dataTitle.replace(regS, '<span class="search-keyword">' + keyword + '</span>')
              })

              str += '<div class="local-search__hit-item"><a href="' + dataUrl + '" class="search-result-title">' + dataTitle + '</a>'
              count += 1

              if (dataContent !== '') {
                str += '<p class="search-result">' + pre + matchContent + post + '</p>'
              }
            }
            str += '</div>'
          }
        })
        if (count === 0) {
          str += '<div id="local-search__hits-empty">' + GLOBAL_CONFIG.localSearch.languages.hits_empty.replace(/\$\{query}/, this.value.trim()) +
            '</div>'
        }
        str += '</div>'
        $resultContent.innerHTML = str
        if (keywords[0] !== '') $loadingStatus.innerHTML = ''
        window.pjax && window.pjax.refresh($resultContent)
      })
    })
  }

  searchClickFn()
  searchClickFnOnce()

  // pjax
  window.addEventListener('pjax:complete', () => {
    $searchMask && !btf.isHidden($searchMask) && closeSearch()
    searchClickFn()
  })
})
