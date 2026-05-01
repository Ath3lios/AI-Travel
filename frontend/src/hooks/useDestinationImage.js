import { useEffect, useState } from 'react'
import daNangImage from '../assets/hero-slider/du-lich-da-nang_sPzZVrI.png'
import nhaTrangImage from '../assets/hero-slider/nha-trang-city-tour_uoWlQ.jpeg'
import beachImage from '../assets/hero-slider/unnamed.jpg'
import cityImage from '../assets/hero-slider/unnamed (1).jpg'
import mountainImage from '../assets/hero-slider/11.jpg'

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || ''
const CACHE_KEY = 'dest_img_cache_v4'
const WIKI_API = 'https://vi.wikipedia.org/w/api.php'

const WIKI_PAGE_BY_DESTINATION = {
  'ha noi': 'Hà Nội',
  hanoi: 'Hà Nội',
  'da nang': 'Đà Nẵng',
  'hoi an': 'Hội An',
  hue: 'Huế',
  sapa: 'Sa Pa',
  'sa pa': 'Sa Pa',
  'phu quoc': 'Phú Quốc',
  'da lat': 'Đà Lạt',
  dalat: 'Đà Lạt',
  'nha trang': 'Nha Trang',
  'ha long': 'Vịnh Hạ Long',
  'vinh ha long': 'Vịnh Hạ Long',
  'ninh binh': 'Ninh Bình',
  'tam coc': 'Tam Cốc - Bích Động',
  'moc chau': 'Mộc Châu',
  'mui ne': 'Mũi Né',
}

function loadCache() {
  try {
    if (typeof localStorage === 'undefined') return new Map()
    return new Map(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'))
  } catch {
    return new Map()
  }
}

function saveCache(cache) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CACHE_KEY, JSON.stringify([...cache]))
  } catch {
    // localStorage may be unavailable in private browsing or strict browser modes.
  }
}

const imageCache = loadCache()

function removeDiacritics(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .trim()
}

function getDestinationFallback(destination) {
  const normalized = removeDiacritics(destination || '').toLowerCase()

  if (/da nang|hoi an|hue/.test(normalized)) return daNangImage
  if (/nha trang/.test(normalized)) return nhaTrangImage
  if (/phu quoc|mui ne|ha long|bien|dao/.test(normalized)) return beachImage
  if (/sapa|sa pa|da lat|dalat|ninh binh|tam coc|moc chau|fansipan/.test(normalized)) return mountainImage
  return cityImage
}

function getRawDestination(destination) {
  return String(destination || '').split(',')[0].trim()
}

function getWikiPageTitle(destination) {
  const raw = getRawDestination(destination)
  const normalized = removeDiacritics(raw).toLowerCase()
  return WIKI_PAGE_BY_DESTINATION[normalized] || raw
}

function getPageImage(pages) {
  if (!pages) return null

  const page = Object.values(pages).find((item) => item?.thumbnail?.source)
  return page?.thumbnail?.source || null
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) return null
  return response.json()
}

async function fetchWikiImage(destination) {
  const pageTitle = getWikiPageTitle(destination)
  if (!pageTitle) return null

  const titleParams = new URLSearchParams({
    origin: '*',
    format: 'json',
    action: 'query',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '640',
    redirects: '1',
    titles: pageTitle,
  })
  const titleData = await fetchJson(`${WIKI_API}?${titleParams}`)
  const exactImage = getPageImage(titleData?.query?.pages)
  if (exactImage) return exactImage

  const searchParams = new URLSearchParams({
    origin: '*',
    format: 'json',
    action: 'query',
    generator: 'search',
    gsrsearch: `${pageTitle} du lịch Việt Nam`,
    gsrlimit: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '640',
  })
  const searchData = await fetchJson(`${WIKI_API}?${searchParams}`)
  return getPageImage(searchData?.query?.pages)
}

function imageCanLoad(url) {
  if (!url) return Promise.resolve(false)

  return new Promise((resolve) => {
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

async function fetchUnsplashImage(query) {
  if (!query || !UNSPLASH_KEY) return null

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    )

    if (!response.ok) return null

    const data = await response.json()
    return data?.results?.[0]?.urls?.small || null
  } catch {
    return null
  }
}

async function findDestinationImage(destination) {
  try {
    const wikiUrl = await fetchWikiImage(destination)
    if (await imageCanLoad(wikiUrl)) return wikiUrl

    const raw = getRawDestination(destination)
    const noDiacritics = removeDiacritics(raw)
    const unsplashSearchTerms = [
      `${noDiacritics} Vietnam landmark`,
      `${noDiacritics} Vietnam travel`,
      `${raw} du lịch Việt Nam`,
    ]

    for (const query of unsplashSearchTerms) {
      const url = await fetchUnsplashImage(query)
      if (await imageCanLoad(url)) return url
    }
  } catch {
    return null
  }

  return null
}

export default function useDestinationImage(destination) {
  const [loadResult, setLoadResult] = useState(null)

  useEffect(() => {
    if (!destination || imageCache.has(destination)) return

    let cancelled = false

    async function load() {
      const url = await findDestinationImage(destination)
      if (cancelled) return

      if (url) {
        imageCache.set(destination, url)
        saveCache(imageCache)
      }
      setLoadResult({ destination, done: true, url })
    }

    load()
    return () => { cancelled = true }
  }, [destination])

  if (loadResult?.destination === destination && loadResult.url) return loadResult.url
  if (imageCache.has(destination)) return imageCache.get(destination)
  if (loadResult?.destination === destination && loadResult.done) return getDestinationFallback(destination)

  return null
}
