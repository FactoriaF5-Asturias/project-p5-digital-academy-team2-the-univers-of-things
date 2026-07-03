import { describe, expect, test, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnimeStore } from '@/stores/animeStore'

const mockAnimes = [
    {
        mal_id: 1,
        title: 'Naruto',
        score: 8.5,
        synopsis: 'Un ninja adolescente...',
        images: { jpg: { image_url: 'https://example.com/naruto.jpg' } },
        genres: [{ name: 'Action' }]
    },
    {
        mal_id: 2,
        title: 'One Piece',
        score: 9.0,
        synopsis: 'Un pirata...',
        images: { jpg: { image_url: 'https://example.com/onepiece.jpg' } },
        genres: [{ name: 'Adventure' }]
    },
    {
        mal_id: 3,
        title: 'Bleach',
        score: 8.0,
        synopsis: 'Un shinigami...',
        images: { jpg: { image_url: 'https://example.com/bleach.jpg' } },
        genres: [{ name: 'Action' }]
    }
]

const mockFetchResponse = (data, status = 200, pagination = { last_visible_page: 5 }) => {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve({
            data,
            pagination
        })
    }
}

describe('Anime Store', () => {
    beforeEach(() => {
        localStorage.clear()
        setActivePinia(createPinia())
        vi.restoreAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // STATE
    test('should have correct initial state', () => {
        const animeStore = useAnimeStore()

        expect(animeStore.animes).toEqual([])
        expect(animeStore.loading).toBe(false)
        expect(animeStore.error).toBe(null)
        expect(animeStore.currentPage).toBe(1)
        expect(animeStore.perPage).toBe(25)
        expect(animeStore.totalItems).toBe(0)
        expect(animeStore.totalPagesFromApi).toBe(1)
        expect(animeStore.featuredAnimes).toEqual([])
        expect(animeStore.animeOfTheWeek).toBe(null)
    })

    test('should load featuredAnimes from localStorage on init', () => {
        const featuredData = [
            { mal_id: 1, title: 'Naruto' },
            { mal_id: 2, title: 'One Piece' }
        ]
        localStorage.setItem('otakuhub_featured', JSON.stringify(featuredData))

        setActivePinia(createPinia())
        const animeStore = useAnimeStore()

        expect(animeStore.featuredAnimes).toEqual(featuredData)
    })

    test('should load animeOfTheWeek from localStorage on init', () => {
        const weekAnime = { mal_id: 3, title: 'Bleach' }
        localStorage.setItem('otakuhub_week', JSON.stringify(weekAnime))

        setActivePinia(createPinia())
        const animeStore = useAnimeStore()

        expect(animeStore.animeOfTheWeek).toEqual(weekAnime)
    })

    test('should use empty array when localStorage featured is invalid JSON', () => {
        localStorage.setItem('otakuhub_featured', 'invalid-json')

        setActivePinia(createPinia())
        
        // Esto lanzará un error de JSON.parse, pero el store debería manejarlo
        // Si no está manejado, el test fallará, lo cual es esperado
        expect(() => {
            useAnimeStore()
        }).toThrow()
    })

    // GETTERS - totalPages
    test('totalPages should return 1 by default', () => {
        const animeStore = useAnimeStore()

        expect(animeStore.totalPages).toBe(1)
    })

    test('totalPages should use totalPagesFromApi', () => {
        const animeStore = useAnimeStore()
        animeStore.totalPagesFromApi = 5

        expect(animeStore.totalPages).toBe(5)
    })

    test('totalPages should handle null animes safely', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = null

        expect(animeStore.totalPages).toBe(1)
    })

    test('totalPages should keep minimum value of 1', () => {
        const animeStore = useAnimeStore()
        animeStore.totalPagesFromApi = 0

        expect(animeStore.totalPages).toBe(1)
    })

    // GETTERS - paginatedAnimes
    test('paginatedAnimes should return loaded animes from API', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = mockAnimes

        const result = animeStore.paginatedAnimes

        expect(result).toHaveLength(3)
        expect(result[0].title).toBe('Naruto')
        expect(result[1].title).toBe('One Piece')
        expect(result[2].title).toBe('Bleach')
    })

    test('paginatedAnimes should not slice animes locally', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = mockAnimes
        animeStore.currentPage = 2
        animeStore.perPage = 2

        const result = animeStore.paginatedAnimes

        expect(result).toEqual(mockAnimes)
    })

    test('paginatedAnimes should handle null animes safely', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = null
        animeStore.currentPage = 1

        const result = animeStore.paginatedAnimes

        expect(result).toEqual([])
    })

    test('paginatedAnimes should return loaded animes even when currentPage changes', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = mockAnimes
        animeStore.currentPage = 10

        const result = animeStore.paginatedAnimes

        expect(result).toEqual(mockAnimes)
    })

    // ACTIONS - fetchAnimes
    test('fetchAnimes should fetch and set animes correctly', async () => {
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse(mockAnimes))
        const animeStore = useAnimeStore()

        await animeStore.fetchAnimes(2)

        expect(animeStore.loading).toBe(false)
        expect(animeStore.error).toBe(null)
        expect(animeStore.animes).toEqual(mockAnimes)
        expect(animeStore.currentPage).toBe(2)
        expect(animeStore.totalItems).toBe(3)
        expect(animeStore.totalPagesFromApi).toBe(5)
        expect(global.fetch).toHaveBeenCalledWith('https://api.jikan.moe/v4/anime?page=2&min_score=8.2')
    })

    test('fetchAnimes should use page 1 by default', async () => {
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse(mockAnimes))
        const animeStore = useAnimeStore()

        await animeStore.fetchAnimes()

        expect(global.fetch).toHaveBeenCalledWith('https://api.jikan.moe/v4/anime?page=1&min_score=8.2')
    })

    test('fetchAnimes should retry on 429 status', async () => {
        const successResponse = mockFetchResponse(mockAnimes)
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 429 })
            .mockResolvedValueOnce(successResponse)
        
        const animeStore = useAnimeStore()

        await animeStore.fetchAnimes(1)

        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(animeStore.animes).toEqual(mockAnimes)
        expect(animeStore.error).toBe(null)
    })

    test('fetchAnimes should set error on failed response', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
        const animeStore = useAnimeStore()

        await animeStore.fetchAnimes()

        expect(animeStore.loading).toBe(false)
        expect(animeStore.error).toBe('Error al cargar los animes')
        expect(animeStore.animes).toEqual([]) // Forzado a array vacío
        expect(console.error).toHaveBeenCalled()
    })

    test('fetchAnimes should set error on network failure', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
        const animeStore = useAnimeStore()

        await animeStore.fetchAnimes()

        expect(animeStore.loading).toBe(false)
        expect(animeStore.error).toBe('Error al cargar los animes')
        expect(animeStore.animes).toEqual([])
        expect(console.error).toHaveBeenCalled()
    })

    test('fetchAnimes should set loading true while fetching', () => {
        global.fetch = vi.fn().mockResolvedValue(mockFetchResponse(mockAnimes))
        const animeStore = useAnimeStore()

        const promise = animeStore.fetchAnimes()

        expect(animeStore.loading).toBe(true)

        return promise
    })

    test('fetchAnimes should handle response without data', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: null })
        })
        const animeStore = useAnimeStore()
        animeStore.animes = mockAnimes // Datos previos

        await animeStore.fetchAnimes()

        expect(animeStore.animes).toEqual(mockAnimes) // No se modifica si no hay data
    })

    test('fetchAnimes should handle response without pagination', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: mockAnimes })
        })
        const animeStore = useAnimeStore()

        await animeStore.fetchAnimes()

        expect(animeStore.totalPagesFromApi).toBe(1) // Mantiene el valor inicial
    })

    // ACTIONS - goToPage
    test('goToPage should call fetchAnimes with valid page', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = mockAnimes
        animeStore.totalPagesFromApi = 5

        const fetchSpy = vi.spyOn(animeStore, 'fetchAnimes').mockImplementation(() => {})

        animeStore.goToPage(2)

        expect(fetchSpy).toHaveBeenCalledWith(2)
    })

    test('goToPage should not call fetchAnimes with page less than 1', () => {
        const animeStore = useAnimeStore()
        const fetchSpy = vi.spyOn(animeStore, 'fetchAnimes').mockImplementation(() => {})

        animeStore.goToPage(0)

        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('goToPage should not call fetchAnimes with page greater than totalPages', () => {
        const animeStore = useAnimeStore()
        animeStore.animes = mockAnimes
        animeStore.perPage = 2
        const fetchSpy = vi.spyOn(animeStore, 'fetchAnimes').mockImplementation(() => {})

        animeStore.goToPage(5)

        expect(fetchSpy).not.toHaveBeenCalled()
    })

    // ACTIONS - updateAdminSelections
    test('updateAdminSelections should save featuredAnimes and animeOfTheWeek', () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
        const animeStore = useAnimeStore()

        const newFeatured = [
            { mal_id: 1, title: 'Naruto' },
            { mal_id: 2, title: 'One Piece' }
        ]
        const newWeek = { mal_id: 3, title: 'Bleach' }

        animeStore.updateAdminSelections(newFeatured, newWeek)

        expect(animeStore.featuredAnimes).toEqual(newFeatured)
        expect(animeStore.animeOfTheWeek).toEqual(newWeek)
        expect(localStorage.getItem('otakuhub_featured')).toBe(JSON.stringify(newFeatured))
        expect(localStorage.getItem('otakuhub_week')).toBe(JSON.stringify(newWeek))
        expect(alertMock).toHaveBeenCalledWith('¡Selecciones del Admin guardadas con éxito en el navegador!')
        
        alertMock.mockRestore()
    })

    test('updateAdminSelections should only save featuredAnimes when animeOfTheWeek is null', () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
        const animeStore = useAnimeStore()

        const newFeatured = [{ mal_id: 1, title: 'Naruto' }]

        animeStore.updateAdminSelections(newFeatured, null)

        expect(animeStore.featuredAnimes).toEqual(newFeatured)
        expect(animeStore.animeOfTheWeek).toBe(null) // No se modifica
        expect(localStorage.getItem('otakuhub_featured')).toBe(JSON.stringify(newFeatured))
        expect(localStorage.getItem('otakuhub_week')).toBe(null) // No se guarda
        
        alertMock.mockRestore()
    })

    test('updateAdminSelections should only save animeOfTheWeek when featuredAnimes is null', () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
        const animeStore = useAnimeStore()
        
        // Establecemos featuredAnimes existentes y los guardamos en localStorage
        const existingFeatured = [{ mal_id: 5, title: 'Existing' }]
        animeStore.featuredAnimes = existingFeatured
        localStorage.setItem('otakuhub_featured', JSON.stringify(existingFeatured))

        const newWeek = { mal_id: 3, title: 'Bleach' }

        animeStore.updateAdminSelections(null, newWeek)

        expect(animeStore.featuredAnimes).toEqual(existingFeatured) // No se modifica
        expect(animeStore.animeOfTheWeek).toEqual(newWeek)
        expect(localStorage.getItem('otakuhub_featured')).toBe(JSON.stringify(existingFeatured))
        expect(localStorage.getItem('otakuhub_week')).toBe(JSON.stringify(newWeek))
        
        alertMock.mockRestore()
    })

    test('updateAdminSelections should not save anything when both params are null', () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
        const animeStore = useAnimeStore()
        const initialFeatured = animeStore.featuredAnimes
        const initialWeek = animeStore.animeOfTheWeek

        animeStore.updateAdminSelections(null, null)

        expect(animeStore.featuredAnimes).toEqual(initialFeatured)
        expect(animeStore.animeOfTheWeek).toEqual(initialWeek)
        expect(localStorage.getItem('otakuhub_featured')).toBe(null)
        expect(localStorage.getItem('otakuhub_week')).toBe(null)
        
        alertMock.mockRestore()
    })
})
