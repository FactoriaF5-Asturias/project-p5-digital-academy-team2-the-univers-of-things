import { test, expect } from '@playwright/test'

const naruto = {
    mal_id: 1,
    title: 'Naruto',
    score: 8.5,
    synopsis: 'Un ninja adolescente...',
    images: { jpg: { image_url: 'https://via.placeholder.com/260x400' } },
    genres: [{ name: 'Action' }]
}

const onePiece = {
    mal_id: 2,
    title: 'One Piece',
    score: 9.0,
    synopsis: 'Un pirata...',
    images: { jpg: { image_url: 'https://via.placeholder.com/260x400' } },
    genres: [{ name: 'Adventure' }]
}

const mockAnimeApi = async (page) => {
    await page.route('**/api.jikan.moe/v4/anime**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: [naruto, onePiece],
                pagination: { last_visible_page: 1 }
            })
        })
    })
}

const setFeaturedAnimes = async (page, featured) => {
    await page.addInitScript((items) => {
        localStorage.setItem('animes_destacados', JSON.stringify(items))
    }, featured)
}

const goHome = async (page) => {
    await mockAnimeApi(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
}

test('featured section is visible when admin has configured featured animes', async ({ page }) => {
    await setFeaturedAnimes(page, [naruto])
    await goHome(page)

    const featuredSection = page.locator('.featured')
    await expect(featuredSection).toBeVisible({ timeout: 10000 })
})

test('featured section shows "Featured Anime" title', async ({ page }) => {
    await setFeaturedAnimes(page, [naruto])
    await goHome(page)

    const featuredTitle = page.locator('.featured__title h1')
    await expect(featuredTitle).toBeVisible({ timeout: 10000 })
    await expect(featuredTitle).toContainText('Featured Anime')
})

test('featured section shows anime cards when featured animes exist', async ({ page }) => {
    await setFeaturedAnimes(page, [naruto, onePiece])
    await goHome(page)

    const featuredCards = page.locator('.featured-grid .anime-card')
    await expect(featuredCards.first()).toBeVisible({ timeout: 10000 })
    await expect(featuredCards).toHaveCount(2)
})

test('featured section shows correct anime titles in cards', async ({ page }) => {
    await setFeaturedAnimes(page, [naruto, onePiece])
    await goHome(page)

    const firstCard = page.locator('.featured-grid .anime-card').nth(0)
    const secondCard = page.locator('.featured-grid .anime-card').nth(1)

    await expect(firstCard.locator('.card-title')).toContainText('Naruto')
    await expect(secondCard.locator('.card-title')).toContainText('One Piece')
})

test('featured section shows empty state when no featured animes', async ({ page }) => {
    await goHome(page)

    const emptyMessage = page.locator('.featured-wrapper .text-muted')
    await expect(emptyMessage).toBeVisible()
    await expect(emptyMessage).toContainText('No hay')
})

test('featured section is hidden when no featured animes configured', async ({ page }) => {
    await goHome(page)

    const featuredSection = page.locator('.featured')
    await expect(featuredSection).not.toBeVisible()
})

test('featured grid has 4 columns layout', async ({ page }) => {
    await setFeaturedAnimes(page, [naruto])
    await goHome(page)

    const featuredGrid = page.locator('.featured-grid')
    await expect(featuredGrid).toHaveCSS('display', 'grid')
})
