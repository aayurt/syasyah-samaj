'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, type MotionProps } from 'framer-motion'
import { cn } from '@/utilities/ui'

type MotionSpanProps = MotionProps & React.HTMLAttributes<HTMLSpanElement>
const MotionSpan = motion.span as unknown as React.FC<MotionSpanProps>

export const FlipWords = ({
  words,
  duration = 3000,
  className,
}: {
  words: string[]
  duration?: number
  className?: string
}) => {
  const [currentWord, setCurrentWord] = useState<string>(words[0] || '')
  const [isAnimating, setIsAnimating] = useState<boolean>(false)

  const startAnimation = useCallback(() => {
    const nextIndex = (words.indexOf(currentWord) + 1) % words.length
    const word = words[nextIndex] || words[0] || ''
    setCurrentWord(word)
    setIsAnimating(true)
  }, [currentWord, words])

  useEffect(() => {
    if (!isAnimating) {
      const timer = setTimeout(() => {
        startAnimation()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isAnimating, duration, startAnimation])

  if (!currentWord) return null

  return (
    <AnimatePresence
      onExitComplete={() => {
        setIsAnimating(false)
      }}
    >
      <MotionSpan
        key={currentWord}
        initial={{
          opacity: 0,
          y: 10,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 10,
        }}
        exit={{
          opacity: 0,
          y: -20,
          x: 20,
          filter: 'blur(6px)',
          scale: 1.1,
          position: 'absolute',
        }}
        className={cn(
          'z-10 inline-block relative text-left text-primary px-2 font-serif font-black',
          className,
        )}
      >
        {currentWord.split('').map((letter, index) => (
          <MotionSpan
            key={`${currentWord}-${index}`}
            initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              delay: index * 0.04,
              duration: 0.25,
            }}
            className="inline-block"
          >
            {letter === ' ' ? '\u00A0' : letter}
          </MotionSpan>
        ))}
      </MotionSpan>
    </AnimatePresence>
  )
}
