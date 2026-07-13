window.addEventListener('load', () => {
  let loadFlag = false
  let dataObj = []
  let activeSearchTrigger = null
  let accessibleSearchOpen = false
  const $searchMask = document.getElementById('search-mask')

  const isAccessibleSearchPage = () => {
    const classList = document.body.classList
    return classList.contains('is-non-home-content-page') || classList.contains('is-post-page')
  }

  const syncSearchAccessibility = () => {
    const $searchDialog = document.querySelector('#local-search .search-dialog')
    const $searchTitle = document.querySelector('#local-search .search-dialog-title')
    const $searchInput = document.querySelector('#local-search-input input')
    const $closeButton = document.querySelector('#local-search .search-close-button')
    const $closeIcon = document.querySelector('#local-search .search-close-button i')
    if (!$searchDialog || !$searchTitle || !$searchInput || !$closeButton) return

    if (isAccessibleSearchPage()) {
      $searchTitle.id = 'local-search-dialog-title'
      $searchDialog.setAttribute('role', 'dialog')
      $searchDialog.setAttribute('aria-modal', 'true')
      $searchDialog.setAttribute('aria-labelledby', 'local-search-dialog-title')
      $searchDialog.setAttribute('aria-hidden', String(!accessibleSearchOpen))
      $searchDialog.setAttribute('tabindex', '-1')
      $searchInput.setAttribute('aria-label', $searchInput.placeholder || $searchTitle.textContent || 'Search')
      $closeButton.setAttribute('type', 'button')
      $closeButton.setAttribute('aria-label', 'Close search')
      if ($closeIcon) $closeIcon.setAttribute('aria-hidden', 'true')
      return
    }

    $searchTitle.removeAttribute('id')
    $searchDialog.removeAttribute('role')
    $searchDialog.removeAttribute('aria-modal')
    $searchDialog.removeAttribute('aria-labelledby')
    $searchDialog.removeAttribute('aria-hidden')
    $searchDialog.removeAttribute('tabindex')
    $searchInput.removeAttribute('aria-label')
    $closeButton.removeAttribute('type')
    $closeButton.removeAttribute('aria-label')
    if ($closeIcon) $closeIcon.removeAttribute('aria-hidden')
  }

  const getFocusableSearchItems = $searchDialog => {
    const items = [...$searchDialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    return items.filter(item => item.getClientRects().length > 0)
  }

  const handleAccessibleSearchKeydown = event => {
    if (!accessibleSearchOpen) return

    const key = event.key || event.code
    if (key === 'Escape') {
      event.preventDefault()
      closeSearch()
      return
    }

    if (key !== 'Tab') return
    const $searchDialog = document.querySelector('#local-search .search-dialog')
    if (!$searchDialog) return

    const focusableItems = getFocusableSearchItems($searchDialog)
    if (focusableItems.length === 0) {
      event.preventDefault()
      $searchDialog.focus()
      return
    }

    const firstItem = focusableItems[0]
    const lastItem = focusableItems[focusableItems.length - 1]
    const focusIsOutside = !$searchDialog.contains(document.activeElement)
    if (event.shiftKey && (document.activeElement === firstItem || focusIsOutside)) {
      event.preventDefault()
      lastItem.focus()
    } else if (!event.shiftKey && (document.activeElement === lastItem || focusIsOutside)) {
      event.preventDefault()
      firstItem.focus()
    }
  }

  const openSearch = event => {
    const $searchDialog = document.querySelector('#local-search .search-dialog')
    const $searchInput = document.querySelector('#local-search-input input')
    if (!$searchMask || !$searchDialog || !$searchInput) return

    const useAccessibleLifecycle = isAccessibleSearchPage()
    if (useAccessibleLifecycle) {
      activeSearchTrigger = event && event.currentTarget ? event.currentTarget : document.activeElement
      accessibleSearchOpen = true
      syncSearchAccessibility()
      document.removeEventListener('keydown', handleAccessibleSearchKeydown)
      document.addEventListener('keydown', handleAccessibleSearchKeydown)
    }

    const bodyStyle = document.body.style
    bodyStyle.width = '100%'
    bodyStyle.overflow = 'hidden'
    btf.animateIn($searchMask, 'to_show 0.5s')
    btf.animateIn($searchDialog, 'titleScale 0.5s')
    setTimeout(() => {
      if (!useAccessibleLifecycle) {
        $searchInput.focus()
      } else if (accessibleSearchOpen) {
        const inputIsVisible = $searchInput.getClientRects().length > 0
        const focusTarget = inputIsVisible ? $searchInput : getFocusableSearchItems($searchDialog)[0] || $searchDialog
        focusTarget.focus()
      }
    }, 100)
    if (!loadFlag) {
      search()
      loadFlag = true
    }
    if (useAccessibleLifecycle) return

    // shortcut: ESC
    document.addEventListener('keydown', function f (event) {
      if (event.code === 'Escape') {
        closeSearch()
        document.removeEventListener('keydown', f)
      }
    })
  }

  const closeSearch = () => {
    const focusTarget = accessibleSearchOpen ? activeSearchTrigger : null
    if (accessibleSearchOpen) {
      accessibleSearchOpen = false
      activeSearchTrigger = null
      document.removeEventListener('keydown', handleAccessibleSearchKeydown)
      syncSearchAccessibility()
    }

    const bodyStyle = document.body.style
    bodyStyle.width = ''
    bodyStyle.overflow = ''
    const $searchDialog = document.querySelector('#local-search .search-dialog')
    if ($searchDialog) btf.animateOut($searchDialog, 'search_close .5s')
    if ($searchMask) btf.animateOut($searchMask, 'to_hide 0.5s')
    if (focusTarget && focusTarget.isConnected) {
      setTimeout(() => { focusTarget.focus() }, 0)
    }
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
      const query = this.value.trim().toLowerCase()
      $resultContent.innerHTML = ''
      $loadingStatus.innerHTML = ''
      if (!query) return

      const keywords = query.split(/[\s]+/)
      $loadingStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>'
      let str = '<div class="search-result-list">'
      let count = 0
      // perform local searching
      dataObj.then(data => {
        if (this.value.trim().toLowerCase() !== query) return

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
        $loadingStatus.innerHTML = ''
        window.pjax && window.pjax.refresh($resultContent)
      })
    })
  }

  searchClickFn()
  searchClickFnOnce()
  syncSearchAccessibility()

  // pjax
  window.addEventListener('pjax:complete', () => {
    if (accessibleSearchOpen || ($searchMask && !btf.isHidden($searchMask))) closeSearch()
    syncSearchAccessibility()
    searchClickFn()
  })
})
