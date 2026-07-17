import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { Search } from '@/search/Component'
import PageClient from './page.client'
import { CardPostData } from '@/components/Card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getStaticParams, setStaticParamsLocale } from '@/locales/server'

export function generateStaticParams() {
  return getStaticParams()
}

function buildHref(q: string | undefined, page: number): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/search${qs ? `?${qs}` : ''}`
}

type Args = {
  params: Promise<{
    locale: string
  }>
  searchParams: Promise<{
    q: string
    page: string
  }>
}
export default async function Page({ params: paramsPromise, searchParams: searchParamsPromise }: Args) {
  const { locale } = await paramsPromise
  setStaticParamsLocale(locale)
  const { q: query, page: pageParam } = await searchParamsPromise
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'search',
    depth: 1,
    limit: 12,
    page,
    locale: locale as 'en' | 'ne',
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
    },
    ...(query
      ? {
        where: {
          or: [
            {
              title: {
                like: query,
              },
            },
            {
              'meta.description': {
                like: query,
              },
            },
            {
              'meta.title': {
                like: query,
              },
            },
            {
              slug: {
                like: query,
              },
            },
          ],
        },
      }
      : {}),
  })

  const { page: currentPage, totalPages } = posts

  return (
    <div className="pt-24 pb-24">
      <PageClient />
      <div className="container mb-16">
        <div className="prose dark:prose-invert max-w-none text-center">
          <h1 className="mb-8 lg:mb-16">Search</h1>

          <div className="max-w-[50rem] mx-auto">
            <Search />
          </div>
        </div>
      </div>

      {posts.totalDocs > 0 ? (
        <>
          <div className="container mb-8">
            <PageRange
              collection="search"
              currentPage={currentPage}
              limit={12}
              totalDocs={posts.totalDocs}
            />
          </div>
          <CollectionArchive posts={posts.docs as CardPostData[]} />
          {totalPages && totalPages > 1 && (
            <nav className="container mx-auto flex w-full justify-center my-12" aria-label="pagination">
              <ul className="flex flex-row items-center gap-1">
                <li>
                  <Link
                    href={buildHref(query, page - 1)}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'default' }),
                      'gap-1 pl-2.5',
                      page <= 1 && 'pointer-events-none opacity-50',
                    )}
                    aria-label="Go to previous page"
                    aria-disabled={page <= 1}
                    tabIndex={page <= 1 ? -1 : undefined}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </Link>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - page) <= 1 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <li>
                          <span className="flex h-9 w-9 items-center justify-center" aria-hidden>
                            ...
                          </span>
                        </li>
                      )}
                      <li>
                        <Link
                          href={buildHref(query, p)}
                          className={buttonVariants({
                            size: 'icon',
                            variant: p === page ? 'outline' : 'ghost',
                          })}
                          aria-current={p === page ? 'page' : undefined}
                        >
                          {p}
                        </Link>
                      </li>
                    </React.Fragment>
                  ))}
                <li>
                  <Link
                    href={buildHref(query, page + 1)}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'default' }),
                      'gap-1 pr-2.5',
                      totalPages && page >= totalPages && 'pointer-events-none opacity-50',
                    )}
                    aria-label="Go to next page"
                    aria-disabled={totalPages ? page >= totalPages : true}
                    tabIndex={totalPages && page >= totalPages ? -1 : undefined}
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </li>
              </ul>
            </nav>
          )}
        </>
      ) : (
        <div className="container">No results found.</div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Afno Events Search`,
  }
}
