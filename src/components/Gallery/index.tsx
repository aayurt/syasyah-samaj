'use client'

import React, { useState } from 'react'
import { Media as MediaPayload } from '@/payload-types'
import { Media } from '../Media'
import RichText from '../RichText'

const ITEMS_PER_PAGE = 5

export const Gallery = ({
  gallery = [],
  title,
  description,
}: {
  gallery?:
  | {
    image?: (number | null) | MediaPayload
    id?: string | null
  }[]
  | null
  title?: string
  description?: string
}) => {
  const [currentPage, setCurrentPage] = useState(1)

  const safeGallery = gallery || []
  const totalItems = safeGallery.length
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const itemsToShow = safeGallery.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section id="gallery" className="py-24 bg-muted dark:bg-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">{title}</h2>
            {description && <p className="text-muted-foreground mt-2">{description}</p>}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 text-muted-foreground hover:text-primary disabled:opacity-30"
              >
                {'<'}
              </button>

              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${currentPage === pageNum
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted-foreground/10'
                      }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 text-muted-foreground hover:text-primary disabled:opacity-30"
              >
                {'>'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px] md:auto-rows-[250px]">
          {itemsToShow.map((galleryItem, i) => (
            <div
              key={galleryItem.id || i}
              className={`relative overflow-hidden rounded-3xl group ${i === 0 ? 'md:col-span-2 md:row-span-2' : 'col-span-1 row-span-1'
                }`}
            >
              {galleryItem.image && typeof galleryItem.image === 'object' ? (
                <Media
                  fill
                  priority={i === 0}
                  imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                  resource={galleryItem.image}
                />
              ) : (
                <div className="w-full h-full bg-muted-foreground/10" />
              )}

              {galleryItem.image &&
                typeof galleryItem.image === 'object' &&
                galleryItem.image.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-white text-center text-sm font-medium">
                      <RichText data={galleryItem.image.caption} enableGutter={false} />
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
