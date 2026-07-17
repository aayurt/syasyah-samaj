import { BeforeSync, DocToSync } from '@payloadcms/plugin-search/types'

export const beforeSyncWithSearch: BeforeSync = async ({ originalDoc, searchDoc }) => {
  const {
    doc: { relationTo: collection },
  } = searchDoc

  const { slug, id, categories, title, meta } = originalDoc

  const modifiedDoc: DocToSync = {
    ...searchDoc,
    slug,
    meta: {
      ...meta,
      title: meta?.title || title,
      image: meta?.image?.id || meta?.image,
      description: meta?.description,
    },
    categories: [],
  }

  if (categories && Array.isArray(categories) && categories.length > 0) {
    try {
      modifiedDoc.categories = categories.map((category) => {
        const { id, title } = category
        return { relationTo: 'categories', id, title }
      })
    } catch (_err) {
      console.error(
        `Failed. Category not found when syncing collection '${collection}' with id: '${id}' to search.`,
      )
    }
  }

  if (collection === 'events') {
    modifiedDoc.eventDate = originalDoc.eventDate || null
    modifiedDoc.location = originalDoc.location?.locality || null
  }

  if (collection === 'archives') {
    modifiedDoc.era = originalDoc.era || null
    if (originalDoc.year) {
      modifiedDoc.eventDate = new Date(originalDoc.year, 0, 1).toISOString()
    }
  }

  return modifiedDoc
}
