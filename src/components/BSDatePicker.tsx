/**
 * BS (Bikram Sambat) Date Picker Component
 * 
 * A Radix UI-powered date picker that supports both BS (Bikram Sambat/Nepali) 
 * and AD (Gregorian) calendar systems. Users can toggle between BS and AD 
 * date selection.
 * 
 * Features:
 * - BS/AD calendar toggle
 * - Nepali month names display
 * - Automatic BS/AD conversion
 * - Accessible (Radix UI powered)
 * - Works with existing Payload CMS localization (ne, en, new locales)
 */

"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { formatBsDate, parseBsDate, formatBsDateBS, adToBs, bsToAd, getNepaliMonthName, getEnglishMonthName, BSDate, ADDate } from "@/utilities/bsDateUtils"

interface BSDatePickerProps {
  /** Currently selected BS date (optional, controlled mode) */
  selectedBsDate?: BSDate
  /** Callback when BS date changes */
  onBsDateChange?: (bsDate: BSDate | null) => void
  /** Whether the picker is open (controlled mode) */
  isOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (isOpen: boolean) => void
  /** Default to BS mode (true) or AD mode (false) */
  defaultBsMode?: boolean
  /** Placeholder text when no date selected */
  placeholder?: string
  /** Disabled state */
  disabled?: boolean
  /** Additional className */
  className?: string
  /** Additional style */
  style?: React.CSSProperties
}

/**
 * BS Date Picker component using Radix UI Popover
 * Provides BS (Bikram Sambat) and AD (Gregorian) calendar selection
 */
export function BSDatePicker({ 
  selectedBsDate,
  onBsDateChange,
  isOpen,
  onOpenChange,
  defaultBsMode = true,
  placeholder = "मिति छान्नुहोस्",
  disabled,
  className,
  style 
}: BSDatePickerProps) {
  // State for which calendar mode we're in (BS or AD)
  const [bsMode, setBsMode] = React.useState(defaultBsMode)
  
  // State for viewed month/year in the calendar grid
  const [viewYear, setViewYear] = React.useState<number>(() => {
    if (selectedBsDate) return selectedBsDate.year
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = React.useState<number>(() => {
    if (selectedBsDate) return selectedBsDate.month
    return new Date().getMonth() + 1 // JS month 0-11 -> BS month 1-12, but we'll use 1-based
  })

  // State for selected date in either BS or AD format
  const [selectedDate, setSelectedDate] = React.useState<BSDate | null>(selectedBsDate || null)

  // Track the currently viewed year and month inside the popup grid
  const [calendarViewYear, setCalendarViewYear] = React.useState<number>(viewYear)
  const [calendarViewMonth, setCalendarViewMonth] = React.useState<number>(
    viewMonth > 0 && viewMonth <= 12 ? viewMonth : 1
  )

  // Array of BS month names (Nepali and English)
  const bsMonths = [
    "बैशाख (Baisakh)", "जेठ (Jestha)", "आषाढ (Ashadh)", "श्रावण (Shrawan)",
    "भाद्र (Bhadra)", "आशिन (Ashwin)", "कार्तिक (Kartik)", "मंसिर (Mangsir)",
    "पौष (Poush)", "माघ (Magh)", "फाल्गुन (Falgun)", "चैत्र (Chaitra)"
  ]

  const daysOfWeek = ["सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि", "आद"]

  // Generate days grid for the active view
  const calendarGrid = React.useMemo(() => {
    // First day of the targeted BS month
    const firstDayOfMonth = new BSDate()
    firstDayOfMonth.year = calendarViewYear
    firstDayOfMonth.month = calendarViewMonth
    // Get the day of week for the 1st of the month
    // Use the AD date for calculation
    const adDate = bsToAd(calendarViewYear, calendarViewMonth, 1)
    const jsDate = new Date(adDate.year, adDate.month, 1)
    const startingDayOfWeek = jsDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Find total days in current month
    const daysInMonth: BSDate[] = []
    let d = 1
    while (true) {
      try {
        const tempDate = new BSDate()
        tempDate.year = calendarViewYear
        tempDate.month = calendarViewMonth
        tempDate.day = d
        // Check if the month changed - if so, we've gone past the end
        const tempAd = bsToAd(calendarViewYear, calendarViewMonth, d)
        const tempJsDate = new Date(tempAd.year, tempAd.month, 1)
        // If we've moved to next month, stop
        if (tempJsDate.getMonth() !== adDate.month && d > 1) break
        daysInMonth.push({ ...tempDate })
        d++
      } catch {
        break
      }
    }

    return { startingDayOfWeek, daysInMonth }
  }, [calendarViewYear, calendarViewMonth])

  const handlePrevMonth = () => {
    if (calendarViewMonth === 1) {
      setCalendarViewYear(calendarViewYear - 1)
      setCalendarViewMonth(12)
    } else {
      setCalendarViewMonth(calendarViewMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (calendarViewMonth === 12) {
      setCalendarViewYear(calendarViewYear + 1)
      setCalendarViewMonth(1)
    } else {
      setCalendarViewMonth(calendarViewMonth + 1)
    }
  }

  // Format selected date for display
  const displayDate = selectedDate 
    ? `${formatBsDate(selectedDate)} (${getNepaliMonthName(selectedDate.month)})`
    : placeholder

  return (
    <PopoverPrimitive.Root open={isOpen !== undefined ? isOpen : true} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          disabled={disabled}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground"
          aria-haspopup="dialog"
          aria-label="Select date"
        >
          {selectedDate ? (
            <>
              <CalendarIcon className="h-4 w-4 opacity-50" />
              <span>{displayDate}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {bsMode ? "मिति छान्नुहोस् (BS)" : "Select Date (AD)"}
            </span>
          )}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-80 rounded-md border bg-popover p-4 text-popover-foreground shadow-outline outline-none data-[state=open]:animate-in data-[state=closed]:animate-out"
        >
          {/* Header with month/year display and toggle */}
          <div className="flex items-center justify-between pb-4">
            <div className="text-sm font-medium">
              {bsMode ? 
                `${bsMonths[calendarViewMonth - 1]} ${calendarViewYear}` 
                : 
                new Date(calendarViewYear, 0, 1).toLocaleString('default', { month: 'long' })
              }
            </div>
            
            <div className="flex items-gap-2">
              {/* Prev month button */}
              <button
                onClick={handlePrevMonth}
                disabled={disabled}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent p-0 opacity-70 hover:opacity-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Next month button */}
              <button
                onClick={handleNextMonth}
                disabled={disabled}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent p-0 opacity-70 hover:opacity-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            {/* BS/AD Toggle Button */}
            <button
              onClick={() => setBsMode(!bsMode)}
              disabled={disabled}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Toggle between BS and AD calendar"
            >
              {bsMode ? "AD" : "BS"}
            </button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-2">
            {daysOfWeek.map((day, index) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {/* Blank padding slots for alignment */}
            {Array.from({ length: (calendarGrid.startingDayOfWeek + 6) % 7 }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}

            {/* Actual Month Days */}
            {calendarGrid.daysInMonth.map((dateObj) => {
              const isSelected =
                selectedDate?.year === dateObj.year &&
                selectedDate?.month === dateObj.month &&
                selectedDate?.day === dateObj.day

              return (
                <button
                  key={formatBsDate(dateObj)}
                  onClick={() => {
                    setSelectedDate(dateObj)
                    if (onBsDateChange) onBsDateChange(dateObj)
                  }}
                  className={`h-8 w-8 rounded-md p-0 font-normal transition-colors hover:bg-accent hover:text-accent-foreground ${isSelected ? "bg-primary text-primary-foreground font-semibold" : "bg-transparent"}`}
                  aria-label={isSelected ? "Selected" : `Select ${getNepaliMonthName(dateObj.month)} ${dateObj.day}, ${dateObj.year}`}
                >
                  {dateObj.day}
                </button>
              )
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

/**
 * Hook for using BS date picker state
 * Provides selected date, toggle mode, and conversion functions
 */
export function useBSDatePicker(initialBsDate?: BSDate) {
  const [selectedBsDate, setSelectedBsDate] = React.useState<BSDate | null>(initialBsDate || null)
  const [bsMode, setBsMode] = React.useState(true)

  const toggleMode = () => setBsMode(!bsMode)

  const getDisplayDate = () => {
    if (!selectedBsDate) return "मिति छान्नुहोस्"
    return `${formatBsDate(selectedBsDate)} (${getNepaliMonthName(selectedBsDate.month)})`
  }

  const getAdDate = () => {
    if (!selectedBsDate) return null
    return bsToAd(selectedBsDate.year, selectedBsDate.month, selectedBsDate.day)
  }

  return {
    selectedBsDate,
    bsMode,
    toggleMode,
    setSelectedBsDate,
    getDisplayDate,
    getAdDate,
    setBsMode: toggleMode
  }
}