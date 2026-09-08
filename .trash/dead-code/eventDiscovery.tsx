import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Calendar, MapPin, Search, TrendingUp } from 'lucide-react'

export default async function EventDiscovery() {
  return (
    <section className="py-20 bg-background relative">
      <div className="container space-y-12">
        {/* Search Bar Component */}
        <div className="max-w-5xl mx-auto -mt-32 relative z-20 bg-card/80 backdrop-blur-sm p-6 rounded-3xl shadow-2xl border border-border flex flex-col lg:row items-center gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search events or artists"
                className="pl-12 h-14 bg-background/50 border-none rounded-2xl"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="All Locations"
                className="pl-12 h-14 bg-background/50 border-none rounded-2xl"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="date"
                placeholder="Select Date"
                className="pl-12 h-14 bg-background/50 border-none rounded-2xl"
              />
            </div>
          </div>
          <Button size="lg" className="h-14 px-12 w-full lg:w-auto rounded-2xl text-lg font-bold">
            Search
          </Button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-12 gap-6">
          <h2 className="text-4xl font-bold tracking-tight">Trending Events</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
            {['All', 'Music', 'Tech', 'Workshops', 'Festivals'].map((cat) => (
              <Button
                key={cat}
                variant="ghost"
                className="rounded-full px-6 hover:bg-primary hover:text-primary-foreground transition-all"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Event Discovery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="group overflow-hidden hover:shadow-2xl transition-all duration-500 border-border rounded-2xl bg-card/30 backdrop-blur-sm"
            >
              <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                <div className="absolute top-4 right-4 z-10 bg-primary/90 backdrop-blur-md text-primary-foreground px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  Trending
                </div>
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                  <TrendingUp
                    size={64}
                    className="opacity-10 group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
              </div>
              <CardHeader className="space-y-3">
                <div className="flex items-center text-sm font-semibold text-primary">
                  <Calendar size={16} className="mr-2" />
                  Oct 12, 2026 • 6:00 PM
                </div>
                <CardTitle className="text-2xl leading-tight group-hover:text-primary transition-colors cursor-pointer">
                  Digital Renaissance: Web3 Workshop
                </CardTitle>
                <CardDescription className="flex items-center text-base">
                  <MapPin size={16} className="mr-2 text-muted-foreground" /> Kathmandu, Nepal
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center pt-6 border-t border-border/50">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                    Starts from
                  </span>
                  <span className="font-extrabold text-2xl">Rs. 1,500</span>
                </div>
                <Button className="rounded-xl px-6 py-6 font-bold">Get Tickets</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
