import React from 'react'
import { formatDateTime } from 'src/utilities/formatDateTime'

import type { Event } from '@/payload-types'

import { Media } from '@/components/Media'

export const EventHero: React.FC<{
  event: Event
}> = ({ event }) => {
  const { tags, coverImage, startDatetime, endDatetime, title } = event

  return (
    <div className="relative -mt-[10.4rem] flex items-end">
      <div className="container z-10 relative lg:grid lg:grid-cols-[1fr_48rem_1fr] text-white pb-8">
        <div className="col-start-1 col-span-1 md:col-start-2 md:col-span-2">
          <div className="uppercase text-sm mb-6">
            {tags?.map((tag, index) => {
              if (typeof tag === 'object' && tag !== null) {
                const { title: tagTitle } = tag

                const titleToUse = tagTitle || 'Untitled tag'

                const isLast = index === tags.length - 1

                return (
                  <React.Fragment key={index}>
                    {titleToUse}
                    {!isLast && <React.Fragment>, &nbsp;</React.Fragment>}
                  </React.Fragment>
                )
              }
              return null
            })}
          </div>

          <div className="">
            <h1 className="mb-6 text-3xl md:text-5xl lg:text-6xl">{title}</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:gap-16">
            {/* {hasAuthors && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm">Author</p>

                  <p>{formatAuthors(populatedAuthors)}</p>
                </div>
              </div>
            )} */}
            {startDatetime && (
              <div className="flex flex-col gap-1">
                <p className="text-sm">Start Date</p>

                <time dateTime={startDatetime}>{formatDateTime(startDatetime)}</time>
              </div>
            )}
            {endDatetime && (
              <div className="flex flex-col gap-1">
                <p className="text-sm">End Date</p>

                <time dateTime={endDatetime}>{formatDateTime(endDatetime)}</time>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-[80vh] select-none">
        {coverImage && typeof coverImage !== 'string' && (
          <Media fill priority imgClassName="-z-10 object-cover" resource={coverImage} />
        )}
        <div className="absolute pointer-events-none left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
      </div>
    </div>
  )
}
