'use client' // Required if using Next.js App Router

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
  // 1. Use React State so the component re-renders on change
  const [currentPage, setCurrentPage] = useState(1)

  const safeGallery = gallery || []
  const totalItems = safeGallery.length
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  // 2. Logic to get current items
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const itemsToShow = safeGallery.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // 3. Navigation Handler
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      // Scroll to top of gallery smoothly when page changes
      document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section id="gallery" className="py-24 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{title}</h2>
            {description && <p className="text-slate-500 mt-2">{description}</p>}
          </div>

          {/* Pagination UI */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
              >
                {'<'}
              </button>

              {/* Generate page numbers */}
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-500 hover:bg-slate-200'
                      }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
              >
                {'>'}
              </button>
            </div>
          )}
        </div>

        {/* Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px] md:auto-rows-[250px]">
          {itemsToShow.map((galleryItem, i) => (
            <div
              key={galleryItem.id || i}
              className={`relative overflow-hidden rounded-3xl group ${i === 0 ? 'md:col-span-2 md:row-span-2' : 'col-span-1 row-span-1'
                }`}
            >
              <Media
                fill
                priority={i === 0}
                imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                resource={galleryItem.image}
              />

              {/* Caption Overlay */}
              {/* Note: Ensure the check matches your Payload schema (image.caption vs galleryItem.caption) */}
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
