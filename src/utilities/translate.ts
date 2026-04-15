interface TranslateResult {
  success: boolean
  translatedText?: string
  error?: string
}

const LIBRE_TRANSLATE_URL = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com'

export async function translateText(
  text: string,
  targetLang: 'ne' | 'new',
): Promise<TranslateResult> {
  if (!text) {
    return { success: false, error: 'No text to translate' }
  }

  try {
    const response = await fetch(`${LIBRE_TRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: targetLang === 'ne' ? 'ne' : 'new',
        format: 'text',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Translation API error: ${error}` }
    }

    const data = await response.json()
    return { success: true, translatedText: data.translatedText }
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed',
    }
  }
}
