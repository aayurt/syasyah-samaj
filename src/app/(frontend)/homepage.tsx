import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Calendar, MapPin, Zap, TrendingUp, Users, ShieldCheck, Apple, PlayCircle, MessageSquare, ArrowRight } from 'lucide-react'

export default async function HomePage() {
    return (
        <div className="flex flex-col min-h-screen -mt-[6.76rem]">
            {/* Hero Section */}
            <section className="relative  h-[100vh] flex items-center justify-center overflow-hidden">
                {/* Video Background */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute z-0 w-auto min-w-full min-h-full max-w-none filter brightness-[0.4]"
                >
                    <source src="/video/afno-diverse.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                </video>

                {/* Hero Content */}
                <div className="container relative z-10 text-center text-white space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                            Elevate Your Events. <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">
                                Discover Unforgettable Moments.
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl max-w-3xl mx-auto text-gray-300">
                            The most intuitive ticketing platform for Nepal’s creators and experience-seekers.
                            Launch your vision in minutes or find your next adventure today.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        <Button size="lg" className="text-lg px-8 py-7 rounded-full shadow-lg hover:shadow-primary/20 transition-all">
                            Find Events
                        </Button>
                        <Button size="lg" variant="secondary" className="text-lg px-8 py-7 rounded-full bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-md text-white transition-all">
                            Create Event
                        </Button>
                    </div>

                    {/* App Store Buttons in Hero */}
                    <div className="flex flex-wrap items-center justify-center gap-6 pt-12 opacity-80 hover:opacity-100 transition-opacity">
                        <p className="w-full text-sm font-medium uppercase tracking-widest text-gray-400 mb-2">Download the Mobile App</p>
                        <Button variant="outline" className="bg-black/40 border-white/10 text-white rounded-xl py-6 px-6 flex items-center gap-3 hover:bg-black/60 transition-all">
                            <Apple size={28} />
                            <div className="text-left">
                                <p className="text-[10px] uppercase leading-none opacity-60">Download on the</p>
                                <p className="text-lg font-semibold leading-none">App Store</p>
                            </div>
                        </Button>
                        <Button variant="outline" className="bg-black/40 border-white/10 text-white rounded-xl py-6 px-6 flex items-center gap-3 hover:bg-black/60 transition-all">
                            <PlayCircle size={28} />
                            <div className="text-left">
                                <p className="text-[10px] uppercase leading-none opacity-60">Get it on</p>
                                <p className="text-lg font-semibold leading-none">Google Play</p>
                            </div>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Search & Discovery Section */}
            <section className="py-20 bg-background relative">
                <div className="container space-y-12">
                    {/* Search Bar Component */}
                    <div className="max-w-5xl mx-auto -mt-32 relative z-20 bg-card/80 backdrop-blur-sm p-6 rounded-3xl shadow-2xl border border-border flex flex-col lg:row items-center gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <Input placeholder="Search events or artists" className="pl-12 h-14 bg-background/50 border-none rounded-2xl" />
                            </div>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <Input placeholder="All Locations" className="pl-12 h-14 bg-background/50 border-none rounded-2xl" />
                            </div>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <Input type="date" placeholder="Select Date" className="pl-12 h-14 bg-background/50 border-none rounded-2xl" />
                            </div>
                        </div>
                        <Button size="lg" className="h-14 px-12 w-full lg:w-auto rounded-2xl text-lg font-bold">Search</Button>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center pt-12 gap-6">
                        <h2 className="text-4xl font-bold tracking-tight">Trending Events</h2>
                        <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
                            {['All', 'Music', 'Tech', 'Workshops', 'Festivals'].map((cat) => (
                                <Button key={cat} variant="ghost" className="rounded-full px-6 hover:bg-primary hover:text-primary-foreground transition-all">
                                    {cat}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Event Discovery Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="group overflow-hidden hover:shadow-2xl transition-all duration-500 border-border rounded-2xl bg-card/30 backdrop-blur-sm">
                                <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                                    <div className="absolute top-4 right-4 z-10 bg-primary/90 backdrop-blur-md text-primary-foreground px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                                        Trending
                                    </div>
                                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                                        <TrendingUp size={64} className="opacity-10 group-hover:scale-110 transition-transform duration-700" />
                                    </div>
                                </div>
                                <CardHeader className="space-y-3">
                                    <div className="flex items-center text-sm font-semibold text-primary">
                                        <Calendar size={16} className="mr-2" />
                                        Oct 12, 2026 • 6:00 PM
                                    </div>
                                    <CardTitle className="text-2xl leading-tight group-hover:text-primary transition-colors cursor-pointer">Digital Renaissance: Web3 Workshop</CardTitle>
                                    <CardDescription className="flex items-center text-base">
                                        <MapPin size={16} className="mr-2 text-muted-foreground" /> Kathmandu, Nepal
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex justify-between items-center pt-6 border-t border-border/50">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Starts from</span>
                                        <span className="font-extrabold text-2xl">Rs. 1,500</span>
                                    </div>
                                    <Button className="rounded-xl px-6 py-6 font-bold">Get Tickets</Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Us Section */}
            <section className="py-28 bg-muted/30 relative">
                <div className="container">
                    <div className="max-w-3xl mb-20">
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Built for Organizers,<br />Loved by Fans.</h2>
                        <p className="text-muted-foreground text-xl leading-relaxed">
                            Everything you need to sell tickets, manage attendees, and grow your event success from a single dashboard.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { icon: Zap, title: "Low Fees", desc: "Maximize your profits with the lowest commission rates in the market. No hidden costs." },
                            { icon: Users, title: "Instant Payouts", desc: "Forget the wait. Access your earnings as tickets sell to keep your event momentum going." },
                            { icon: TrendingUp, title: "Powerful Analytics", desc: "Deep dive into attendee data and sales trends with our real-time, data-rich dashboard." },
                            { icon: ShieldCheck, title: "Global Reach", desc: "International payment support and local marketing tools built specifically for Nepal." }
                        ].map((feature, i) => (feature &&
                            <div key={i} className="bg-card p-10 rounded-[2.5rem] border border-border space-y-6 hover:shadow-xl transition-all group">
                                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                                    <feature.icon size={32} />
                                </div>
                                <h3 className="text-2xl font-bold">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed text-lg">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Vendor & Partnership Section */}
            <section className="py-28 relative overflow-hidden bg-background border-y border-border">
                <div className="container grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-bold uppercase tracking-wider">
                            <MessageSquare size={16} />
                            Partnership Opportunities
                        </div>
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight">Become an <br />Afno Partner.</h2>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            Are you a large-scale venue, a frequent event organizer, or a vendor looking to reach thousands of attendees?
                            Let's discuss custom solutions and priority placements for your brand.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <Button size="lg" className="rounded-2xl h-16 px-8 text-lg font-bold flex items-center gap-2">
                                Vendor Sign Up <ArrowRight size={20} />
                            </Button>
                            <Button size="lg" variant="outline" className="rounded-2xl h-16 px-8 text-lg font-bold">
                                Talk to Sales
                            </Button>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square bg-gradient-to-tr from-primary/20 to-blue-500/10 rounded-[3rem] absolute -inset-4 -rotate-3 blur-2xl -z-10" />
                        <div className="bg-card border border-border p-12 rounded-[3.5rem] shadow-2xl space-y-8">
                            <h3 className="text-3xl font-bold">Quick Inquiry</h3>
                            <div className="space-y-5">
                                <Input placeholder="Full Name" className="h-14 rounded-xl px-6" />
                                <Input placeholder="Organization Name" className="h-14 rounded-xl px-6" />
                                <Input placeholder="Email Address" type="email" className="h-14 rounded-xl px-6" />
                                <Button className="w-full h-16 rounded-xl text-lg font-bold shadow-lg shadow-primary/20">Send Message</Button>
                            </div>
                            <p className="text-center text-sm text-muted-foreground">
                                Our team typically responds within 24 hours.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section / App Showcase */}
            <section className="py-28 bg-primary text-primary-foreground relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[50rem] h-[50rem] bg-white/10 rounded-full blur-[120px]" />
                <div className="container text-center space-y-12 relative z-10">
                    <div className="space-y-6">
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight">Experience events on the go.</h2>
                        <p className="text-xl md:text-2xl opacity-80 max-w-3xl mx-auto">
                            Scan tickets, browse new events, and manage your bookings anytime, anywhere.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6">
                        <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 rounded-2xl h-20 px-10 flex items-center gap-4 transition-all hover:scale-105">
                            <Apple size={32} />
                            <div className="text-left">
                                <p className="text-xs uppercase font-bold opacity-60">Soon on the</p>
                                <p className="text-xl font-extrabold">App Store</p>
                            </div>
                        </Button>
                        <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 rounded-2xl h-20 px-10 flex items-center gap-4 transition-all hover:scale-105">
                            <PlayCircle size={32} />
                            <div className="text-left">
                                <p className="text-xs uppercase font-bold opacity-60">Soon on</p>
                                <p className="text-xl font-extrabold">Google Play</p>
                            </div>
                        </Button>
                    </div>

                    <div className="pt-12">
                        <p className="text-primary-foreground/60 text-lg mb-8">Ready to host your next big thing?</p>
                        <Button size="lg" variant="secondary" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary px-12 py-8 text-xl rounded-full font-bold transition-all">
                            Get Started for Free
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    )
}
